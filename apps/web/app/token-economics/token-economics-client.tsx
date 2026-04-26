"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  BotIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CoinsIcon,
  DollarSignIcon,
  Layers3Icon,
  SparklesIcon,
  ZapIcon,
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  calculateScenarioCost,
  DEFAULT_SELECTED_MODEL_IDS,
  formatCompactTokens,
  formatDollarsPerMillion,
  formatUsd,
  type TokenEconomicsModel,
} from "@/lib/token-economics/catalog-shared";
import type {
  RoutingDecisionData,
  TokenEconomicsUIMessage,
} from "@/lib/token-economics/types";
import { cn } from "@/lib/utils";

const transport = new DefaultChatTransport({ api: "/api/token-economics" });

const SCENARIO_PRESETS = [
  { label: "Tiny chat", inputTokens: 1500, outputTokens: 250 },
  { label: "Agent step", inputTokens: 8000, outputTokens: 1200 },
  { label: "Large context", inputTokens: 25000, outputTokens: 3000 },
] as const;

const ROUTING_STARTERS = [
  {
    id: "simple-rewrite",
    title: "Simple rewrite",
    prompt:
      "Rewrite this sentence to sound warmer and shorter: Thanks for the update, we will review this and get back to you soon.",
  },
  {
    id: "simple-summary",
    title: "Short summary",
    prompt:
      "Summarize the difference between cookies and sessions in two short paragraphs for a junior developer.",
  },
  {
    id: "simple-bullets",
    title: "Bullet list",
    prompt:
      "Give me five concise bullets on when to use feature flags in a SaaS product.",
  },
  {
    id: "complex-comparison",
    title: "Tradeoff analysis",
    prompt:
      "Compare RAG and fine-tuning for a customer support assistant at a startup. Recommend one, explain tradeoffs, and call out when the other becomes the better choice.",
  },
  {
    id: "complex-plan",
    title: "Phased plan",
    prompt:
      "Design a phased evaluation strategy for an AI agent that uses tools and retrieval. Include what to measure first, what to automate next, and what should stay human-reviewed.",
  },
  {
    id: "complex-routing",
    title: "Architecture reasoning",
    prompt:
      "Propose a model-routing strategy for a multi-tenant AI app that balances cost, latency, and answer quality across cheap and premium models.",
  },
] as const;

type ModelRow = {
  model: TokenEconomicsModel;
  totalCostUsd: number | null;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
};

function hasKnownTotalCost(
  row: ModelRow
): row is ModelRow & { totalCostUsd: number } {
  return row.totalCostUsd !== null;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: typeof CoinsIcon;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Card className="border border-stone-200 bg-white shadow-sm ring-0">
      <CardContent className="flex items-start gap-3 px-4 py-4">
        <div className="rounded-xl bg-stone-100 p-2 text-stone-700">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RoutingDecisionCard({ data }: { data: RoutingDecisionData }) {
  const deltaLabel =
    data.complexity === "simple"
      ? "Estimated savings vs premium model"
      : "Estimated complexity premium";

  return (
    <Card className="border border-stone-200 bg-stone-50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BrainCircuitIcon className="size-4" />
          Router decision
        </CardTitle>
        <CardDescription className="text-xs leading-5 text-muted-foreground">
          {data.rationale}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className={cn(
              data.complexity === "simple"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-800"
            )}
          >
            {data.complexity === "simple" ? "Simple request" : "Complex request"}
          </Badge>
          <Badge variant="secondary" className="bg-stone-900 text-white">
            {data.selectedModelName}
          </Badge>
          <Badge variant="secondary" className="bg-white text-stone-700">
            {formatCompactTokens(data.estimatedInputTokens)} in / {formatCompactTokens(data.estimatedOutputTokens)} out
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-black/5 bg-white px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Routed cost
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatUsd(data.selectedCostUsd)}
            </p>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Alternate cost
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatUsd(data.alternateCostUsd)}
            </p>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {deltaLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatUsd(data.deltaUsd)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TokenEconomicsClient({
  initialModels,
}: {
  initialModels: TokenEconomicsModel[];
}) {
  const [inputTokens, setInputTokens] = useState(8000);
  const [outputTokens, setOutputTokens] = useState(1200);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(() => {
    const defaults = DEFAULT_SELECTED_MODEL_IDS.filter((id) =>
      initialModels.some((model) => model.id === id)
    );

    if (defaults.length > 0) {
      return [...defaults];
    }

    return initialModels.slice(0, 4).map((model) => model.id);
  });

  const { messages, sendMessage, setMessages, status } =
    useChat<TokenEconomicsUIMessage>({
      transport,
    });

  const isRouting = status === "submitted" || status === "streaming";

  const modelRows = useMemo<ModelRow[]>(() => {
    return initialModels
      .map((model) => {
        const cost = calculateScenarioCost(model, inputTokens, outputTokens);

        return {
          model,
          totalCostUsd: cost?.totalCostUsd ?? null,
          inputCostUsd: cost?.inputCostUsd ?? null,
          outputCostUsd: cost?.outputCostUsd ?? null,
        };
      })
      .sort((left, right) => {
        const leftTotal = left.totalCostUsd ?? Number.POSITIVE_INFINITY;
        const rightTotal = right.totalCostUsd ?? Number.POSITIVE_INFINITY;

        return leftTotal - rightTotal;
      });
  }, [initialModels, inputTokens, outputTokens]);

  const selectedRows = modelRows.filter((row) =>
    selectedModelIds.includes(row.model.id)
  );
  const pricedSelectedRows = selectedRows.filter(hasKnownTotalCost);
  const blendedCostUsd =
    pricedSelectedRows.length > 0
      ? pricedSelectedRows.reduce((sum, row) => sum + row.totalCostUsd, 0) /
        pricedSelectedRows.length
      : null;
  const cheapestSelected = pricedSelectedRows[0] ?? null;
  const priciestSelected = pricedSelectedRows[pricedSelectedRows.length - 1] ?? null;

  function toggleModel(modelId: string) {
    setSelectedModelIds((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId]
    );
  }

  function applyPreset(input: number, output: number) {
    setInputTokens(input);
    setOutputTokens(output);
  }

  function runStarter(prompt: string) {
    if (isRouting) {
      return;
    }

    setMessages([]);
    sendMessage({ text: prompt });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12 sm:px-12 sm:pb-32 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Token economics
        </h1>
        <p className="text-sm text-muted-foreground">
          A practical cost calculator plus a visible routing demo that chooses between GPT-4o mini for simpler work and GPT-5 mini for harder requests.
        </p>
      </header>

      <Tabs defaultValue="calculator" className="gap-6">
        <TabsList variant="line">
          <TabsTrigger value="calculator">Cost calculator</TabsTrigger>
          <TabsTrigger value="routing">Model routing lab</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="flex flex-col gap-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={Layers3Icon}
              label="Selected models"
              value={String(selectedRows.length)}
              caption="Compare multiple models side by side, then blend the selected set with an equal-weight average."
            />
            <SummaryCard
              icon={DollarSignIcon}
              label="Blended cost"
              value={blendedCostUsd == null ? "—" : formatUsd(blendedCostUsd)}
              caption="Equal-weight average of the selected models for the current token scenario."
            />
            <SummaryCard
              icon={ZapIcon}
              label="Cheapest selected"
              value={
                cheapestSelected?.totalCostUsd != null
                  ? formatUsd(cheapestSelected.totalCostUsd)
                  : "—"
              }
              caption={
                cheapestSelected?.model.name ??
                "Choose at least one model to compare."
              }
            />
            <SummaryCard
              icon={CoinsIcon}
              label="Most expensive"
              value={
                priciestSelected?.totalCostUsd != null
                  ? formatUsd(priciestSelected.totalCostUsd)
                  : "—"
              }
              caption={
                priciestSelected?.model.name ??
                "Choose at least one model to compare."
              }
            />
          </section>

          <section className="flex flex-col gap-5">
            <Card className="border-0 bg-white shadow-sm ring-0">
              <CardHeader>
                <CardTitle>Model cost calculator</CardTitle>
                <CardDescription>
                  Select models, set input and output token counts, and get back-of-the-envelope totals in a compact grid inspired by the AI Gateway models page.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 pt-0">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                  <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                    Input tokens
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={inputTokens}
                      onChange={(event) =>
                        setInputTokens(
                          Math.max(0, Number(event.target.value) || 0)
                        )
                      }
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                    Output tokens
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={outputTokens}
                      onChange={(event) =>
                        setOutputTokens(
                          Math.max(0, Number(event.target.value) || 0)
                        )
                      }
                    />
                  </label>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {SCENARIO_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          applyPreset(preset.inputTokens, preset.outputTokens)
                        }
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {modelRows.map((row) => {
                    const isSelected = selectedModelIds.includes(row.model.id);

                    return (
                      <button
                        key={row.model.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleModel(row.model.id)}
                        className={cn(
                          "rounded-2xl border px-4 py-4 text-left transition-colors",
                          isSelected
                            ? "border-foreground bg-stone-50"
                            : "border-stone-200 bg-white hover:bg-stone-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="bg-stone-100 text-stone-700"
                              >
                                {row.model.provider}
                              </Badge>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                                  <CheckCircle2Icon className="size-3.5" />
                                  selected
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 text-base font-semibold tracking-tight text-foreground">
                              {row.model.name}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-3">
                            <span>Input</span>
                            <span className="font-medium text-foreground">
                              {formatDollarsPerMillion(
                                row.model.pricing.inputCostPerToken
                              )}
                              /M
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Output</span>
                            <span className="font-medium text-foreground">
                              {formatDollarsPerMillion(
                                row.model.pricing.outputCostPerToken
                              )}
                              /M
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Context</span>
                            <span className="font-medium text-foreground">
                              {formatCompactTokens(row.model.contextWindow)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Max output</span>
                            <span className="font-medium text-foreground">
                              {formatCompactTokens(row.model.maxOutputTokens)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-black/5 bg-stone-50 px-3 py-3 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              Scenario total
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {row.totalCostUsd == null
                                ? "—"
                                : formatUsd(row.totalCostUsd)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                            <span>Input / output split</span>
                            <span>
                              {row.inputCostUsd == null ||
                              row.outputCostUsd == null
                                ? "—"
                                : `${formatUsd(row.inputCostUsd)} / ${formatUsd(row.outputCostUsd)}`}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="routing" className="flex flex-col gap-5">
          <section className="flex flex-col gap-5">
            <Card className="border-0 bg-white shadow-sm ring-0">
              <CardHeader>
                <CardTitle>Model routing lab</CardTitle>
                <CardDescription>
                  Click a canned prompt to run a two-step flow: router agent selects the model, then the selected fulfillment agent answers the request.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-emerald-100 text-emerald-700"
                  >
                    Simple → GPT-4o mini
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-800"
                  >
                    Complex → GPT-5 mini
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ROUTING_STARTERS.map((starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      onClick={() => runStarter(starter.prompt)}
                      disabled={isRouting}
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-4 text-left transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        <SparklesIcon className="size-3.5" />
                        {starter.title}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {starter.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-sm ring-0">
              <CardContent className="px-4 py-4 sm:px-6 sm:py-6">
                <Conversation className="min-h-72">
                  <ConversationContent className="gap-4 px-0 pb-4 pt-0">
                    {messages.length === 0 ? (
                      <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-6 py-10 text-center">
                        <BotIcon className="size-5 text-stone-500" />
                        <p className="mt-3 text-sm font-medium text-foreground">
                          Pick a canned routing task
                        </p>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                          The UI will show the router decision first, then stream the chosen model’s answer into the same conversation.
                        </p>
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
                                  <MessageResponse key={index}>
                                    {part.text}
                                  </MessageResponse>
                                )
                              ) : null;
                            }

                            if (part.type === "data-routing") {
                              return (
                                <RoutingDecisionCard
                                  key={index}
                                  data={part.data as RoutingDecisionData}
                                />
                              );
                            }

                            return null;
                          })}
                        </MessageContent>
                      </Message>
                    ))}

                    {isRouting ? (
                      <Message from="assistant">
                        <MessageContent>
                          <Shimmer className="text-sm text-muted-foreground">
                            Routing request and generating answer…
                          </Shimmer>
                        </MessageContent>
                      </Message>
                    ) : null}
                  </ConversationContent>

                  <ConversationScrollButton />
                </Conversation>
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}