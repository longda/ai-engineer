import "server-only";
import { z } from "zod";
import { PROMPT_CATALOG_BY_ID, PROMPT_IDS, type PromptId } from "./catalog";

const toolRecommendationSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  order: z.number().int().positive(),
  rationale: z.string().min(1),
});

const rejectedToolSchema = z.object({
  name: z.string().min(1),
  reason: z.string().min(1),
});

const mcpToolSelectionSchema = z.object({
  decision: z.enum(["proceed", "needs-human-input", "reject"]),
  recommendedTools: z.array(toolRecommendationSchema),
  rejectedTools: z.array(rejectedToolSchema),
  clarifyingQuestions: z.array(z.string().min(1)),
  humanInputRequired: z.boolean(),
  humanInputReason: z.string(),
});

const memoryFactSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  rationale: z.string().min(1),
});

const ttlSchema = z.object({
  amount: z.number().int().positive(),
  unit: z.enum(["hours", "days", "weeks", "months"]),
});

const memoryDistillerSchema = z.object({
  shouldStore: z.boolean(),
  memoryType: z.enum([
    "preference",
    "identity",
    "project-context",
    "task-state",
    "safety-sensitive",
    "ephemeral",
  ]),
  factsToStore: z.array(memoryFactSchema),
  ttl: ttlSchema,
  sensitivity: z.enum(["low", "moderate", "high", "restricted"]),
  retrievalTags: z.array(z.string().min(1)),
  doNotStoreReasons: z.array(z.string().min(1)),
});

const selectedSourceSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
  reason: z.string().min(1),
  estimatedTokens: z.number().int().nonnegative(),
});

const excludedSourceSchema = z.object({
  sourceId: z.string().min(1),
  reason: z.string().min(1),
});

const contextPackAssemblerSchema = z.object({
  taskSummary: z.string().min(1),
  selectedSources: z.array(selectedSourceSchema),
  excludedSources: z.array(excludedSourceSchema),
  totalEstimatedTokens: z.number().int().nonnegative(),
  fitsBudget: z.boolean(),
  compressionPlan: z.array(z.string().min(1)),
  warningFlags: z.array(z.string().min(1)),
});

const metadataFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "contains", "gte", "lte", "in"]),
  value: z.string().min(1),
});

const retrievalQueryArchitectSchema = z.object({
  objective: z.string().min(1),
  searchStrategy: z.enum(["broad-first", "narrow-first", "hybrid"]),
  subQueries: z.array(z.string().min(1)).min(1),
  keywordVariants: z.array(z.string().min(1)),
  metadataFilters: z.array(metadataFilterSchema),
  evidenceTargets: z.array(z.string().min(1)),
  followUpQuestions: z.array(z.string().min(1)),
});

const promptInjectionScreenerSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  attackPatterns: z.array(z.string().min(1)),
  safeRewrite: z.string().min(1),
  shouldBlock: z.boolean(),
  humanReviewRequired: z.boolean(),
  allowedScope: z.array(z.string().min(1)),
  reviewerNotes: z.array(z.string().min(1)),
});

const costAwareModelRouterSchema = z.object({
  routingClass: z.enum(["cheap", "balanced", "frontier"]),
  recommendedModel: z.string().min(1),
  fallbackModel: z.string().min(1),
  reasoning: z.string().min(1),
  estimatedInputTokens: z.number().int().nonnegative(),
  estimatedOutputTokens: z.number().int().nonnegative(),
  estimatedLatency: z.enum(["low", "medium", "high"]),
  confidence: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string().min(1)),
});

export const runSpecificationPromptRequestSchema = z.object({
  promptId: z.enum(PROMPT_IDS),
  input: z.string().trim().min(1).max(8000),
});

const specificationPromptSchemas = {
  "mcp-tool-selection-referee": mcpToolSelectionSchema,
  "memory-distiller": memoryDistillerSchema,
  "context-pack-assembler": contextPackAssemblerSchema,
  "retrieval-query-architect": retrievalQueryArchitectSchema,
  "prompt-injection-screener": promptInjectionScreenerSchema,
  "cost-aware-model-router": costAwareModelRouterSchema,
} satisfies Record<PromptId, z.ZodTypeAny>;

export function getSpecificationPromptDefinition(promptId: PromptId) {
  const prompt = PROMPT_CATALOG_BY_ID[promptId];
  const schema: z.ZodTypeAny = specificationPromptSchemas[promptId];

  return {
    ...prompt,
    schema,
    schemaName: prompt.id.replaceAll("-", "_"),
    schemaDescription: `${prompt.title} structured output`,
  };
}