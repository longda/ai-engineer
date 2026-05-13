import { z } from "zod";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { streamText } from "@/lib/ai";
import {
  buildRagSystemPrompt,
  retrieveRagContext,
  RAG_MODEL_ID,
} from "@/lib/rag/server";
import type { RagRetrievalMode } from "@/lib/rag/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1),
  retrievalMode: z
    .enum(["vector-only", "hybrid", "hybrid-rerank"])
    .optional(),
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
        { error: "Missing a user question for the RAG demo." },
        { status: 400 }
      );
    }

    const cleanMessages = stripDataParts(payload.messages);
    const context = await retrieveRagContext(latestUserText, {
      retrievalMode: payload.retrievalMode as RagRetrievalMode | undefined,
    });

    const stream = createUIMessageStream({
      originalMessages: cleanMessages,
      execute: async ({ writer }) => {
        writer.write({
          type: "data-rag",
          id: crypto.randomUUID(),
          data: context,
        });

        const result = streamText({
          abortSignal: req.signal,
          model: RAG_MODEL_ID,
          system: buildRagSystemPrompt(context),
          messages: await convertToModelMessages(cleanMessages),
        });

        writer.merge(result.toUIMessageStream());
      },
      onError: (error) => {
        console.error("[rag] route stream failed", error);
        return "The ARC Raiders RAG demo failed.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("[rag] route failed", error);

    return Response.json(
      { error: "The ARC Raiders RAG demo failed before streaming could start." },
      { status: 500 }
    );
  }
}