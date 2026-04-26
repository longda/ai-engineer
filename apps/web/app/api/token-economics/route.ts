import {
  createAgentUIStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import {
  buildRoutingPrompt,
  complexFulfillmentAgent,
  routerDecisionSchema,
  simpleFulfillmentAgent,
  tokenEconomicsRouterAgent,
} from "@/lib/token-economics/agents";
import {
  calculateScenarioCost,
  COMPLEX_ROUTE_MODEL_ID,
  estimateTokensFromText,
  SIMPLE_ROUTE_MODEL_ID,
} from "@/lib/token-economics/catalog-shared";
import { getCuratedTokenEconomicsModelMap } from "@/lib/token-economics/catalog";
import type { TokenEconomicsUIMessage } from "@/lib/token-economics/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Roughly accounts for the router/system prompt frame so the displayed estimate
// does not treat the user message as the entire request cost.
const ROUTING_OVERHEAD_TOKENS = 180;

function stripDataParts(messages: TokenEconomicsUIMessage[]) {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter(
      (part) => typeof part.type !== "string" || !part.type.startsWith("data-")
    ),
  }));
}

function getLatestUserText(messages: UIMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") {
      continue;
    }

    for (const part of message.parts) {
      if (part.type === "text" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return null;
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const messages =
    typeof body === "object" && body !== null && "messages" in body
      ? (body as { messages?: unknown }).messages
      : undefined;

  if (!Array.isArray(messages)) {
    return Response.json(
      { error: "Invalid request body. Expected a messages array." },
      { status: 400 }
    );
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      {
        error:
          "Missing AI_GATEWAY_API_KEY. Add it to your .env.local before running the token-economics routing demo.",
      },
      { status: 400 }
    );
  }

  const uiMessages = stripDataParts(messages as TokenEconomicsUIMessage[]);
  const latestUserText = getLatestUserText(uiMessages);

  if (!latestUserText) {
    return Response.json(
      { error: "Missing a user prompt for the routing demo." },
      { status: 400 }
    );
  }

  try {
    const routingResult = await tokenEconomicsRouterAgent.generate({
      prompt: buildRoutingPrompt(latestUserText),
      abortSignal: req.signal,
    });
    const routingDecision = routerDecisionSchema.parse(routingResult.output);
    const modelMap = await getCuratedTokenEconomicsModelMap();
    const selectedModel = modelMap.get(routingDecision.selectedModelId);
    const alternateModel = modelMap.get(
      routingDecision.selectedModelId === SIMPLE_ROUTE_MODEL_ID
        ? COMPLEX_ROUTE_MODEL_ID
        : SIMPLE_ROUTE_MODEL_ID
    );

    if (!selectedModel || !alternateModel) {
      return Response.json(
        { error: "Routing models are unavailable in the current catalog." },
        { status: 500 }
      );
    }

    const estimatedInputTokens =
      estimateTokensFromText(latestUserText) + ROUTING_OVERHEAD_TOKENS;
    const estimatedOutputTokens = routingDecision.estimatedOutputTokens;
    const selectedCost = calculateScenarioCost(
      selectedModel,
      estimatedInputTokens,
      estimatedOutputTokens
    );
    const alternateCost = calculateScenarioCost(
      alternateModel,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    if (!selectedCost || !alternateCost) {
      return Response.json(
        { error: "Unable to calculate routing costs for the selected models." },
        { status: 500 }
      );
    }

    const selectedAgent =
      routingDecision.selectedModelId === SIMPLE_ROUTE_MODEL_ID
        ? simpleFulfillmentAgent
        : complexFulfillmentAgent;
    const agentStream = await createAgentUIStream<never, {}, never, never>({
      agent: selectedAgent,
      uiMessages,
      abortSignal: req.signal,
    });

    const stream = createUIMessageStream<TokenEconomicsUIMessage>({
      originalMessages: uiMessages,
      execute: async ({ writer }) => {
        writer.write({
          type: "data-routing",
          id: crypto.randomUUID(),
          data: {
            requestId: crypto.randomUUID(),
            prompt: latestUserText,
            complexity: routingDecision.complexity,
            selectedModelId: selectedModel.id,
            selectedModelName: selectedModel.name,
            alternateModelId: alternateModel.id,
            alternateModelName: alternateModel.name,
            rationale: routingDecision.rationale,
            estimatedInputTokens,
            estimatedOutputTokens,
            selectedCostUsd: selectedCost.totalCostUsd,
            alternateCostUsd: alternateCost.totalCostUsd,
            deltaUsd: Math.abs(
              alternateCost.totalCostUsd - selectedCost.totalCostUsd
            ),
          },
        });

        writer.merge(agentStream);
      },
      onError: (error) => {
        console.error("[token-economics] route stream failed", error);
        return "The token-economics routing demo failed.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("[token-economics] route failed", error);

    return Response.json(
      { error: "The token-economics routing demo failed before streaming could start." },
      { status: 500 }
    );
  }
}