import type { PolicyEvaluationResult, PolicyTestRequest, RuntimeEvaluateRequest } from "@governix/shared";

type TenantPolicyLike = {
  id: string;
  allowedKbIdsJson: string[];
  allowedModelIdsJson: string[];
  requireCitation: boolean;
  fallbackModelId: string | null;
  enabled: boolean;
};

type TenantQuotaLike = {
  requestLimitMonthly: number | null;
  tokenLimitMonthly: number | null;
  costLimitMonthly: string | null;
  softThresholdPercent: number;
  hardThresholdPercent: number;
};

type UsageSnapshotLike = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

function getActionRank(action: PolicyEvaluationResult["finalAction"]) {
  switch (action) {
    case "allow":
      return 0;
    case "force_filter":
      return 1;
    case "downgrade_model":
      return 2;
    case "quota_block":
      return 3;
    case "deny":
      return 4;
    default:
      return 5;
  }
}

function selectBestTenantPolicy(policies: TenantPolicyLike[], input: PolicyTestRequest) {
  let selectedPolicy: TenantPolicyLike | null = null;
  let selectedResult: PolicyEvaluationResult | null = null;

  for (const policy of policies) {
    const candidateResult = evaluateTenantPolicy(policy, input);

    if (!selectedResult || getActionRank(candidateResult.finalAction) < getActionRank(selectedResult.finalAction)) {
      selectedPolicy = policy;
      selectedResult = candidateResult;
    }
  }

  return {
    policy: selectedPolicy,
    result: selectedResult
  };
}

export function evaluateTenantPolicy(policy: TenantPolicyLike, input: PolicyTestRequest): PolicyEvaluationResult {
  if (!policy.enabled) {
    return {
      matchedPolicyIds: [],
      finalAction: "allow",
      finalModelId: input.modelId ?? null,
      finalKbId: input.kbId ?? null,
      reasons: ["Policy is disabled. System default allow applies."]
    };
  }

  const reasons: string[] = [];
  let finalAction: PolicyEvaluationResult["finalAction"] = "allow";
  let finalModelId = input.modelId ?? policy.allowedModelIdsJson[0] ?? null;
  let finalKbId = input.kbId ?? policy.allowedKbIdsJson[0] ?? null;
  let retrievalFilter: Record<string, unknown> | null = null;

  if (policy.requireCitation && input.requireCitation === false) {
    return {
      matchedPolicyIds: [policy.id],
      finalAction: "deny",
      finalModelId,
      finalKbId,
      reasons: ["This tenant policy requires citations for the request, but the runtime context did not require them."]
    };
  }

  if (input.kbId && policy.allowedKbIdsJson.length > 0 && !policy.allowedKbIdsJson.includes(input.kbId)) {
    return {
      matchedPolicyIds: [policy.id],
      finalAction: "deny",
      finalModelId,
      finalKbId,
      reasons: [`Requested KB ${input.kbId} is not allowed for this tenant policy.`]
    };
  }

  if (input.modelId && policy.allowedModelIdsJson.length > 0 && !policy.allowedModelIdsJson.includes(input.modelId)) {
    if (policy.fallbackModelId) {
      finalAction = "downgrade_model";
      finalModelId = policy.fallbackModelId;
      reasons.push(`Requested model ${input.modelId} is not allowed. Falling back to ${policy.fallbackModelId}.`);
    } else {
      return {
        matchedPolicyIds: [policy.id],
        finalAction: "deny",
        finalModelId,
        finalKbId,
        reasons: [`Requested model ${input.modelId} is not allowed and no fallback model is configured.`]
      };
    }
  }

  if (input.requestType !== "generate" && policy.allowedKbIdsJson.length > 0) {
    retrievalFilter = {
      allowedKbIds: policy.allowedKbIdsJson
    };

    if (finalAction === "allow") {
      finalAction = "force_filter";
    }

    reasons.push("Retrieval requests must be filtered to the tenant's allowed knowledge bases.");
  }

  if (policy.requireCitation) {
    reasons.push("Citations are required for this tenant policy.");
  }

  if (reasons.length === 0) {
    reasons.push("Request satisfies tenant policy constraints.");
  }

  return {
    matchedPolicyIds: [policy.id],
    finalAction,
    finalModelId,
    finalKbId,
    retrievalFilter,
    reasons
  };
}

export function evaluateRuntimePolicy(input: {
  policies: TenantPolicyLike[];
  quota: TenantQuotaLike | null;
  usage: UsageSnapshotLike;
  request: RuntimeEvaluateRequest["request"];
}): PolicyEvaluationResult {
  const selected = selectBestTenantPolicy(input.policies, {
        kbId: input.request.kbId,
        modelId: input.request.modelId,
        requestType: input.request.requestType,
        requireCitation: input.request.requireCitation,
        requestRateSnapshot: input.request.requestRateSnapshot
      })
  const selectedPolicy = selected.policy;
  const baseResult = selected.result ?? {
        matchedPolicyIds: [],
        finalAction: "allow" as const,
        finalModelId: input.request.modelId ?? null,
        finalKbId: input.request.kbId ?? null,
        reasons: ["No enabled tenant policy matched. System default allow applies."]
      };

  if (baseResult.finalAction === "deny" || !input.quota) {
    return baseResult;
  }

  const tokenUsage = input.usage.inputTokens + input.usage.outputTokens;
  const quotaPercentages = [
    input.quota.requestLimitMonthly ? (input.usage.requestCount / input.quota.requestLimitMonthly) * 100 : null,
    input.quota.tokenLimitMonthly ? (tokenUsage / input.quota.tokenLimitMonthly) * 100 : null,
    input.quota.costLimitMonthly ? (input.usage.estimatedCost / Number(input.quota.costLimitMonthly)) * 100 : null
  ].filter((value): value is number => value !== null && Number.isFinite(value));

  if (quotaPercentages.length === 0) {
    return baseResult;
  }

  const highestUsagePercent = Math.max(...quotaPercentages);
  const reasons = [...baseResult.reasons];

  if (highestUsagePercent >= input.quota.hardThresholdPercent) {
    const fallbackModelId = selectedPolicy?.fallbackModelId ?? null;
    const currentModelId = baseResult.finalModelId ?? input.request.modelId ?? null;

    if (fallbackModelId && fallbackModelId !== currentModelId) {
      return {
        ...baseResult,
        finalAction: "downgrade_model",
        finalModelId: fallbackModelId,
        reasons: [...reasons, "Monthly quota usage reached the hard threshold, so the request must downgrade to the tenant fallback model."]
      };
    }

    return {
      ...baseResult,
      finalAction: "quota_block",
      reasons: [...reasons, "Monthly quota usage reached the hard threshold, so the request is blocked."]
    };
  }

  if (highestUsagePercent >= input.quota.softThresholdPercent) {
    return {
      ...baseResult,
      reasons: [...reasons, "Monthly quota usage is above the soft threshold."]
    };
  }

  return baseResult;
}
