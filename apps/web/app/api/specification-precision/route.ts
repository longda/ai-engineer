import { generateText } from "@/lib/ai";
import { Output } from "ai";
import {
  getSpecificationPromptDefinition,
  runSpecificationPromptRequestSchema,
} from "@/lib/specification/server";

const MODEL_ID = "openai/gpt-5.4-mini";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = runSpecificationPromptRequestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request payload for specification precision.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const definition = getSpecificationPromptDefinition(parsed.data.promptId);
    const result = await generateText({
      model: MODEL_ID,
      system: definition.systemPrompt,
      prompt: parsed.data.input,
      output: Output.object({
        schema: definition.schema,
        name: definition.schemaName,
        description: definition.schemaDescription,
      }),
      abortSignal: req.signal,
    });

    return Response.json({
      promptId: definition.id,
      model: MODEL_ID,
      object: result.output,
      finishReason: result.finishReason,
      usage: result.totalUsage,
      warnings: result.warnings ?? [],
    });
  } catch (error) {
    console.error("[specification-precision:route] request failed", error);

    return Response.json(
      {
        error: "The structured output request failed.",
      },
      { status: 500 }
    );
  }
}