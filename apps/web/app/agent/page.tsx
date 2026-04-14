"use client";

import { FormEvent, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  SearchIcon,
  CalculatorIcon,
  BrainIcon,
  CalendarIcon,
  ListIcon,
  SendIcon,
} from "lucide-react";
import type { SportsAgentUIMessage } from "@/lib/agent/sports-agent";

const transport = new DefaultChatTransport({ api: "/api/agent" });

const STARTERS = [
  "What happened in the NBA last night?",
  "Who's leading the Premier League right now?",
  "Give me the latest NFL draft news",
  "What are today's top sports stories?",
];

const TOOL_META: Record<string, { icon: typeof SearchIcon; label: string; color: string }> = {
  web_search: { icon: SearchIcon, label: "Web Search", color: "bg-blue-100 text-blue-700" },
  get_current_date: { icon: CalendarIcon, label: "Date", color: "bg-amber-100 text-amber-700" },
  calculate_stats: { icon: CalculatorIcon, label: "Calculate", color: "bg-emerald-100 text-emerald-700" },
  remember: { icon: BrainIcon, label: "Remember", color: "bg-purple-100 text-purple-700" },
  recall: { icon: BrainIcon, label: "Recall", color: "bg-purple-100 text-purple-700" },
  list_memories: { icon: ListIcon, label: "Memories", color: "bg-purple-100 text-purple-700" },
};

function ToolCallCard({ name, args, result }: { name: string; args: unknown; result: unknown }) {
  const meta = TOOL_META[name] ?? { icon: BrainIcon, label: name, color: "bg-gray-100 text-gray-700" };
  const Icon = meta.icon;
  const [open, setOpen] = useState(false);

  // Extract a summary line from common tool calls
  let summary = "";
  if (name === "web_search" && typeof args === "object" && args && "query" in args) {
    summary = String((args as { query: string }).query);
  } else if (name === "calculate_stats" && typeof args === "object" && args && "operation" in args) {
    const a = args as { operation: string; values: number[] };
    summary = `${a.operation}(${a.values?.join(", ")})`;
  } else if ((name === "remember" || name === "recall") && typeof args === "object" && args && "key" in args) {
    summary = String((args as { key: string }).key);
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2"
        onClick={() => setOpen(!open)}
      >
        <Icon className="size-3.5 shrink-0" />
        <Badge variant="secondary" className={`text-[10px] font-medium ${meta.color}`}>
          {meta.label}
        </Badge>
        {summary && (
          <span className="truncate text-muted-foreground">{summary}</span>
        )}
        <span className="ml-auto text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>
      {open && result != null && (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px] text-muted-foreground">
          {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AgentPage() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat<SportsAgentUIMessage>({
    transport,
  });

  const isActive = status === "submitted" || status === "streaming";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isActive) return;
    setInput("");
    sendMessage({ text });
  }

  function handleStarter(text: string) {
    if (isActive) return;
    setInput("");
    sendMessage({ text });
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col gap-10 px-6 pb-4 pt-12 sm:px-12 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      {/* Header */}
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Sports news agent
        </h1>
        <p className="text-sm text-muted-foreground">
          ReAct agent with web search, calculator, and persistent memory
        </p>
      </header>

      {/* Messages */}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 px-0 pb-4 pt-0">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3 pt-8">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStarter(s)}
                    className="rounded-lg border border-border bg-white px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <Message key={msg.id} from={msg.role}>
              <MessageContent>
                {msg.parts.map((part, i) => {
                  if (part.type === "text") {
                    return part.text ? (
                      msg.role === "user" ? (
                        <p key={i}>{part.text}</p>
                      ) : (
                        <MessageResponse key={i}>
                          {part.text}
                        </MessageResponse>
                      )
                    ) : null;
                  }
                  if (isToolUIPart(part)) {
                    const toolName = getToolName(part);
                    return (
                      <ToolCallCard
                        key={i}
                        name={toolName}
                        args={part.input}
                        result={
                          part.state === "output-available"
                            ? part.output
                            : undefined
                        }
                      />
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="text-sm text-muted-foreground">
                  Thinking…
                </Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      {/* Input */}
      <Card className="shrink-0 border-0 bg-white shadow-sm ring-0">
        <CardContent className="p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder="Ask about sports news, scores, or stats…"
              className="min-h-10 flex-1 resize-none text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isActive || !input.trim()}
              className="shrink-0"
            >
              <SendIcon className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
