import { z } from "zod";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { streamText } from "@/lib/ai";
import {
  buildContextArchitecturePacket,
  buildContextArchitectureSystemPrompt,
} from "@/lib/context-architecture/server";
import { CONTEXT_ARCHITECTURE_SOURCE_PROFILE_VALUES } from "@/lib/context-architecture/types";
import { RAG_MODEL_ID } from "@/lib/rag/server";
import type { RagRetrievalMode } from "@/lib/rag/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1),
  retrievalMode: z.enum(["vector-only", "hybrid", "hybrid-rerank"]).optional(),
  sourceProfile: z.enum(CONTEXT_ARCHITECTURE_SOURCE_PROFILE_VALUES).optional(),
  entityName: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(120).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  sessionContext: z.string().trim().max(1600).optional(),
  tokenBudget: z.coerce.number().int().min(300).max(4000).optional(),
});

function getLatestUserText(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role !== "user") {
      continue;
    }

    const text = message.parts
      .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => {
        return part.type === "text";
      })
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  return null;
}

function stripDataParts(messages: UIMessage[]) {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => !part.type.startsWith("data-")),
  }));
}

export async function POST(req: Request) {
  try {
    const payload = requestSchema.parse(await req.json());
    const latestUserText = getLatestUserText(payload.messages);

    if (!latestUserText) {
      return Response.json(
        { error: "Missing a user question for the context architecture demo." },
        { status: 400 }
      );
    }

    const cleanMessages = stripDataParts(payload.messages);
    const packet = await buildContextArchitecturePacket({
      query: latestUserText,
      retrievalMode: payload.retrievalMode as RagRetrievalMode | undefined,
      sourceProfile: payload.sourceProfile,
      entityName: payload.entityName,
      topic: payload.topic,
      startDate: payload.startDate,
      endDate: payload.endDate,
      sessionContext: payload.sessionContext,
      tokenBudget: payload.tokenBudget,
    });

    const stream = createUIMessageStream({
      originalMessages: cleanMessages,
      execute: async ({ writer }) => {
        writer.write({
          type: "data-context-architecture",
          id: crypto.randomUUID(),
          data: packet,
        });

        const result = streamText({
          abortSignal: req.signal,
          model: RAG_MODEL_ID,
          system: buildContextArchitectureSystemPrompt(packet),
          messages: await convertToModelMessages(cleanMessages),
        });

        writer.merge(result.toUIMessageStream());
      },
      onError: (error) => {
        console.error("[context-architecture] route stream failed", error);
        return "The ARC Raiders context architecture demo failed.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("[context-architecture] route failed", error);

    return Response.json(
      { error: "The ARC Raiders context architecture demo failed before streaming could start." },
      { status: 500 }
    );
  }
}