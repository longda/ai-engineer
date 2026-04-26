"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightIcon,
  BotIcon,
  CoinsIcon,
  DatabaseZapIcon,
  LineChartIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  OBSERVABILITY_RANGE_OPTIONS,
  type ObservabilityDashboardData,
  type ObservabilityModelBreakdown,
  type ObservabilityRange,
  type ObservabilityRecentSpan,
  type ObservabilityTrendPoint,
} from "@/lib/observability/types";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const durationFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatUsd(value: number) {
  return value >= 0.01
    ? compactCurrencyFormatter.format(value)
    : currencyFormatter.format(value);
}

function formatTokens(value: number) {
  const roundedValue = Math.round(value);

  return roundedValue >= 1000
    ? compactNumberFormatter.format(roundedValue)
    : numberFormatter.format(roundedValue);
}

function formatDuration(value: number) {
  if (value <= 0) {
    return "0 ms";
  }

  if (value < 1) {
    return `${numberFormatter.format(Math.round(value * 1000))} ms`;
  }

  return `${durationFormatter.format(value)} s`;
}

function formatDateLabel(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return timestampFormatter.format(parsed);
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
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {caption}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RangePicker({
  selectedRange,
}: {
  selectedRange: ObservabilityRange;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSelect(range: ObservabilityRange) {
    if (range === selectedRange) {
      return;
    }

    const href = range === "7d" ? pathname : `${pathname}?range=${range}`;

    startTransition(() => {
      router.replace(href);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {OBSERVABILITY_RANGE_OPTIONS.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={option.id === selectedRange ? "default" : "outline"}
          disabled={isPending}
          onClick={() => handleSelect(option.id)}
          className="rounded-full px-4"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function TrendChart({ points }: { points: ObservabilityTrendPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-sm text-muted-foreground">
        No recent cost trend data was returned for this time window.
      </div>
    );
  }

  const maxCost = Math.max(...points.map((point) => point.totalCostUsd), 0.0001);

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="grid min-w-full gap-3"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point) => {
          const height = Math.max((point.totalCostUsd / maxCost) * 100, 6);

          return (
            <div key={point.date} className="flex min-w-0 flex-col gap-2">
              <div className="flex h-40 items-end rounded-2xl bg-stone-100/80 px-2 py-2">
                <div
                  className="w-full rounded-xl bg-stone-900 transition-[height]"
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {formatDateLabel(point.date)}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatUsd(point.totalCostUsd)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {numberFormatter.format(point.queryCount)} queries
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelBreakdownList({
  rows,
}: {
  rows: ObservabilityModelBreakdown[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-sm text-muted-foreground">
        No model breakdown data was returned for this range.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.model}
          className="rounded-2xl border border-stone-200/80 bg-stone-50 px-4 py-4"
        >
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{row.model}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {numberFormatter.format(row.queryCount)} queries across {numberFormatter.format(row.llmSpanCount)} LLM spans
              </p>
            </div>
            <div className="rounded-xl bg-white px-4 py-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Total cost
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatUsd(row.totalCostUsd)}
                  </p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Cost/query
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatUsd(row.averageCostPerQueryUsd)}
                  </p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Tokens
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTokens(row.promptTokens + row.completionTokens)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentSpansList({ rows }: { rows: ObservabilityRecentSpan[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-sm text-muted-foreground">
        No recent traced queries were returned for this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div
          key={row.spanId}
          className="rounded-2xl border border-stone-200/80 bg-white px-4 py-4"
        >
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                  {row.model}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(row.created)}
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] leading-5 text-muted-foreground">
                {row.spanId}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Estimated cost
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatUsd(row.estimatedCostUsd)}
                </p>
              </div>
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Latency
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatDuration(row.latencySeconds)}
                </p>
              </div>
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Prompt tokens
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatTokens(row.promptTokens)}
                </p>
              </div>
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Completion tokens
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatTokens(row.completionTokens)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ObservabilityClient({
  dashboard,
  errorMessage,
  selectedRange,
}: {
  dashboard: ObservabilityDashboardData | null;
  errorMessage: string | null;
  selectedRange: ObservabilityRange;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12 sm:px-12 sm:pb-32 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Observability
          </h1>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base">
            A lightweight Braintrust-backed dashboard for latency, cost, token usage, and recent LLM activity.
          </p>
        </div>
      </header>

      <Card className="border border-stone-200 bg-white shadow-sm ring-0">
        <CardHeader className="gap-3 pb-3">
          <CardTitle className="text-base">Time window</CardTitle>
          <CardDescription>
            Switch the Braintrust query range without changing the tracing wrapper.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
          <RangePicker selectedRange={selectedRange} />
          {dashboard ? (
            <div className="flex w-full flex-wrap gap-2 text-xs text-muted-foreground sm:w-auto sm:justify-end">
              <div className="rounded-xl bg-stone-100 px-3 py-2 text-stone-700">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Braintrust project
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {dashboard.projectName}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-stone-100 px-3 py-2 text-stone-700 sm:max-w-xs">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Project ID
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-foreground">
                  {dashboard.projectId}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border border-rose-200 bg-rose-50 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dashboard unavailable</CardTitle>
            <CardDescription className="text-rose-700">
              {errorMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {dashboard ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={CoinsIcon}
              label="Estimated cost"
              value={formatUsd(dashboard.summary.totalCostUsd)}
              caption={`${numberFormatter.format(dashboard.summary.queryCount)} traced queries across ${numberFormatter.format(dashboard.summary.llmSpanCount)} LLM spans.`}
            />
            <SummaryCard
              icon={SparklesIcon}
              label="Avg latency"
              value={formatDuration(dashboard.summary.averageLatencySeconds)}
              caption={`${formatDuration(dashboard.summary.maxLatencySeconds)} slowest traced model call in range.`}
            />
            <SummaryCard
              icon={DatabaseZapIcon}
              label="Total tokens"
              value={formatTokens(
                dashboard.summary.promptTokens +
                  dashboard.summary.completionTokens
              )}
              caption={`${formatTokens(dashboard.summary.promptTokens)} prompt / ${formatTokens(dashboard.summary.completionTokens)} completion.`}
            />
            <SummaryCard
              icon={ActivityIcon}
              label="Cost / query"
              value={formatUsd(dashboard.summary.averageCostPerQueryUsd)}
              caption={`${formatTokens(dashboard.summary.averageTokensPerQuery)} average tokens per query.`}
            />
          </section>

          <section className="grid gap-5">
            <Card className="border border-stone-200 bg-white shadow-sm ring-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LineChartIcon className="size-4" />
                  Daily cost trend
                </CardTitle>
                <CardDescription>
                  Estimated daily cost and query volume from Braintrust LLM spans.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <TrendChart points={dashboard.trend} />
              </CardContent>
            </Card>

            <Card className="border border-stone-200 bg-white shadow-sm ring-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BotIcon className="size-4" />
                  Model breakdown
                </CardTitle>
                <CardDescription>
                  Top models ranked by estimated cost in the current time window.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModelBreakdownList rows={dashboard.modelBreakdown} />
              </CardContent>
            </Card>
          </section>

          <Card className="border border-stone-200 bg-white shadow-sm ring-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightIcon className="size-4" />
                Recent traced model calls
              </CardTitle>
              <CardDescription>
                A compact feed of the latest traced model calls, with cost, latency, and token details.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <RecentSpansList rows={dashboard.recentSpans} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}