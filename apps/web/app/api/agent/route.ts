import { createAgentUIStreamResponse } from "ai";
import { sportsAgent } from "@/lib/agent/sports-agent";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createAgentUIStreamResponse({
    agent: sportsAgent,
    abortSignal: req.signal,
    uiMessages: messages,
  });
}
