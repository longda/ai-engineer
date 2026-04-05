import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

const MODEL_ID = "openai/gpt-5.4-mini";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string };
    const userPrompt = body.prompt?.trim();

    if (!userPrompt) {
      return Response.json({ error: "Prompt is required." }, { status: 400 });
    }

    const result = await generateText({
      model: MODEL_ID,
      temperature: 0,
      stopWhen: stepCountIs(5),
      system:
        "You are a helpful assistant. Use tools when they improve correctness. Be concise.",
      tools: {
        calculator: tool({
          description:
            "Run a basic arithmetic operation for two numbers and return the result.",
          inputSchema: z.object({
            operation: z
              .enum(["add", "subtract", "multiply", "divide"])
              .describe("Arithmetic operation to run."),
            a: z.number().describe("First number."),
            b: z.number().describe("Second number."),
          }),
          execute: async ({ operation, a, b }) => {
            if (operation === "add") return { result: a + b };
            if (operation === "subtract") return { result: a - b };
            if (operation === "multiply") return { result: a * b };
            return { result: b === 0 ? null : a / b };
          },
        }),
        textStats: tool({
          description:
            "Return word and character counts for an input string to support precise summaries.",
          inputSchema: z.object({
            text: z.string().describe("The text to analyze."),
          }),
          execute: async ({ text }) => {
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            const characters = text.length;

            return { words, characters };
          },
        }),
        currentTime: tool({
          description:
            "Return the current server time in UTC and Unix seconds.",
          inputSchema: z.object({}),
          execute: async () => {
            const now = new Date();
            return {
              isoUtc: now.toISOString(),
              unixSeconds: Math.floor(now.getTime() / 1000),
            };
          },
        }),
      },
      prompt: userPrompt,
    });

    return Response.json({
      answer: result.text,
      toolCalls: result.toolCalls.map((toolCall) => ({
        toolName: toolCall.toolName,
        input: toolCall.input,
      })),
    });
  } catch {
    return Response.json(
      {
        error:
          "Failed to run tool-calling demo. Check AI Gateway configuration.",
      },
      { status: 500 }
    );
  }
}
