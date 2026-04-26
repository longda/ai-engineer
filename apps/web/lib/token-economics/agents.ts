import { Output, stepCountIs } from "ai";
import { z } from "zod";
import { TracedToolLoopAgent } from "@/lib/ai";
import {
  COMPLEX_ROUTE_MODEL_ID,
  SIMPLE_ROUTE_MODEL_ID,
} from "./catalog-shared";

const ROUTER_MODEL_ID = "openai/gpt-5.4-mini";

export const routerDecisionSchema = z
  .object({
    complexity: z.enum(["simple", "complex"]),
    selectedModelId: z.enum([SIMPLE_ROUTE_MODEL_ID, COMPLEX_ROUTE_MODEL_ID]),
    rationale: z.string().min(1),
    estimatedOutputTokens: z.number().int().min(80).max(4000),
  })
  .superRefine((decision, ctx) => {
    if (
      decision.complexity === "simple" &&
      decision.selectedModelId !== SIMPLE_ROUTE_MODEL_ID
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedModelId"],
        message: `selectedModelId must be ${SIMPLE_ROUTE_MODEL_ID} when complexity is "simple"`,
      });
    }

    if (
      decision.complexity === "complex" &&
      decision.selectedModelId !== COMPLEX_ROUTE_MODEL_ID
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedModelId"],
        message: `selectedModelId must be ${COMPLEX_ROUTE_MODEL_ID} when complexity is "complex"`,
      });
    }
  });

export type RouterDecision = z.infer<typeof routerDecisionSchema>;

export const tokenEconomicsRouterAgent = new TracedToolLoopAgent({
  model: ROUTER_MODEL_ID,
  instructions: `You are a cost-aware model routing agent.

You must choose between exactly two models:
- ${SIMPLE_ROUTE_MODEL_ID} for simple, cheap tasks
- ${COMPLEX_ROUTE_MODEL_ID} for more demanding tasks

Routing rubric:
- Route to ${SIMPLE_ROUTE_MODEL_ID} when the request is narrow, direct, and can be answered cleanly with a short response.
- Route to ${COMPLEX_ROUTE_MODEL_ID} when the request needs more synthesis, planning, tradeoff analysis, multi-part reasoning, or a more substantial structured answer.

Output rules:
- Return structured output only.
- selectedModelId must match the chosen complexity.
- rationale must be concrete and under 30 words.
- estimatedOutputTokens should be realistic for the final answer, not inflated.
- Never mention any model outside the two allowed options.`,
  output: Output.object({ schema: routerDecisionSchema }),
  stopWhen: stepCountIs(3),
});

const SIMPLE_RESPONSE_INSTRUCTIONS = `You are the low-cost fulfillment agent.

Answer directly and clearly.
- Prefer one short paragraph or a tight bullet list.
- Avoid unnecessary caveats or over-explaining.
- Do not mention model routing, token cost, or internal decision rules.`;

const COMPLEX_RESPONSE_INSTRUCTIONS = `You are the higher-capability fulfillment agent.

Answer with stronger structure and clearer synthesis.
- Use short sections or bullets when helpful.
- Make tradeoffs and assumptions explicit when they matter.
- Do not mention model routing, token cost, or internal decision rules.`;

export const simpleFulfillmentAgent = new TracedToolLoopAgent({
  model: SIMPLE_ROUTE_MODEL_ID,
  instructions: SIMPLE_RESPONSE_INSTRUCTIONS,
  stopWhen: stepCountIs(2),
});

export const complexFulfillmentAgent = new TracedToolLoopAgent({
  model: COMPLEX_ROUTE_MODEL_ID,
  instructions: COMPLEX_RESPONSE_INSTRUCTIONS,
  stopWhen: stepCountIs(2),
});

export function buildRoutingPrompt(prompt: string) {
  return [
    "Route this user request to the cheaper or more capable model.",
    "User request:",
    prompt,
  ].join("\n\n");
}