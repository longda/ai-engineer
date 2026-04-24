import { z } from "zod";
import {
  InvalidScenarioIdError,
  runFailurePatternComparison,
} from "@/lib/failure-patterns/run-scenario";

const requestSchema = z.object({
  scenarioId: z.string().min(1),
});

export const maxDuration = 90;

export async function POST(req: Request) {
  if (process.env.AI_GATEWAY_ENABLED === "false") {
    return Response.json(
      {
        error: "AI Gateway is disabled for this environment.",
      },
      { status: 503 }
    );
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      {
        error:
          "Missing AI_GATEWAY_API_KEY. Add it to your .env before running the failure-patterns demo.",
      },
      { status: 503 }
    );
  }

  try {
    const json = await req.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request payload for the failure-patterns demo.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await runFailurePatternComparison(
      parsed.data.scenarioId,
      req.signal
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof InvalidScenarioIdError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    console.error("[failure-patterns:route] request failed", error);

    return Response.json(
      {
        error: "The failure-pattern comparison request failed.",
      },
      { status: 500 }
    );
  }
}