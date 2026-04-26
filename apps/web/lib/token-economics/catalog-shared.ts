export type PricingTier = {
  min: number;
  max?: number;
  costPerToken: number;
};

export type NormalizedPricing = {
  inputCostPerToken: number | null;
  outputCostPerToken: number | null;
  cachedInputReadCostPerToken: number | null;
  cachedInputWriteCostPerToken: number | null;
  inputTiers: PricingTier[];
  outputTiers: PricingTier[];
};

export type TokenEconomicsModel = {
  id: string;
  name: string;
  provider: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  releasedAt: number | null;
  pricing: NormalizedPricing;
};

export type CostSummary = {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
};

export const CURATED_MODEL_IDS = [
  "openai/gpt-4o-mini",
  "openai/gpt-5-mini",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "meta/llama-4-maverick",
  "mistral/mistral-small",
] as const;

export const DEFAULT_SELECTED_MODEL_IDS = [
  "openai/gpt-4o-mini",
  "openai/gpt-5-mini",
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
] as const;

export const SIMPLE_ROUTE_MODEL_ID = "openai/gpt-4o-mini";
export const COMPLEX_ROUTE_MODEL_ID = "openai/gpt-5-mini";

function pickTierCost(
  baseCost: number | null,
  tiers: PricingTier[],
  tokens: number
) {
  if (tiers.length === 0) {
    return baseCost;
  }

  const matchingTier = tiers.find((tier) => {
    const max = tier.max ?? Number.POSITIVE_INFINITY;
    return tokens >= tier.min && tokens < max;
  });

  return matchingTier?.costPerToken ?? baseCost;
}

export function calculateScenarioCost(
  model: TokenEconomicsModel,
  inputTokens: number,
  outputTokens: number
): CostSummary | null {
  if (inputTokens < 0 || outputTokens < 0) {
    return null;
  }

  const inputUnitCost = pickTierCost(
    model.pricing.inputCostPerToken,
    model.pricing.inputTiers,
    inputTokens
  );
  const outputUnitCost = pickTierCost(
    model.pricing.outputCostPerToken,
    model.pricing.outputTiers,
    outputTokens
  );

  if (inputUnitCost == null || outputUnitCost == null) {
    return null;
  }

  const inputCostUsd = inputTokens * inputUnitCost;
  const outputCostUsd = outputTokens * outputUnitCost;

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

export function estimateTokensFromText(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);
}

export function formatDollarsPerMillion(costPerToken: number | null) {
  if (costPerToken == null) {
    return "—";
  }

  const costPerMillion = costPerToken * 1_000_000;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: costPerMillion < 1 ? 2 : 0,
    maximumFractionDigits: costPerMillion < 1 ? 2 : 2,
  }).format(costPerMillion);
}

export function formatCompactTokens(tokens: number | null) {
  if (tokens == null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(tokens);
}