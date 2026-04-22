import type { PolicyEvaluationResult, PolicyTestRequest } from "@governix/shared";

type TenantPolicyLike = {
  id: string;
  allowedKbIdsJson: string[];
  allowedModelIdsJson: string[];
  requireCitation: boolean;
  fallbackModelId: string | null;
  enabled: boolean;
};

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
