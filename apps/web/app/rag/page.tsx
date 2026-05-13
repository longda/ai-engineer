"use client";

import { FormEvent, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FileTextIcon,
  LoaderCircleIcon,
  SearchIcon,
  SparklesIcon,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  RagContextPacket,
  RagMeasurementPacket,
  RagRetrievalMode,
} from "@/lib/rag/types";

const RETRIEVAL_MODES: Array<{ value: RagRetrievalMode; label: string }> = [
  { value: "vector-only", label: "Vector only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "hybrid-rerank", label: "Hybrid + rerank" },
];

const STARTERS = [
  "What is the Acoustic Guitar item in ARC Raiders?",
  "What category does Heavy Ammo belong to?",
  "How does Scrap Metal compare to other crafting materials in the corpus?",
  "What related ammo or materials are mentioned for a rifle item?",
];

function isRagDataPart(
  part: unknown
): part is { type: "data-rag"; data: RagContextPacket } {
  if (!part || typeof part !== "object") {
    return false;
  }

  const candidate = part as { type?: unknown; data?: unknown };

  return candidate.type === "data-rag" && Boolean(candidate.data);
}

function formatRetrievalMode(mode: RagRetrievalMode) {
  return RETRIEVAL_MODES.find((option) => option.value === mode)?.label ?? mode;
}

function RetrievalCard({ packet }: { packet: RagContextPacket }) {
  return (
    <Card className="border border-stone-200 bg-stone-50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <SearchIcon className="size-4" />
          Retrieval snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-stone-900 text-white">
            {formatRetrievalMode(packet.retrievalMode)}
          </Badge>
          <Badge variant="secondary" className="bg-stone-100 text-stone-700">
            {packet.citations.length} context chunks
          </Badge>
        </div>

        {packet.citations.map((citation, index) => (
          <div
            key={citation.chunkId}
            className="rounded-xl border border-black/5 bg-white px-3 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">[{index + 1}]</Badge>
              <Badge variant="outline">{citation.sourceType}</Badge>
              <Badge variant="outline">{citation.entityType}</Badge>
              <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                score {citation.score.toFixed(3)}
              </Badge>
              {citation.vectorRank ? (
                <Badge variant="outline">vector #{citation.vectorRank}</Badge>
              ) : null}
              {citation.keywordRank ? (
                <Badge variant="outline">bm25 #{citation.keywordRank}</Badge>
              ) : null}
              {citation.rerankScore != null ? (
                <Badge variant="outline">
                  rerank {citation.rerankScore.toFixed(3)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{citation.title}</p>
            {citation.entityNames.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Entities: {citation.entityNames.join(", ")}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {citation.chunkText}
            </p>
            <a
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs text-muted-foreground hover:text-foreground"
            >
              {citation.url}
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MeasurementCard({ packet }: { packet: RagMeasurementPacket }) {
  return (
    <Card className="border border-stone-200 bg-stone-50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Same-query retrieval comparison</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {packet.queries.map((query) => {
          const rows = packet.rows.filter((row) => row.query === query);

          return (
            <div key={query} className="rounded-xl border border-black/5 bg-white px-3 py-3">
              <p className="text-sm font-medium text-foreground">{query}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {rows.map((row) => (
                  <div key={`${row.query}-${row.retrievalMode}`} className="rounded-lg border border-stone-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="bg-stone-900 text-white">
                        {formatRetrievalMode(row.retrievalMode)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {row.citationCount} chunks
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
                      {row.topTitles.map((title) => (
                        <p key={`${row.retrievalMode}-${title}`}>{title}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function RagPage() {
  const [input, setInput] = useState("");
  const [retrievalMode, setRetrievalMode] = useState<RagRetrievalMode>(
    "hybrid-rerank"
  );
  const [measurementPacket, setMeasurementPacket] =
    useState<RagMeasurementPacket | null>(null);
  const [measurementStatus, setMeasurementStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/rag",
        body: { retrievalMode },
      }),
    [retrievalMode]
  );
  const { messages, sendMessage, status } = useChat({ transport });
  const isActive = status === "submitted" || status === "streaming";

  async function handleMeasure() {
    if (measurementStatus === "loading") {
      return;
    }

    setMeasurementStatus("loading");

    try {
      const response = await fetch("/api/rag/measure", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("measurement failed");
      }

      const packet = (await response.json()) as RagMeasurementPacket;
      setMeasurementPacket(packet);
      setMeasurementStatus("idle");
    } catch (error) {
      console.error("[rag/page] measurement failed", error);
      setMeasurementStatus("error");
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();

    if (!text || isActive) {
      return;
    }

    setInput("");
    sendMessage({ text });
  }

  function handleStarter(text: string) {
    if (isActive) {
      return;
    }

    setInput("");
    sendMessage({ text });
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col gap-8 px-6 pb-4 pt-12 sm:px-12 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          ARC Raiders RAG pipeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Supports a measurable path from vector-only retrieval to BM25 plus RRF hybrid retrieval and optional Cohere reranking over the same Arc Raiders corpus.
        </p>
      </header>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardContent className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Retrieval mode</p>
            <div className="flex flex-wrap gap-2">
              {RETRIEVAL_MODES.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={retrievalMode === option.value ? "default" : "outline"}
                  onClick={() => setRetrievalMode(option.value)}
                  disabled={isActive}
                  className="min-w-32"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Run the same prompt through the baseline, hybrid retrieval, or hybrid plus rerank pipeline and inspect the retrieval packet directly in the transcript.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleMeasure}
              disabled={measurementStatus === "loading"}
            >
              {measurementStatus === "loading" ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <SearchIcon className="size-4" />
              )}
              Compare retrieval modes
            </Button>
            <p className="text-xs text-muted-foreground">
              Uses the built-in evaluation question set to compare vector-only, hybrid, and hybrid plus rerank retrieval on the same corpus.
            </p>
          </div>

          {measurementStatus === "error" ? (
            <p className="text-xs text-red-600">
              The measurement run failed. Check your retrieval and provider credentials.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {measurementPacket ? <MeasurementCard packet={measurementPacket} /> : null}

      <Conversation className="min-h-[24rem] flex-1">
        <ConversationContent className="gap-4 px-0 pb-4 pt-0">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3 pt-4">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => handleStarter(starter)}
                    className="rounded-lg border border-border bg-white px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
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

                  if (isRagDataPart(part)) {
                    return <RetrievalCard key={index} packet={part.data} />;
                  }

                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" ? (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <SparklesIcon className="size-4" />
                  <Shimmer>Retrieving evidence and drafting an answer…</Shimmer>
                </div>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <Card className="shrink-0 border-0 bg-white shadow-sm ring-0">
        <CardContent className="p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
              rows={1}
              placeholder="Ask about ARC Raiders items, ammo, materials, or inventory categories…"
              className="min-h-10 flex-1 resize-none text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isActive || !input.trim()}
              className="shrink-0"
            >
              <FileTextIcon className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}