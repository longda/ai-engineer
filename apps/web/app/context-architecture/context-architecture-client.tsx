"use client";

import { FormEvent, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FileTextIcon,
  FilterIcon,
  Layers3Icon,
  LoaderCircleIcon,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTEXT_ARCHITECTURE_DEFAULT_TOKEN_BUDGET,
} from "@/lib/context-architecture/types";
import type {
  ContextArchitectureFilterOptions,
  ContextArchitectureMeasurePacket,
  ContextArchitecturePacket,
  ContextArchitectureSourceProfile,
} from "@/lib/context-architecture/types";
import type { RagRetrievalMode } from "@/lib/rag/types";

const RETRIEVAL_MODES: Array<{ value: RagRetrievalMode; label: string }> = [
  { value: "vector-only", label: "Vector only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "hybrid-rerank", label: "Hybrid + rerank" },
];

const STARTERS = [
  "What are map conditions in ARC Raiders?",
  "What is the Acoustic Guitar item in ARC Raiders?",
  "What change records are available from ARC Raiders patch notes?",
  "Which source type should I trust for a materials lookup?",
];

function isContextArchitectureDataPart(
  part: unknown
): part is { type: "data-context-architecture"; data: ContextArchitecturePacket } {
  if (!part || typeof part !== "object") {
    return false;
  }

  const candidate = part as { type?: unknown; data?: unknown };
  return candidate.type === "data-context-architecture" && Boolean(candidate.data);
}

function formatRetrievalMode(mode: RagRetrievalMode) {
  return RETRIEVAL_MODES.find((option) => option.value === mode)?.label ?? mode;
}

function formatSourceType(value: string) {
  return value.replaceAll("_", " ");
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ContextArchitectureCard({ packet }: { packet: ContextArchitecturePacket }) {
  const selectedSourceMap = new Map(
    packet.contextPack.selectedSources.map((source) => [source.sourceId, source])
  );

  return (
    <Card className="border border-stone-200 bg-stone-50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers3Icon className="size-4" />
          Context packet
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-stone-900 text-white">
            {packet.sourceProfileLabel}
          </Badge>
          <Badge variant="secondary" className="bg-stone-100 text-stone-700">
            {formatRetrievalMode(packet.retrievalMode)}
          </Badge>
          <Badge variant="secondary" className="bg-stone-100 text-stone-700">
            budget {packet.tokenBudget} tokens
          </Badge>
        </div>

        {packet.sessionContext ? (
          <div className="rounded-xl border border-black/5 bg-white px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Per-session task context
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {packet.sessionContext}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-black/5 bg-white px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Selected context pack</Badge>
            <Badge variant="secondary" className="bg-stone-100 text-stone-700">
              {packet.contextPack.totalEstimatedTokens} estimated tokens
            </Badge>
            <Badge variant={packet.contextPack.fitsBudget ? "secondary" : "destructive"}>
              {packet.contextPack.fitsBudget ? "Fits budget" : "Over budget"}
            </Badge>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {packet.selectedCitations.map((citation, index) => {
              const selection = selectedSourceMap.get(citation.chunkId);

              return (
                <div key={citation.chunkId} className="rounded-lg border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">[{index + 1}]</Badge>
                    <Badge variant="outline">{formatSourceType(citation.sourceType)}</Badge>
                    <Badge variant="outline">{citation.entityType}</Badge>
                    <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                      {selection?.estimatedTokens ?? citation.tokenEstimate} tokens
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{citation.title}</p>
                  {selection ? (
                    <p className="mt-1 text-xs text-muted-foreground">{selection.reason}</p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {citation.chunkText}
                  </p>
                </div>
              );
            })}
          </div>

          {packet.contextPack.warningFlags.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              {packet.contextPack.warningFlags.join(" ")}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-black/5 bg-white px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Retrieved candidates</Badge>
            <Badge variant="secondary" className="bg-stone-100 text-stone-700">
              {packet.retrieval.citations.length} chunks
            </Badge>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {packet.retrieval.citations.map((citation, index) => (
              <div key={citation.chunkId} className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">[{index + 1}]</Badge>
                  <Badge variant="outline">{formatSourceType(citation.sourceType)}</Badge>
                  <Badge variant="outline">{citation.contentType}</Badge>
                  <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                    score {citation.score.toFixed(3)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{citation.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Entities: {citation.entityNames.join(", ") || "none"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Topics: {citation.tags.join(", ") || "none"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MeasurementCard({ packet }: { packet: ContextArchitectureMeasurePacket }) {
  return (
    <Card className="border border-stone-200 bg-stone-50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Source-scoped precision comparison</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        {packet.scenarios.map((scenario) => (
          <div key={scenario.id} className="rounded-xl border border-black/5 bg-white px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-stone-900 text-white">
                {scenario.sourceProfileLabel}
              </Badge>
              <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                filtered {formatPercent(scenario.filteredPrecisionAt4)}
              </Badge>
              <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                unfiltered {formatPercent(scenario.unfilteredPrecisionAt4)}
              </Badge>
              <Badge variant="outline">
                delta {scenario.improvement >= 0 ? "+" : ""}
                {formatPercent(scenario.improvement)}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">{scenario.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{scenario.query}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{scenario.whyItFits}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Unfiltered top results
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {scenario.unfilteredSourceTypes.join(" -> ") || "none"}
                </p>
                <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {scenario.unfilteredTopTitles.map((title) => (
                    <p key={`${scenario.id}-unfiltered-${title}`}>{title}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Source-scoped top results
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {scenario.filteredSourceTypes.join(" -> ") || "none"}
                </p>
                <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {scenario.filteredTopTitles.map((title) => (
                    <p key={`${scenario.id}-filtered-${title}`}>{title}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ContextArchitectureClient({
  filterOptions,
}: {
  filterOptions: ContextArchitectureFilterOptions;
}) {
  const [input, setInput] = useState("");
  const [retrievalMode, setRetrievalMode] = useState<RagRetrievalMode>(
    "hybrid-rerank"
  );
  const [sourceProfile, setSourceProfile] =
    useState<ContextArchitectureSourceProfile>("all");
  const [entityName, setEntityName] = useState("");
  const [topic, setTopic] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sessionContext, setSessionContext] = useState("");
  const [tokenBudget, setTokenBudget] = useState(
    CONTEXT_ARCHITECTURE_DEFAULT_TOKEN_BUDGET
  );
  const [measurementPacket, setMeasurementPacket] =
    useState<ContextArchitectureMeasurePacket | null>(null);
  const [measurementStatus, setMeasurementStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/context-architecture",
        body: {
          retrievalMode,
          sourceProfile,
          entityName,
          topic,
          startDate,
          endDate,
          sessionContext,
          tokenBudget,
        },
      }),
    [
      endDate,
      entityName,
      retrievalMode,
      sessionContext,
      sourceProfile,
      startDate,
      tokenBudget,
      topic,
    ]
  );
  const { messages, sendMessage, status } = useChat({ transport });
  const isActive = status === "submitted" || status === "streaming";

  async function handleMeasure() {
    if (measurementStatus === "loading") {
      return;
    }

    setMeasurementStatus("loading");

    try {
      const response = await fetch("/api/context-architecture/measure", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("measurement failed");
      }

      const packet = (await response.json()) as ContextArchitectureMeasurePacket;
      setMeasurementPacket(packet);
      setMeasurementStatus("idle");
    } catch (error) {
      console.error("[context-architecture/page] measurement failed", error);
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
          ARC Raiders context architecture
        </h1>
        <p className="text-sm text-muted-foreground">
          Extends the Arc Raiders retrieval stack into a source-aware context system with metadata filters, source routing, and explicit separation between persistent game knowledge and per-session task context.
        </p>
      </header>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardContent className="flex flex-col gap-6 px-4 py-4">
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
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Source profile</p>
            <div className="flex flex-wrap gap-2">
              {filterOptions.sourceProfiles.map((profile) => (
                <Button
                  key={profile.value}
                  type="button"
                  variant={sourceProfile === profile.value ? "default" : "outline"}
                  onClick={() => setSourceProfile(profile.value)}
                  disabled={isActive}
                >
                  {profile.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {filterOptions.sourceProfiles.find((profile) => profile.value === sourceProfile)
                ?.description}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Entity filter</span>
              <Input
                value={entityName}
                onChange={(event) => setEntityName(event.target.value)}
                placeholder="Acoustic Guitar"
                list="context-architecture-entities"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Topic filter</span>
              <Input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="patch-notes"
                list="context-architecture-topics"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Published after</span>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Published before</span>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Per-session task context</span>
              <Textarea
                value={sessionContext}
                onChange={(event) => setSessionContext(event.target.value)}
                rows={3}
                placeholder="Example: I only care about patch-note changes from late 2025, and I want the answer framed for a squad planning crafting priorities tonight."
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground">Token budget</span>
              <Input
                type="number"
                min={300}
                max={4000}
                step={50}
                value={String(tokenBudget)}
                onChange={(event) => setTokenBudget(Number(event.target.value) || 300)}
              />
            </label>
          </div>

          <datalist id="context-architecture-entities">
            {filterOptions.entityNames.map((entity) => (
              <option key={entity} value={entity} />
            ))}
          </datalist>
          <datalist id="context-architecture-topics">
            {filterOptions.tags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>

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
                <FilterIcon className="size-4" />
              )}
              Compare source-scoped precision
            </Button>
            <p className="text-xs text-muted-foreground">
              Compares unfiltered retrieval against source-scoped retrieval on representative question types.
            </p>
          </div>

          {measurementStatus === "error" ? (
            <p className="text-xs text-red-600">
              The source-scoped measurement run failed. Check your retrieval or provider credentials.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {measurementPacket ? <MeasurementCard packet={measurementPacket} /> : null}

      <Conversation className="min-h-96 flex-1">
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

                  if (isContextArchitectureDataPart(part)) {
                    return <ContextArchitectureCard key={index} packet={part.data} />;
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
                  <Shimmer>Scoping sources, assembling a context pack, and drafting an answer…</Shimmer>
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
              placeholder="Ask a question, then use source, entity, topic, and date filters to control the context pack…"
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