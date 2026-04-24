"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  MailIcon,
  PlayIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  GUARDRAILS_PACKETS,
  type GuardrailsPacket,
} from "@/lib/guardrails/packets";
import type { GuardrailData, GuardrailsUIMessage } from "@/lib/guardrails/types";
import { cn } from "@/lib/utils";

const transport = new DefaultChatTransport({ api: "/api/guardrails" });

type SendProtectedEmailPart = {
  type: "tool-send_protected_email";
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "output-available"
    | "output-error";
  input: {
    recipient: string;
    subject: string;
    body: string;
  };
  approval?: {
    id: string;
  };
  output?: {
    delivered?: boolean;
    simulated?: boolean;
    recipient?: string;
    subject?: string;
    preview?: string;
    loggedAt?: string;
  };
  errorText?: string;
};

function outcomeMeta(outcome: GuardrailsPacket["outcome"]) {
  switch (outcome) {
    case "pass":
      return {
        badge: "Should pass",
        tone: "bg-emerald-100 text-emerald-700",
      };
    case "input-blocked":
      return {
        badge: "Input should fail",
        tone: "bg-amber-100 text-amber-800",
      };
    case "output-blocked":
      return {
        badge: "Output should fail",
        tone: "bg-rose-100 text-rose-700",
      };
  }
}

function PacketPicker({
  packet,
  selected,
  onSelect,
}: {
  packet: GuardrailsPacket;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = outcomeMeta(packet.outcome);

  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      className={cn(
        "rounded-2xl border px-3 py-2 text-left transition-colors",
        selected
          ? "border-foreground bg-stone-50"
          : "border-border bg-white hover:bg-stone-50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{packet.title}</p>
          <span className="sr-only">{packet.description}</span>
        </div>
        <Badge variant="secondary" className={cn("shrink-0", meta.tone)}>
          {meta.badge}
        </Badge>
      </div>
    </button>
  );
}

function GuardrailCard({ data }: { data: GuardrailData }) {
  const passed = data.status === "pass";
  const Icon = passed ? ShieldCheckIcon : ShieldAlertIcon;

  return (
    <Card
      className={cn(
        "border shadow-none",
        passed ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/70"
      )}
    >
      <CardHeader className="gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4" />
          {data.title}
        </CardTitle>
        <CardDescription className="text-xs leading-5 text-muted-foreground">
          {data.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {data.checks.map((check) => (
          <div
            key={check.label}
            className="rounded-xl border border-black/5 bg-white/80 px-3 py-2"
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              {check.passed ? (
                <CheckCircle2Icon className="size-3.5 text-emerald-600" />
              ) : (
                <AlertTriangleIcon className="size-3.5 text-rose-600" />
              )}
              {check.label}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {check.detail}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ApprovalCard({
  part,
  disabled,
  onApprove,
  onDeny,
}: {
  part: SendProtectedEmailPart;
  disabled: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <Card className="border-stone-200 bg-stone-50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserRoundCheckIcon className="size-4" />
          Human approval required
        </CardTitle>
        <CardDescription className="text-xs leading-5 text-muted-foreground">
          This fake send tool is paused. Review the draft and approve or deny the action.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="rounded-xl border border-black/5 bg-white px-3 py-3 text-xs">
          <div className="space-y-1">
            <p>
              <span className="font-medium">To:</span> {part.input.recipient}
            </p>
            <p>
              <span className="font-medium">Subject:</span> {part.input.subject}
            </p>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans leading-5 text-muted-foreground">
            {part.input.body}
          </pre>
        </div>

        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={disabled} onClick={onApprove}>
            Approve fake send
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onDeny}
          >
            Deny
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SendToolResultCard({ part }: { part: SendProtectedEmailPart }) {
  if (part.state === "output-error") {
    return (
      <Card className="border-rose-200 bg-rose-50 shadow-none">
        <CardContent className="px-4 py-3 text-xs text-rose-700">
          {part.errorText ?? "The fake send step failed."}
        </CardContent>
      </Card>
    );
  }

  if (part.state !== "output-available") {
    return null;
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MailIcon className="size-4" />
          Fake send executed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
        <p>{part.output?.recipient}</p>
        <p>{part.output?.subject}</p>
        <p>{part.output?.loggedAt}</p>
      </CardContent>
    </Card>
  );
}

export default function GuardrailsPage() {
  const [selectedPacketId, setSelectedPacketId] = useState(
    GUARDRAILS_PACKETS[0]!.id
  );

  const selectedPacket = useMemo(
    () =>
      GUARDRAILS_PACKETS.find((packet) => packet.id === selectedPacketId) ??
      GUARDRAILS_PACKETS[0]!,
    [selectedPacketId]
  );

  const {
    addToolApprovalResponse,
    messages,
    sendMessage,
    setMessages,
    status,
  } = useChat<GuardrailsUIMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  const isActive = status === "submitted" || status === "streaming";
  const renderedGuardrailKeys = new Set<string>();

  function runPacket() {
    if (isActive) {
      return;
    }

    setMessages([]);
    sendMessage(
      { text: selectedPacket.request },
      { body: { packetId: selectedPacket.id } }
    );
  }

  return (
    <main className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,2fr)_minmax(0,3fr)] gap-4 px-6 pb-4 pt-8 sm:px-12 sm:pt-10 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-0">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Protected email assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          Sample prompt-injection, secrets, PII, output safety, and human approval guardrails.
        </p>
      </header>

      <Card className="min-h-0 overflow-hidden border-0 bg-white shadow-sm ring-0">
          <CardHeader className="gap-0 pb-0">
            <div className="flex items-center justify-between gap-0">
              <div>
                <CardTitle className="text-base">Choose a packet</CardTitle>
                <CardDescription>
                  No real email will be sent.
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={runPacket}
                disabled={isActive}
                className="gap-2 shrink-0"
              >
                <PlayIcon className="size-4" />
                {isActive ? "Running…" : "Run selected packet"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pt-0">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Choose a packet">
              {GUARDRAILS_PACKETS.map((packet) => (
                <PacketPicker
                  key={packet.id}
                  packet={packet}
                  selected={packet.id === selectedPacket.id}
                  onSelect={() => setSelectedPacketId(packet.id)}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[11px] leading-4 text-muted-foreground">
              <div className="grid gap-2">
                <div className="min-w-0 space-y-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Selected packet</p>
                    <p className="max-h-4 overflow-hidden">{selectedPacket.description}</p>
                  </div>

                  <div className="grid gap-1 sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-foreground">To:</span>{" "}
                      {selectedPacket.recipientName} &lt;{selectedPacket.recipientEmail}&gt;
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Tone:</span>{" "}
                      {selectedPacket.tone}
                    </p>
                  </div>

                  <div className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-3">
                    <p className="font-medium text-foreground">Facts</p>
                    <ul className="grid gap-x-3 gap-y-1 sm:grid-cols-3">
                      {selectedPacket.facts.map((fact) => (
                        <li key={fact}>- {fact}</li>
                      ))}
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          </CardContent>
      </Card>

      <Conversation className="min-h-0 h-full">
        <ConversationContent className="gap-4 px-0 pb-4 pt-0">
          {messages.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col gap-3 px-5 py-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">What to expect</p>
                <p>1. The packet runs through input guardrails.</p>
                <p>2. If it passes, the draft runs through output safety.</p>
                <p>3. If both pass, the fake send tool pauses for approval.</p>
              </CardContent>
            </Card>
          ) : null}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return part.text ? (
                      message.role === "user" ? (
                        <p key={index}>{part.text}</p>
                      ) : (
                        <MessageResponse key={index}>{part.text}</MessageResponse>
                      )
                    ) : null;
                  }

                  if (part.type === "data-guardrail") {
                    const guardrailKey = `${part.data.packetId}:${part.data.phase}`;

                    if (renderedGuardrailKeys.has(guardrailKey)) {
                      return null;
                    }

                    renderedGuardrailKeys.add(guardrailKey);
                    return <GuardrailCard key={index} data={part.data} />;
                  }

                  if (isToolUIPart(part) && getToolName(part) === "send_protected_email") {
                    const sendPart = part as unknown as SendProtectedEmailPart;

                    if (sendPart.state === "approval-requested") {
                      return (
                        <ApprovalCard
                          key={index}
                          part={sendPart}
                          disabled={isActive || !sendPart.approval}
                          onApprove={() => {
                            if (!sendPart.approval) {
                              return;
                            }

                            addToolApprovalResponse({
                              id: sendPart.approval.id,
                              approved: true,
                            });
                          }}
                          onDeny={() => {
                            if (!sendPart.approval) {
                              return;
                            }

                            addToolApprovalResponse({
                              id: sendPart.approval.id,
                              approved: false,
                            });
                          }}
                        />
                      );
                    }

                    return <SendToolResultCard key={index} part={sendPart} />;
                  }

                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" ? (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="text-sm text-muted-foreground">
                  Running guardrails…
                </Shimmer>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>
    </main>
  );
}