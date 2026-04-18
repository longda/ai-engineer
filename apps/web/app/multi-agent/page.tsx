"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import {
  BadgeCheckIcon,
  BotIcon,
  FileSearchIcon,
  FileTextIcon,
  LinkIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { MultiAgentUIMessage } from "@/lib/multi-agent/agents";
import type {
  TrendReport,
  VerificationResult,
} from "@/lib/multi-agent/schemas";
import { TOPIC_LABELS, TOPIC_OPTIONS, topicSchema } from "@/lib/multi-agent/topics";

const transport = new DefaultChatTransport({ api: "/api/multi-agent" });

const TOOL_META: Record<
  string,
  { icon: typeof FileSearchIcon; label: string; color: string }
> = {
  research_topic: {
    icon: FileSearchIcon,
    label: "Research",
    color: "bg-sky-100 text-sky-700",
  },
  verify_research_packet: {
    icon: BadgeCheckIcon,
    label: "Verify",
    color: "bg-emerald-100 text-emerald-700",
  },
  generate_trend_report: {
    icon: FileTextIcon,
    label: "Report",
    color: "bg-amber-100 text-amber-800",
  },
};

const X_POST_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

function isXPostUrl(url: string) {
  try {
    return X_POST_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function getEvidenceLabel(handle: string, postUrl: string) {
  return isXPostUrl(postUrl) ? handle : handle.replace(/^@/, "");
}

function ToolCallCard({ name, args, result }: { name: string; args: unknown; result: unknown }) {
  const meta = TOOL_META[name] ?? {
    icon: BotIcon,
    label: name,
    color: "bg-stone-100 text-stone-700",
  };
  const Icon = meta.icon;

  let summary = "";
  if (name === "research_topic" && typeof args === "object" && args && "topic" in args) {
    summary = `topic: ${String((args as { topic: string }).topic)}`;
  } else if (name === "verify_research_packet") {
    summary = "checking source URLs + evidence quality";
  } else if (name === "generate_trend_report") {
    summary = "assembling final report";
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 shrink-0" />
        <Badge variant="secondary" className={`text-[10px] font-medium ${meta.color}`}>
          {meta.label}
        </Badge>
        {summary ? <span className="truncate text-muted-foreground">{summary}</span> : null}
      </div>
      {result != null ? (
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-2 text-[11px] text-muted-foreground">
          {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function getLatestToolOutput<T>(
  messages: MultiAgentUIMessage[],
  toolName: string
): T | null {
  for (const message of [...messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (
        isToolUIPart(part) &&
        getToolName(part) === toolName &&
        part.state === "output-available"
      ) {
        return part.output as T;
      }
    }
  }

  return null;
}

function getSelectedTopic(messages: MultiAgentUIMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") {
      continue;
    }

    for (const part of message.parts) {
      if (part.type !== "text") {
        continue;
      }

      const parsed = topicSchema.safeParse(part.text.trim().toLowerCase());
      if (parsed.success) {
        return parsed.data;
      }
    }
  }

  return null;
}

export default function MultiAgentPage() {
  const { messages, sendMessage, setMessages, status } = useChat<MultiAgentUIMessage>({
    transport,
  });

  const isRunning = status === "submitted" || status === "streaming";
  const latestVerification = getLatestToolOutput<VerificationResult>(
    messages,
    "verify_research_packet"
  );
  const latestReport = getLatestToolOutput<TrendReport>(
    messages,
    "generate_trend_report"
  );
  const selectedTopic = getSelectedTopic(messages);
  const showVerification = latestVerification && !latestReport;

  function handleTopicClick(topic: (typeof TOPIC_OPTIONS)[number]) {
    if (isRunning) return;
    setMessages([]);
    sendMessage({ text: topic });
  }

  function handleReset() {
    if (isRunning) return;
    setMessages([]);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col gap-10 px-6 pb-10 pt-12 sm:px-12 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Multi-agent trend report
        </h1>
        <p className="text-sm text-muted-foreground">
          Planner-worker orchestration with X research, verification checkpoints,
          and a structured report output.
        </p>
      </header>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Choose a topic</CardTitle>
            {selectedTopic ? (
              <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                {TOPIC_LABELS[selectedTopic]}
              </Badge>
            ) : null}
          </div>
          {messages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isRunning}
              onClick={handleReset}
            >
              Reset
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {TOPIC_OPTIONS.map((topic) => (
            <Button
              key={topic}
              type="button"
              variant={selectedTopic === topic ? "default" : "outline"}
              disabled={isRunning}
              onClick={() => handleTopicClick(topic)}
              className="rounded-full px-4"
            >
              {TOPIC_LABELS[topic]}
            </Button>
          ))}
          {messages.length > 0 && !isRunning ? (
            <p className="basis-full pt-1 text-xs text-muted-foreground">
              Choose another topic to run again, or reset to return to the initial state.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showVerification ? (
        <Card className="border-0 bg-white shadow-sm ring-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Verification checkpoint</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0 text-sm">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={
                  latestVerification.verdict === "pass"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-800"
                }
              >
                {latestVerification.verdict === "pass"
                  ? "Passed"
                  : "Retry requested"}
              </Badge>
              <span className="text-muted-foreground">
                {latestVerification.validSourceCount} reachable source URLs
              </span>
            </div>
            <p className="text-muted-foreground">{latestVerification.summary}</p>
            {latestVerification.issues.length > 0 ? (
              <ul className="space-y-1 text-muted-foreground">
                {latestVerification.issues.map((issue) => (
                  <li key={issue}>- {issue}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {latestReport ? (
        <Card className="overflow-hidden border-0 bg-white shadow-sm ring-0">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Structured report</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRunning}
              onClick={handleReset}
            >
              Start over
            </Button>
          </CardHeader>
          <CardContent className="flex max-h-[70vh] min-w-0 flex-col gap-5 overflow-x-hidden overflow-y-auto pr-2 pt-0">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">{latestReport.title}</h2>
              <p className="text-sm text-muted-foreground">{latestReport.dek}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Executive summary
              </h3>
              <p className="text-sm leading-7 text-foreground">
                {latestReport.executiveSummary}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Key themes
              </h3>
              {latestReport.keyThemes.map((theme) => (
                <div key={theme.title} className="rounded-xl border border-border/60 p-4">
                  <h4 className="font-semibold">{theme.title}</h4>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {theme.summary}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {theme.evidence.map((evidence, index) => (
                      <a
                        key={`${theme.title}-${evidence.handle}-${evidence.postUrl}-${index}`}
                        href={evidence.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-foreground transition-colors hover:bg-stone-100"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {getEvidenceLabel(evidence.handle, evidence.postUrl)}
                          </span>
                          {!isXPostUrl(evidence.postUrl) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                              <LinkIcon className="size-3" />
                              Citation
                            </span>
                          ) : null}
                        </div>
                        <span className="mt-1 block text-muted-foreground">
                          {evidence.whyItMatters}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Supporting data
              </h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {latestReport.supportingData.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 px-0 pb-4 pt-0">
          {messages.length === 0 ? (
            <Card className="border-dashed bg-stone-50/80 shadow-none">
              <CardContent className="flex flex-col gap-3 p-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <SparklesIcon className="size-4" />
                  <span className="font-medium">What this demo runs</span>
                </div>
                <p>
                  Planner agent scopes the work, the xAI research agent gathers
                  current X signals, the verifier checks URLs and evidence, then
                  the report agent formats the final brief.
                </p>
                <p>
                  The API only accepts the approved topic set, so this route stays
                  constrained to the demo scenario.
                </p>
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
                        <div key={index} className="flex items-center gap-2">
                          <LinkIcon className="size-3.5" />
                          <span>{TOPIC_LABELS[part.text as keyof typeof TOPIC_LABELS] ?? part.text}</span>
                        </div>
                      ) : (
                        <MessageResponse key={index}>{part.text}</MessageResponse>
                      )
                    ) : null;
                  }

                  if (isToolUIPart(part)) {
                    const toolName = getToolName(part);
                    return (
                      <ToolCallCard
                        key={index}
                        name={toolName}
                        args={part.input}
                        result={part.state === "output-available" ? part.output : undefined}
                      />
                    );
                  }

                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {isRunning ? (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="text-sm text-muted-foreground">
                  Planning, researching, verifying sources, and drafting the report…
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