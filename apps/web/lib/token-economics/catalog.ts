import "server-only";
import { gateway } from "@ai-sdk/gateway";
import {
  CURATED_MODEL_IDS,
  type NormalizedPricing,
  type PricingTier,
  type TokenEconomicsModel,
} from "./catalog-shared";

type RestPricing = {
  input?: string;
  output?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  input_tiers?: Array<{ min: number; max?: number; cost: string }>;
  output_tiers?: Array<{ min: number; max?: number; cost: string }>;
};

type RestModel = {
  id: string;
  name: string;
  released?: number;
  context_window?: number;
  max_tokens?: number;
  pricing?: RestPricing | null;
};

type PackagePricing = {
  input?: string | number;
  output?: string | number;
  cachedInputTokens?: string | number;
  cacheCreationInputTokens?: string | number;
  inputTiers?: Array<{ min: number; max?: number; cost: string | number }>;
  outputTiers?: Array<{ min: number; max?: number; cost: string | number }>;
};

type PackageModel = {
  id: string;
  name: string;
  released?: number;
  contextWindow?: number;
  maxTokens?: number;
  pricing?: PackagePricing | null;
};

type CatalogCacheEntry = {
  expiresAt: number;
  models: TokenEconomicsModel[];
};

const PUBLIC_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const CACHE_TTL_MS = 10 * 60 * 1000;

let catalogCache: CatalogCacheEntry | null = null;

const FALLBACK_MODELS: TokenEconomicsModel[] = [
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "openai",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.00000015,
      outputCostPerToken: 0.0000006,
      cachedInputReadCostPerToken: 0.000000075,
      cachedInputWriteCostPerToken: null,
      inputTiers: [],
      outputTiers: [],
    },
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 mini",
    provider: "openai",
    contextWindow: 400000,
    maxOutputTokens: 128000,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.00000025,
      outputCostPerToken: 0.000002,
      cachedInputReadCostPerToken: 0.000000025,
      cachedInputWriteCostPerToken: null,
      inputTiers: [],
      outputTiers: [],
    },
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    contextWindow: 1000000,
    maxOutputTokens: 64000,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cachedInputReadCostPerToken: 0.0000003,
      cachedInputWriteCostPerToken: 0.00000375,
      inputTiers: [
        { min: 0, max: 200001, costPerToken: 0.000003 },
        { min: 200001, costPerToken: 0.000006 },
      ],
      outputTiers: [
        { min: 0, max: 200001, costPerToken: 0.000015 },
        { min: 200001, costPerToken: 0.0000225 },
      ],
    },
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutputTokens: 64000,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.000005,
      cachedInputReadCostPerToken: 0.0000001,
      cachedInputWriteCostPerToken: 0.00000125,
      inputTiers: [],
      outputTiers: [],
    },
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.00000125,
      outputCostPerToken: 0.00001,
      cachedInputReadCostPerToken: 0.000000125,
      cachedInputWriteCostPerToken: null,
      inputTiers: [
        { min: 0, max: 200001, costPerToken: 0.00000125 },
        { min: 200001, costPerToken: 0.0000025 },
      ],
      outputTiers: [
        { min: 0, max: 200001, costPerToken: 0.00001 },
        { min: 200001, costPerToken: 0.000015 },
      ],
    },
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.0000003,
      outputCostPerToken: 0.0000025,
      cachedInputReadCostPerToken: 0.00000003,
      cachedInputWriteCostPerToken: null,
      inputTiers: [],
      outputTiers: [],
    },
  },
  {
    id: "meta/llama-4-maverick",
    name: "Llama 4 Maverick 17B Instruct",
    provider: "meta",
    contextWindow: 128000,
    maxOutputTokens: 8192,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.00000024,
      outputCostPerToken: 0.00000097,
      cachedInputReadCostPerToken: null,
      cachedInputWriteCostPerToken: null,
      inputTiers: [],
      outputTiers: [],
    },
  },
  {
    id: "mistral/mistral-small",
    name: "Mistral Small",
    provider: "mistral",
    contextWindow: 32000,
    maxOutputTokens: 4000,
    releasedAt: null,
    pricing: {
      inputCostPerToken: 0.0000001,
      outputCostPerToken: 0.0000003,
      cachedInputReadCostPerToken: null,
      cachedInputWriteCostPerToken: null,
      inputTiers: [],
      outputTiers: [],
    },
  },
];

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeTiers(
  tiers:
    | Array<{ min: number; max?: number; cost: string | number }>
    | undefined
): PricingTier[] {
  if (!tiers || tiers.length === 0) {
    return [];
  }

  const normalized: PricingTier[] = [];

  for (const tier of tiers) {
    const costPerToken = toNumber(tier.cost);

    if (costPerToken == null) {
      continue;
    }

    normalized.push({
      min: tier.min,
      ...(tier.max != null ? { max: tier.max } : {}),
      costPerToken,
    });
  }

  return normalized.sort((left, right) => left.min - right.min);
}

function normalizePricing(input: {
  input?: string | number;
  output?: string | number;
  cachedInputRead?: string | number;
  cachedInputWrite?: string | number;
  inputTiers?: Array<{ min: number; max?: number; cost: string | number }>;
  outputTiers?: Array<{ min: number; max?: number; cost: string | number }>;
} | null | undefined): NormalizedPricing {
  return {
    inputCostPerToken: toNumber(input?.input),
    outputCostPerToken: toNumber(input?.output),
    cachedInputReadCostPerToken: toNumber(input?.cachedInputRead),
    cachedInputWriteCostPerToken: toNumber(input?.cachedInputWrite),
    inputTiers: normalizeTiers(input?.inputTiers),
    outputTiers: normalizeTiers(input?.outputTiers),
  };
}

function normalizeRestModel(model: RestModel): TokenEconomicsModel {
  return {
    id: model.id,
    name: model.name,
    provider: model.id.split("/")[0] ?? "unknown",
    contextWindow: model.context_window ?? null,
    maxOutputTokens: model.max_tokens ?? null,
    releasedAt: model.released ?? null,
    pricing: normalizePricing({
      input: model.pricing?.input,
      output: model.pricing?.output,
      cachedInputRead: model.pricing?.input_cache_read,
      cachedInputWrite: model.pricing?.input_cache_write,
      inputTiers: model.pricing?.input_tiers,
      outputTiers: model.pricing?.output_tiers,
    }),
  };
}

function normalizePackageModel(model: PackageModel): TokenEconomicsModel {
  return {
    id: model.id,
    name: model.name,
    provider: model.id.split("/")[0] ?? "unknown",
    contextWindow: model.contextWindow ?? null,
    maxOutputTokens: model.maxTokens ?? null,
    releasedAt: model.released ?? null,
    pricing: normalizePricing({
      input: model.pricing?.input,
      output: model.pricing?.output,
      cachedInputRead: model.pricing?.cachedInputTokens,
      cachedInputWrite: model.pricing?.cacheCreationInputTokens,
      inputTiers: model.pricing?.inputTiers,
      outputTiers: model.pricing?.outputTiers,
    }),
  };
}

function sortModels(models: TokenEconomicsModel[]) {
  return [...models].sort((left, right) => {
    const leftIndex = CURATED_MODEL_IDS.indexOf(
      left.id as (typeof CURATED_MODEL_IDS)[number]
    );
    const rightIndex = CURATED_MODEL_IDS.indexOf(
      right.id as (typeof CURATED_MODEL_IDS)[number]
    );

    if (leftIndex !== -1 && rightIndex !== -1) {
      return leftIndex - rightIndex;
    }

    if (leftIndex !== -1) {
      return -1;
    }

    if (rightIndex !== -1) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function curateModels(models: TokenEconomicsModel[]) {
  const byId = new Map(models.map((model) => [model.id, model]));
  const curated = CURATED_MODEL_IDS.map((id) => byId.get(id)).filter(
    (model): model is TokenEconomicsModel => model != null
  );

  if (curated.length >= 6) {
    return sortModels(curated);
  }

  return sortModels(
    [...curated, ...FALLBACK_MODELS.filter((model) => !byId.has(model.id))].slice(0, 8)
  );
}

async function fetchCatalogFromGatewayPackage() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return null;
  }

  try {
    const result = await gateway.getAvailableModels();
    const models = (result.models as PackageModel[]).map(normalizePackageModel);
    return curateModels(models);
  } catch {
    return null;
  }
}

async function fetchCatalogFromPublicApi() {
  const response = await fetch(PUBLIC_MODELS_URL, {
    cache: "force-cache",
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AI Gateway catalog: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: RestModel[] };
  const models = (payload.data ?? []).map(normalizeRestModel);
  return curateModels(models);
}

export async function getCuratedTokenEconomicsModels() {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.models;
  }

  const models =
    (await fetchCatalogFromGatewayPackage()) ??
    (await fetchCatalogFromPublicApi().catch(() => null)) ??
    FALLBACK_MODELS;

  catalogCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    models,
  };

  return models;
}

export async function getCuratedTokenEconomicsModelMap() {
  const models = await getCuratedTokenEconomicsModels();
  return new Map(models.map((model) => [model.id, model]));
}