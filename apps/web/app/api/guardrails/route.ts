import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import {
  buildBlockedExplanationPrompt,
  buildOutputBlockedExplanationPrompt,
  buildSendSystemPrompt,
  createSendProtectedEmailTool,
  draftProtectedEmail,
  EMAIL_MODEL,
  evaluateInputGuardrails,
  evaluateOutputGuardrails,
  extractExistingEmailDraft,
  extractPacketIdFromMessages,
  getGuardrailsPacket,
  GUARDRAIL_MODEL,
  isGuardrailsMessageArray,
  stripDataParts,
} from "@/lib/guardrails/server";
import type { GuardrailsUIMessage } from "@/lib/guardrails/types";

export const maxDuration = 60;

type GuardrailsRequestBody = {
  messages: UIMessage[];
  packetId?: string;
};

export async function POST(req: Request) {
  const { messages, packetId }: GuardrailsRequestBody = await req.json();

  const resolvedPacketId = packetId ?? extractPacketIdFromMessages(messages);

  if (!resolvedPacketId) {
    return Response.json({ error: "Missing packetId." }, { status: 400 });
  }

  if (!isGuardrailsMessageArray(messages)) {
    return Response.json({ error: "Invalid messages payload." }, { status: 400 });
  }

  const packet = getGuardrailsPacket(resolvedPacketId);

  if (!packet) {
    return Response.json(
      { error: `Invalid packetId: ${resolvedPacketId}` },
      { status: 400 }
    );
  }

  const cleanMessages = stripDataParts(messages);
  const existingDraft = extractExistingEmailDraft(cleanMessages);

  const stream = createUIMessageStream<GuardrailsUIMessage>({
    execute: async ({ writer }) => {
      if (existingDraft) {
        const result = streamText({
          abortSignal: req.signal,
          model: EMAIL_MODEL,
          system: buildSendSystemPrompt(packet, existingDraft),
          messages: await convertToModelMessages(cleanMessages),
          stopWhen: stepCountIs(3),
          tools: {
            send_protected_email: createSendProtectedEmailTool(),
          },
        });

        writer.merge(result.toUIMessageStream());
        return;
      }

      const inputResult = await evaluateInputGuardrails(packet, req.signal);

      writer.write({
        type: "data-guardrail",
        id: `${packet.id}-input`,
        data: inputResult.data,
      });

      if (!inputResult.passed) {
        const blocked = streamText({
          abortSignal: req.signal,
          model: GUARDRAIL_MODEL,
          prompt: buildBlockedExplanationPrompt(packet, inputResult.data),
        });

        writer.merge(blocked.toUIMessageStream());
        return;
      }

      const draft = await draftProtectedEmail(packet, req.signal);
      const outputResult = await evaluateOutputGuardrails(
        draft,
        packet,
        req.signal
      );

      writer.write({
        type: "data-guardrail",
        id: `${packet.id}-output`,
        data: outputResult.data,
      });

      if (!outputResult.passed) {
        const blocked = streamText({
          abortSignal: req.signal,
          model: GUARDRAIL_MODEL,
          prompt: buildOutputBlockedExplanationPrompt(
            packet,
            draft,
            outputResult.data
          ),
        });

        writer.merge(blocked.toUIMessageStream());
        return;
      }

      const result = streamText({
        abortSignal: req.signal,
        model: EMAIL_MODEL,
        system: buildSendSystemPrompt(packet, draft),
        messages: await convertToModelMessages(cleanMessages),
        stopWhen: stepCountIs(3),
        tools: {
          send_protected_email: createSendProtectedEmailTool(),
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}