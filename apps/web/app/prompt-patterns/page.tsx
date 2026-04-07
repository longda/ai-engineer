"use client";

import { FormEvent, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { BrainIcon, ShuffleIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Starter questions — random one selected on each page load
// ---------------------------------------------------------------------------

const STARTER_QUESTIONS = [
  "Why do stars twinkle but planets don't?",
  "What would happen to Earth if the Moon suddenly disappeared?",
  "How can a black hole bend time itself?",
  "Why do neutron stars spin hundreds of times per second?",
  "What makes the cosmic microwave background the oldest light we can see?",
];

function pickRandom(current?: string) {
  const pool = current
    ? STARTER_QUESTIONS.filter((q) => q !== current)
    : STARTER_QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ---------------------------------------------------------------------------
// CoT response parser — splits streaming text into thinking steps + answer
// ---------------------------------------------------------------------------

function parseCotResponse(text: string) {
  const thinkingMatch = text.match(
    /\*\*Thinking\*\*\s*([\s\S]*?)(?:\*\*Answer\*\*|$)/
  );
  const answerMatch = text.match(/\*\*Answer\*\*\s*([\s\S]*)/);

  const thinkingText = thinkingMatch?.[1]?.trim() ?? "";
  const answerText = answerMatch?.[1]?.trim() ?? "";

  const steps = thinkingText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, ""));

  return { steps, answerText, hasAnswer: !!answerMatch };
}

// ---------------------------------------------------------------------------
// Transports — one per prompt pattern, created at module scope
// ---------------------------------------------------------------------------

const zeroShotTransport = new DefaultChatTransport({
  api: "/api/prompt-patterns",
  body: { pattern: "zero-shot" },
});

const fewShotTransport = new DefaultChatTransport({
  api: "/api/prompt-patterns",
  body: { pattern: "few-shot" },
});

const cotTransport = new DefaultChatTransport({
  api: "/api/prompt-patterns",
  body: { pattern: "chain-of-thought" },
});

// ---------------------------------------------------------------------------
// Tool demo types (unchanged)
// ---------------------------------------------------------------------------

type ToolDemoResponse = {
  answer: string;
  toolCalls: Array<{ toolName: string; input: unknown }>;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PromptPatternsPage() {
  // -- Comparison state --
  const [question, setQuestion] = useState(() => pickRandom());

  const zeroShot = useChat({ id: "zero-shot", transport: zeroShotTransport });
  const fewShot = useChat({ id: "few-shot", transport: fewShotTransport });
  const cot = useChat({ id: "chain-of-thought", transport: cotTransport });

  const lanes = [
    { label: "Zero-shot", chat: zeroShot },
    { label: "Few-shot", chat: fewShot },
    { label: "Chain-of-thought", chat: cot },
  ] as const;

  const isAnyRunning = lanes.some(
    ({ chat }) => chat.status === "submitted" || chat.status === "streaming"
  );

  function runComparison(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || isAnyRunning) return;

    for (const { chat } of lanes) {
      chat.setMessages([]);
      chat.sendMessage({ text });
    }
  }

  // -- Tool-calling state (unchanged) --
  const [toolPrompt, setToolPrompt] = useState(
    "Count the words in this sentence and then multiply the count by 2: I love building AI features with TypeScript."
  );
  const [toolResult, setToolResult] = useState<ToolDemoResponse | null>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRunToolDemo = useMemo(
    () => toolPrompt.trim().length > 0 && !toolLoading,
    [toolPrompt, toolLoading]
  );

  async function runToolDemo(event: FormEvent) {
    event.preventDefault();
    if (!toolPrompt.trim()) return;

    setToolLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tool-calling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: toolPrompt.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to run tool-calling demo.");
        return;
      }

      setToolResult(data);
    } catch {
      setError("Network error while running tool-calling demo.");
    } finally {
      setToolLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12 sm:px-12 sm:pb-32 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Prompt pattern lab
        </h1>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <Tabs defaultValue="comparison" className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold sm:text-xl">Demo</h2>
          <TabsList
            variant="line"
            className="h-auto w-full max-w-md flex-wrap p-1 sm:w-auto"
          >
            <TabsTrigger value="comparison" className="flex-1 sm:flex-none">
              Comparison
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex-1 sm:flex-none">
              Tool calling
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Comparison tab — 3 streaming useChat lanes                       */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="comparison" className="mt-0 outline-none">
          <div className="flex flex-col gap-6">
            <Card className="border-0 bg-white shadow-sm ring-0">
              <CardHeader>
                <CardTitle>Zero-shot · Few-shot · Chain-of-thought</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <form
                  onSubmit={runComparison}
                  className="flex flex-col gap-4"
                >
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                    placeholder="Enter a question to compare across all three prompt patterns…"
                    className="min-h-24 resize-y text-base leading-relaxed"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isAnyRunning || !question.trim()}
                      className="w-auto"
                    >
                      {isAnyRunning ? "Running…" : "Run comparison"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={isAnyRunning}
                      onClick={() => setQuestion(pickRandom(question))}
                      className="w-auto gap-2"
                    >
                      <ShuffleIcon className="size-4" />
                      New question
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-3">
              {lanes.map(({ label, chat }) => {
                const assistantMessages = chat.messages.filter(
                  (m) => m.role === "assistant"
                );
                const hasContent = assistantMessages.length > 0;
                const isLoading = chat.status === "submitted";
                const isStreaming = chat.status === "streaming";
                const isCot = label === "Chain-of-thought";

                return (
                  <Card
                    key={label}
                    className="flex flex-col border-0 bg-white shadow-sm ring-0"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        {label}
                        {isStreaming && (
                          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-30 pt-0">
                      {isLoading && (
                        <Shimmer className="text-sm text-muted-foreground">
                          Thinking…
                        </Shimmer>
                      )}

                      {/* --- CoT lane: ChainOfThought + answer --- */}
                      {isCot && hasContent &&
                        assistantMessages.map((message) => {
                          const fullText = message.parts
                            .filter((p) => p.type === "text")
                            .map((p) => (p as { type: "text"; text: string }).text)
                            .join("");
                          const { steps, answerText, hasAnswer } =
                            parseCotResponse(fullText);

                          return (
                            <div
                              key={message.id}
                              className="flex flex-col gap-3"
                            >
                              {steps.length > 0 && (
                                <ChainOfThought defaultOpen>
                                  <ChainOfThoughtHeader>
                                    Reasoning
                                  </ChainOfThoughtHeader>
                                  <ChainOfThoughtContent>
                                    {steps.map((step, i) => (
                                      <ChainOfThoughtStep
                                        key={i}
                                        icon={BrainIcon}
                                        label={step}
                                        status={
                                          hasAnswer
                                            ? "complete"
                                            : i === steps.length - 1
                                              ? "active"
                                              : "complete"
                                        }
                                      />
                                    ))}
                                  </ChainOfThoughtContent>
                                </ChainOfThought>
                              )}
                              {answerText && (
                                <Message
                                  from="assistant"
                                  className="max-w-full"
                                >
                                  <MessageContent>
                                    <MessageResponse>
                                      {answerText}
                                    </MessageResponse>
                                  </MessageContent>
                                </Message>
                              )}
                            </div>
                          );
                        })}

                      {/* --- Zero-shot / Few-shot lanes: plain response --- */}
                      {!isCot && hasContent &&
                        assistantMessages.map((message) => (
                          <Message
                            from="assistant"
                            key={message.id}
                            className="max-w-full"
                          >
                            <MessageContent>
                              {message.parts.map((part, i) =>
                                part.type === "text" ? (
                                  <MessageResponse
                                    key={`${message.id}-${i}`}
                                  >
                                    {part.text}
                                  </MessageResponse>
                                ) : null
                              )}
                            </MessageContent>
                          </Message>
                        ))}

                      {chat.error && (
                        <p className="text-sm text-destructive">
                          {chat.error.message}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Tool-calling tab (unchanged)                                     */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="tools" className="mt-0 outline-none">
          <Card className="border-0 bg-white shadow-sm ring-0">
            <CardHeader>
              <CardTitle>Tool calling</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-6">
              <form onSubmit={runToolDemo} className="flex flex-col gap-4">
                <Input
                  value={toolPrompt}
                  onChange={(event) => setToolPrompt(event.target.value)}
                  placeholder="Ask something that could benefit from tools…"
                  className="h-11 text-base"
                />
                <Button type="submit" size="lg" disabled={!canRunToolDemo}>
                  {toolLoading ? "Running…" : "Run tool demo"}
                </Button>
              </form>

              {toolResult ? (
                <div className="mt-2 flex flex-col gap-4">
                  <h3 className="text-base font-semibold sm:text-lg">
                    Model answer
                  </h3>
                  <Card className="border-0 bg-stone-100 shadow-none ring-0">
                    <CardContent className="pt-6">
                      <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                        {toolResult.answer}
                      </pre>
                    </CardContent>
                  </Card>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Tools used
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {toolResult.toolCalls.length > 0 ? (
                        toolResult.toolCalls.map((toolCall, index) => (
                          <Badge
                            key={`${toolCall.toolName}-${index}`}
                            variant="secondary"
                            className="rounded-md font-mono text-xs font-normal"
                          >
                            {toolCall.toolName}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="rounded-md">
                          No tool calls
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
