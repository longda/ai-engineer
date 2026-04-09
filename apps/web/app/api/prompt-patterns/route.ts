import { streamText, type UIMessage, convertToModelMessages } from "ai";
import { SYSTEM_PROMPTS, type PromptPattern } from "./prompts";

const MODEL_ID = "openai/gpt-5.4-mini";

export const maxDuration = 30;

export async function POST(req: Request) {
  if (process.env.AI_GATEWAY_ENABLED !== "true") {
    return Response.json(
      { error: "AI gateway is currently disabled." },
      { status: 503 }
    );
  }

  const {
    messages,
    pattern,
  }: { messages: UIMessage[]; pattern: PromptPattern } = await req.json();

  const system = SYSTEM_PROMPTS[pattern];

  if (!system) {
    return Response.json(
      { error: `Invalid pattern: ${pattern}` },
      { status: 400 }
    );
  }

  const result = streamText({
    model: MODEL_ID,
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
