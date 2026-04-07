import { generateText } from "ai";
import { zeroShot, fewShot, chainOfThought } from "./prompts";

const MODEL_ID = "openai/gpt-5.4-mini";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string };
    const userPrompt = body.prompt?.trim();

    if (!userPrompt) {
      return Response.json({ error: "Prompt is required." }, { status: 400 });
    }

    const [zeroShotResult, fewShotResult, cotResult] = await Promise.all([
      generateText({ model: MODEL_ID, ...zeroShot(userPrompt) }),
      generateText({ model: MODEL_ID, ...fewShot(userPrompt) }),
      generateText({ model: MODEL_ID, ...chainOfThought(userPrompt) }),
    ]);

    return Response.json({
      zeroShot: zeroShotResult.text,
      fewShot: fewShotResult.text,
      chainOfThought: cotResult.text,
    });
  } catch {
    return Response.json(
      {
        error:
          "Failed to generate prompt comparison output. Check AI Gateway configuration.",
      },
      { status: 500 }
    );
  }
}
