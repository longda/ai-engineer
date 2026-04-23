"use client";

import { FormEvent, useState } from "react";
import {
  BotIcon,
  BracesIcon,
  FileStackIcon,
  PlayIcon,
  ShieldAlertIcon,
  WandSparklesIcon,
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
import {
  DEFAULT_PROMPT_ID,
  PROMPT_CATALOG,
  PROMPT_CATALOG_BY_ID,
  type PromptCatalogItem,
  type PromptId,
} from "@/lib/specification/catalog";
import { cn } from "@/lib/utils";

type RunContext = {
  promptId: PromptId;
  input: string;
};

type RunResponse = {
  promptId: PromptId;
  model: string;
  object: unknown;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  warnings?: unknown;
  error?: string;
};

function formatLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function UsagePill({ label, value }: { label: string; value?: number }) {
  if (typeof value !== "number") {
    return null;
  }

  return (
    <Badge variant="secondary" className="bg-stone-100 text-stone-700">
      {label}: {value}
    </Badge>
  );
}

function StructuredValue({ value }: { value: unknown }) {
  if (value == null || value === "") {
    return <p className="text-sm text-muted-foreground">None</p>;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {String(value)}
      </p>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="text-sm text-muted-foreground">None</p>;
    }

    const primitiveItems = value.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
    );

    if (primitiveItems) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item, index) => (
            <Badge key={`${item}-${index}`} variant="secondary" className="bg-stone-100 text-stone-700">
              {String(item)}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-border/60 bg-background/80 p-3"
          >
            <StructuredValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="grid gap-2">
        {Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => (
          <div
            key={key}
            className="rounded-xl border border-border/60 bg-background/80 p-3"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {formatLabel(key)}
            </p>
            <div className="mt-2">
              <StructuredValue value={nestedValue} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function PromptPickerButton({
  prompt,
  isSelected,
  onSelect,
}: {
  prompt: PromptCatalogItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "flex min-w-80 max-w-sm flex-none snap-start flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition-colors",
        isSelected
          ? "border-stone-900 bg-stone-900 text-white shadow-sm"
          : "border-border/70 bg-white text-foreground hover:bg-stone-50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold leading-tight">{prompt.title}</p>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0",
            isSelected ? "bg-white/15 text-white" : "bg-stone-100 text-stone-700"
          )}
        >
          {prompt.version}
        </Badge>
      </div>
      <p
        className={cn(
          "text-xs leading-relaxed",
          isSelected ? "text-white/80" : "text-muted-foreground"
        )}
      >
        {prompt.summary}
      </p>
    </button>
  );
}

export default function SpecificationPrecisionPage() {
  const [selectedPromptId, setSelectedPromptId] =
    useState<PromptId>(DEFAULT_PROMPT_ID);
  const [input, setInput] = useState(
    PROMPT_CATALOG_BY_ID[DEFAULT_PROMPT_ID].sampleInput
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runContext, setRunContext] = useState<RunContext | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  const selectedPrompt = PROMPT_CATALOG_BY_ID[selectedPromptId];
  const lastRunPrompt = runContext ? PROMPT_CATALOG_BY_ID[runContext.promptId] : null;

  function handleSelectPrompt(promptId: PromptId) {
    const prompt = PROMPT_CATALOG_BY_ID[promptId];

    setSelectedPromptId(promptId);
    setInput(prompt.sampleInput);
    setError(null);
    setRunContext(null);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();

    if (!text || isRunning) {
      return;
    }

    const nextRunContext: RunContext = {
      promptId: selectedPrompt.id,
      input: text,
    };

    setIsRunning(true);
    setError(null);
    setRunContext(nextRunContext);
    setResult(null);

    try {
      const response = await fetch("/api/specification-precision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextRunContext),
      });

      const payload = (await response.json()) as RunResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "The structured output run failed.");
      }

      setResult(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The structured output run failed."
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-6 pb-24 pt-12 sm:px-10 sm:pb-28 sm:pt-16 md:px-14 lg:px-20 xl:px-24 2xl:px-28">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Specification precision lab
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Inspect system prompts, select one contract at a time, and run it
          through a Zod-validated structured-output route powered by
          generateText with Output.object.
        </p>
      </header>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileStackIcon className="size-4" />
              Prompt library
            </CardTitle>
            <Badge variant="secondary" className="bg-stone-100 text-stone-700">
              {PROMPT_CATALOG.length} prompts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <p className="max-w-3xl text-sm text-muted-foreground">
            {PROMPT_CATALOG.length} versioned prompts, each with constraints,
            edge cases, escalation rules, and a structured output contract.
          </p>
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <div className="flex min-w-full gap-3 snap-x snap-mandatory">
              {PROMPT_CATALOG.map((prompt) => (
                <PromptPickerButton
                  key={prompt.id}
                  prompt={prompt}
                  isSelected={prompt.id === selectedPromptId}
                  onSelect={() => handleSelectPrompt(prompt.id)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-2xl">{selectedPrompt.title}</CardTitle>
            <Badge variant="secondary" className="bg-stone-100 text-stone-700">
              {selectedPrompt.version}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {selectedPrompt.summary}
          </p>
          <p className="text-xs text-muted-foreground">
            Source: {selectedPrompt.libraryPath}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-stone-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Role
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {selectedPrompt.role}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-stone-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Constraints
            </p>
            <ul className="mt-2 flex list-none flex-col gap-2 text-sm leading-relaxed text-foreground">
              {selectedPrompt.constraints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/60 bg-stone-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Edge cases
            </p>
            <ul className="mt-2 flex list-none flex-col gap-2 text-sm leading-relaxed text-foreground">
              {selectedPrompt.edgeCases.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/60 bg-stone-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Escalation rules
            </p>
            <ul className="mt-2 flex list-none flex-col gap-2 text-sm leading-relaxed text-foreground">
              {selectedPrompt.escalationRules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BracesIcon className="size-4" />
            Output contract
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 md:grid-cols-2 xl:grid-cols-3">
          {selectedPrompt.outputFields.map((field) => (
            <div
              key={field.name}
              className="rounded-2xl border border-border/60 bg-stone-50 p-4"
            >
              <p className="text-sm font-semibold text-foreground">
                {field.name}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {field.description}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <WandSparklesIcon className="size-4" />
            System prompt
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-border/60 bg-stone-50 p-4 text-xs leading-relaxed text-foreground">
            {selectedPrompt.systemPrompt}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayIcon className="size-4" />
            Run structured output
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={9}
              placeholder="Describe the task you want this system prompt to structure..."
              className="min-h-52 resize-y text-sm leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={isRunning || !input.trim()}
                className="gap-2"
              >
                <PlayIcon className="size-4" />
                {isRunning ? "Running..." : "Run prompt"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isRunning}
                onClick={() => setInput(selectedPrompt.sampleInput)}
              >
                Load sample input
              </Button>
            </div>
            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BotIcon className="size-4" />
            Latest run
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Conversation className="min-h-0">
            <ConversationContent className="gap-4 px-0 pb-0 pt-0">
              {!runContext && !isRunning ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-stone-50 px-5 py-8 text-sm text-muted-foreground">
                  Choose a prompt, inspect its contract, then run it to see the
                  Zod-validated object here.
                </div>
              ) : null}

              {runContext ? (
                <Message from="user">
                  <MessageContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {runContext.input}
                    </p>
                  </MessageContent>
                </Message>
              ) : null}

              {isRunning && runContext ? (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer className="text-sm text-muted-foreground">
                      {`Running ${lastRunPrompt?.title ?? "selected prompt"}...`}
                    </Shimmer>
                  </MessageContent>
                </Message>
              ) : null}

              {result && runContext ? (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <MessageResponse>
                          {lastRunPrompt?.title ?? "Structured output"}
                        </MessageResponse>
                        <Badge
                          variant="secondary"
                          className="bg-stone-100 text-stone-700"
                        >
                          {result.model}
                        </Badge>
                        <UsagePill label="Input" value={result.usage?.inputTokens} />
                        <UsagePill label="Output" value={result.usage?.outputTokens} />
                        <UsagePill label="Total" value={result.usage?.totalTokens} />
                      </div>

                      {typeof result.finishReason === "string" ? (
                        <p className="text-xs text-muted-foreground">
                          Finish reason: {result.finishReason}
                        </p>
                      ) : null}

                      <div className="grid gap-3">
                        {Object.entries(result.object as Record<string, unknown>).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="rounded-2xl border border-border/60 bg-stone-50 p-4"
                            >
                              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                {formatLabel(key)}
                              </p>
                              <div className="mt-3">
                                <StructuredValue value={value} />
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-stone-950 p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                          Raw JSON
                        </p>
                        <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-stone-100">
                          {JSON.stringify(result.object, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </MessageContent>
                </Message>
              ) : null}
            </ConversationContent>

            <ConversationScrollButton />
          </Conversation>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-border/60 bg-stone-50 px-4 py-3 text-xs text-muted-foreground">
            <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
            The route validates each run against a prompt-specific Zod schema,
            so the UI only renders structured outputs that conform to the
            selected contract.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}