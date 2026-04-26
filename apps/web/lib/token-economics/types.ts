import type { UIMessage } from "ai";
import { z } from "zod";

export const routingDecisionDataSchema = z.object({
  requestId: z.string(),
  prompt: z.string(),
  complexity: z.enum(["simple", "complex"]),
  selectedModelId: z.string(),
  selectedModelName: z.string(),
  alternateModelId: z.string(),
  alternateModelName: z.string(),
  rationale: z.string(),
  estimatedInputTokens: z.number().int().nonnegative(),
  estimatedOutputTokens: z.number().int().nonnegative(),
  selectedCostUsd: z.number().nonnegative(),
  alternateCostUsd: z.number().nonnegative(),
  deltaUsd: z.number().nonnegative(),
});

export type RoutingDecisionData = z.infer<typeof routingDecisionDataSchema>;

export type TokenEconomicsUIMessage = UIMessage<
  never,
  {
    routing: RoutingDecisionData;
  } & Record<string, unknown>
>;