"use client";

import { FormEvent, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import {
  BotIcon,
  ListIcon,
  SearchIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

const transport = new DefaultChatTransport({ api: "/api/mcp-agent" });

const STARTERS = [
  "What joke categories are available?",
  "Tell me a random joke.",
  "Give me a random science joke.",
  "Search for jokes about computers.",
];

const TOOL_META: Record<
  string,
  { icon: typeof SearchIcon; label: string; color: string }
> = {
  list_categories: {
    icon: ListIcon,
    label: "Categories",
    color: "bg-sky-100 text-sky-700",
  },
  get_random_joke: {
    icon: SparklesIcon,
    label: "Random Joke",
    color: "bg-amber-100 text-amber-800",
  },
  search_jokes: {
    icon: SearchIcon,
    label: "Search",
    color: "bg-emerald-100 text-emerald-700",
  },
};

function ToolCallCard({ name, args, result }: { name: string; args: unknown; result: unknown }) {
  const meta = TOOL_META[name] ?? {
    icon: BotIcon,
    label: name,
    color: "bg-stone-100 text-stone-700",
  };
  const Icon = meta.icon;
  const [open, setOpen] = useState(false);

  let summary = "";

  if (name === "search_jokes" && typeof args === "object" && args && "query" in args) {
    summary = String((args as { query: string }).query);
  } else if (
    name === "get_random_joke" &&
    typeof args === "object" &&
    args &&
    "category" in args &&
    (args as { category?: string }).category
  ) {
    summary = String((args as { category?: string }).category);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon className="size-3.5 shrink-0" />
        <Badge variant="secondary" className={`text-[10px] font-medium ${meta.color}`}>
          {meta.label}
        </Badge>
        {summary ? <span className="truncate text-muted-foreground">{summary}</span> : null}
        <span className="ml-auto text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>
      {open && result != null ? (
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-2 text-[11px] text-muted-foreground">
          {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export default function McpPage() {
  const [input, setInput] = useState("");
  const [discoveredTools, setDiscoveredTools] = useState<string[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const { messages, sendMessage, status } = useChat({ transport });
  const isActive = status === "submitted" || status === "streaming";

  useEffect(() => {
    let cancelled = false;

    async function loadTools() {
      try {
        const response = await fetch("/api/mcp-tools", { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; tools?: string[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to discover tools.");
        }

        if (!cancelled) {
          setDiscoveredTools(payload.tools ?? []);
          setDiscoveryError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setDiscoveryError(
            error instanceof Error ? error.message : "Failed to discover tools."
          );
        }
      }
    }

    loadTools();

    return () => {
      cancelled = true;
    };
  }, []);

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
    <main className="mx-auto flex h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col gap-8 px-6 pb-4 pt-12 sm:px-12 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          MCP joke agent
        </h1>
        <p className="text-sm text-muted-foreground">
          ToolLoopAgent using runtime-discovered MCP tools from an HTTP MCP server that wraps the Chuck Norris API.
        </p>
        <p className="text-xs text-muted-foreground">
          UI -&gt; agent route -&gt; ToolLoopAgent -&gt; MCP client -&gt; MCP server -&gt; Chuck Norris API
        </p>
      </header>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <WandSparklesIcon className="size-4" />
            Discovered MCP tools
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {discoveryError ? (
            <p className="text-sm text-destructive">{discoveryError}</p>
          ) : discoveredTools.length > 0 ? (
            discoveredTools.map((toolName) => (
              <Badge key={toolName} variant="secondary" className="bg-stone-100 text-stone-700">
                {toolName}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Discovering tools…</p>
          )}
        </CardContent>
      </Card>

      <Conversation className="min-h-0 flex-1">
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

                  if (isToolUIPart(part)) {
                    const toolName = getToolName(part);

                    return (
                      <ToolCallCard
                        key={index}
                        name={toolName}
                        args={part.input}
                        result={
                          part.state === "output-available" ? part.output : undefined
                        }
                      />
                    );
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
                  Discovering tools and thinking…
                </Shimmer>
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
              placeholder="Ask for categories, search jokes, or request a random joke…"
              className="min-h-10 flex-1 resize-none text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isActive || !input.trim()}
              className="shrink-0"
            >
              Ask agent
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}