import { initLogger, wrapAISDK } from "braintrust";
import * as ai from "ai";
import { type UIMessage, convertToModelMessages } from "ai";
import { SYSTEM_PROMPTS, type PromptPattern } from "./prompts";

initLogger({
  projectName: "ai-engineer",
  apiKey: process.env.BRAINTRUST_API_KEY,
});

const { streamText } = wrapAISDK(ai);

const MODEL_ID = "openai/gpt-5.4-mini";

export const maxDuration = 30;

export async function POST(req: Request) {
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
