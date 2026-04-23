export type ModelPricing = {
  modelId: string;
  inputTokenPricePer1k: number;
  outputTokenPricePer1k: number;
  embeddingPricePer1k: number;
  effectiveFrom: string;
};

const modelPricingTable: ModelPricing[] = [
  {
    modelId: "anthropic.claude-3-5-sonnet",
    inputTokenPricePer1k: 0.003,
    outputTokenPricePer1k: 0.015,
    embeddingPricePer1k: 0.0001,
    effectiveFrom: "2026-01-01"
  },
  {
    modelId: "anthropic.claude-3-haiku",
    inputTokenPricePer1k: 0.0008,
    outputTokenPricePer1k: 0.004,
    embeddingPricePer1k: 0.0001,
    effectiveFrom: "2026-01-01"
  },
  {
    modelId: "anthropic.claude-sonnet-4",
    inputTokenPricePer1k: 0.0035,
    outputTokenPricePer1k: 0.018,
    embeddingPricePer1k: 0.0001,
    effectiveFrom: "2026-01-01"
  },
  {
    modelId: "claude-sonnet",
    inputTokenPricePer1k: 0.003,
    outputTokenPricePer1k: 0.015,
    embeddingPricePer1k: 0.0001,
    effectiveFrom: "2026-01-01"
  },
  {
    modelId: "claude-haiku",
    inputTokenPricePer1k: 0.0008,
    outputTokenPricePer1k: 0.004,
    embeddingPricePer1k: 0.0001,
    effectiveFrom: "2026-01-01"
  }
];

export function listModelPricing() {
  return modelPricingTable;
}

export function findModelPricing(modelId: string | null | undefined) {
  if (!modelId) {
    return null;
  }

  return modelPricingTable.find((entry) => entry.modelId === modelId) ?? null;
}

export function estimateCost(input: {
  modelId: string | null | undefined;
  inputTokens?: number | null;
  outputTokens?: number | null;
  embeddingCount?: number | null;
}) {
  const pricing = findModelPricing(input.modelId);
  if (!pricing) {
    return 0;
  }

  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const embeddingCount = input.embeddingCount ?? 0;

  return Number(
    (
      (inputTokens / 1000) * pricing.inputTokenPricePer1k +
      (outputTokens / 1000) * pricing.outputTokenPricePer1k +
      (embeddingCount / 1000) * pricing.embeddingPricePer1k
    ).toFixed(6)
  );
}
