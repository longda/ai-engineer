import { createAgentUIStreamResponse } from "ai";
import {
  buildPlannerPrompt,
  getTopicFromMessages,
  multiAgentPlanner,
} from "@/lib/multi-agent/agents";

export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const topicResult = getTopicFromMessages(messages);

    if (!topicResult.success) {
      return Response.json(
        {
          error:
            "Invalid topic. Choose one of the approved multi-agent demo topics.",
        },
        { status: 400 }
      );
    }

    const plannerMessages = messages.map(
      (message: {
        role: string;
        parts?: Array<{ type: string; text?: string }>;
      }) => {
        if (message.role !== "user") {
          return message;
        }

        return {
          ...message,
          parts: [
            {
              type: "text",
              text: buildPlannerPrompt(topicResult.data),
            },
          ],
        };
      }
    );

    return createAgentUIStreamResponse({
      agent: multiAgentPlanner,
      abortSignal: req.signal,
      uiMessages: plannerMessages,
    });
  } catch (error) {
    console.error("[multi-agent:route] request failed", error);

    return Response.json(
      {
        error: "The multi-agent run failed before streaming could start.",
      },
      { status: 500 }
    );
  }
}