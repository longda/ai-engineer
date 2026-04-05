import { generateText } from "ai";

const MODEL_ID = "openai/gpt-5.4-mini";

function createFewShotPrompt(question: string) {
  return `You are a concise assistant.

Example 1
Q: How can I reduce distractions while studying?
A: Turn off notifications, use a timer, and create a dedicated study space.

Example 2
Q: What is one good way to learn a new coding concept?
A: Build a small project and explain the concept in your own words.

Now answer this question in 3 bullet points:
Q: ${question}`;
}

function createZeroShotPrompt(question: string) {
  return `Answer this question in 3 bullet points:
${question}`;
}

function createChainOfThoughtPrompt(question: string) {
  return `Think through the problem step by step internally, then provide only:
1) a short answer
2) 3 practical bullet points

Question: ${question}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string };
    const userPrompt = body.prompt?.trim();

    if (!userPrompt) {
      return Response.json({ error: "Prompt is required." }, { status: 400 });
    }

    const [zeroShot, fewShot, chainOfThought] = await Promise.all([
      generateText({
        model: MODEL_ID,
        prompt: createZeroShotPrompt(userPrompt),
      }),
      generateText({
        model: MODEL_ID,
        prompt: createFewShotPrompt(userPrompt),
      }),
      generateText({
        model: MODEL_ID,
        prompt: createChainOfThoughtPrompt(userPrompt),
      }),
    ]);

    return Response.json({
      zeroShot: zeroShot.text,
      fewShot: fewShot.text,
      chainOfThought: chainOfThought.text,
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
