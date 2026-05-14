"use client";

import { useState, useTransition } from "react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  LoaderCircleIcon,
  SearchCheckIcon,
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
import type { RagEvaluationRunSummary } from "@/lib/evaluation/types";

const SUMMARY_METRICS = [
  { key: "retrieval_recall_at_4", label: "Recall@4" },
  { key: "retrieval_mrr_at_4", label: "MRR@4" },
  { key: "retrieval_source_type_coverage", label: "Source coverage" },
  { key: "retrieval_entity_coverage", label: "Entity coverage" },
  { key: "generation_sources_line", label: "Sources line" },
  { key: "generation_correctness", label: "Correctness" },
  { key: "generation_relevance", label: "Relevance" },
  {
    key: "generation_hallucination_risk",
    label: "Hallucination risk",
  },
] as const;

const HEADER_METRICS = [
  {
    key: "retrieval_recall_at_4",
    label: "Recall@4",
    eyebrow: "Retrieval",
  },
  {
    key: "retrieval_mrr_at_4",
    label: "MRR@4",
    eyebrow: "Ranking",
  },
  {
    key: "retrieval_source_type_coverage",
    label: "Source coverage",
    eyebrow: "Coverage",
  },
  {
    key: "generation_correctness",
    label: "Correctness",
    eyebrow: "Judgment",
  },
  {
    key: "generation_relevance",
    label: "Relevance",
    eyebrow: "Answer fit",
  },
  {
    key: "generation_hallucination_risk",
    label: "Hallucination risk",
    eyebrow: "Grounding",
  },
] as const;

function formatPercent(value: number | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return `${Math.round(value * 100)}%`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMetricLabel(name: string) {
  return name
    .split("_")
    .map((part) => {
      if (/^at\d+$/i.test(part)) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function EvaluationClient() {
  const [summary, setSummary] = useState<RagEvaluationRunSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({});

  function handleRun() {
    if (isPending) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/evaluation", {
          method: "POST",
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | RagEvaluationRunSummary
          | { error?: string };

        if (!response.ok || ("error" in payload && typeof payload.error === "string")) {
          throw new Error(
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Evaluation failed."
          );
        }

        const nextSummary = payload as RagEvaluationRunSummary;
        setSummary(nextSummary);
        setExpandedVariants(
          Object.fromEntries(
            nextSummary.variants.map((variantSummary, index) => [
              variantSummary.variant.id,
              index === 0,
            ])
          )
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Evaluation failed."
        );
      }
    });
  }

  function toggleVariant(variantId: string) {
    setExpandedVariants((current) => ({
      ...current,
      [variantId]: !current[variantId],
    }));
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col gap-8 px-6 pb-6 pt-12 sm:px-12 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Evaluation and quality judgment
        </h1>
        <p className="text-sm text-muted-foreground">
          Runs the ARC Raiders RAG stack against the dataset, logs each variant to Braintrust, and splits retrieval metrics from generation judgment.
        </p>
      </header>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConicalIcon className="size-4" />
            Evaluation harness
          </CardTitle>
          <CardDescription>
            Labeled ARC Raiders questions, retrieval variants, deterministic retrieval scoring, and an LLM judge for correctness, relevance, and hallucination risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleRun} disabled={isPending}>
              {isPending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <ActivityIcon className="size-4" />
              )}
              Run evaluation harness
            </Button>
            <p className="text-xs text-muted-foreground">
              Uses the same retrieval and prompt stack as the current RAG demo. Expect a real multi-run evaluation, not a fixture replay.
            </p>
          </div>
          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {summary ? (
        <Card className="border border-stone-200 bg-stone-50 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Latest run</CardTitle>
            <CardDescription>
              {summary.datasetLabel} · {summary.sampleCount} cases · started {formatTimestamp(summary.startedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-0">
            <Card className="border border-stone-200 bg-white shadow-sm ring-0">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Variant summary</CardTitle>
                <CardDescription>
                  One-pass comparison across the evaluation variants using the same retrieval and judgment metrics shown below.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto rounded-2xl border border-stone-200">
                  <table className="min-w-245 w-full border-collapse text-sm">
                    <thead className="bg-stone-100 text-left text-[11px] uppercase tracking-[0.14em] text-stone-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Variant</th>
                        <th className="px-4 py-3 font-medium">Mode</th>
                        {SUMMARY_METRICS.map((metric) => (
                          <th key={metric.key} className="px-4 py-3 font-medium">
                            {metric.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.variants.map((variantSummary, index) => (
                        <tr
                          key={variantSummary.variant.id}
                          className={index % 2 === 0 ? "bg-white" : "bg-stone-50/80"}
                        >
                          <td className="border-t border-stone-200 px-4 py-3 align-top">
                            <div className="font-medium text-foreground">
                              {variantSummary.variant.label}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {variantSummary.sampleCount} cases
                            </div>
                          </td>
                          <td className="border-t border-stone-200 px-4 py-3 align-top">
                            <Badge variant="outline" className="bg-white">
                              {variantSummary.variant.retrievalMode}
                            </Badge>
                          </td>
                          {SUMMARY_METRICS.map((metric) => (
                            <td
                              key={metric.key}
                              className="border-t border-stone-200 px-4 py-3 align-top font-medium text-foreground"
                            >
                              {formatPercent(variantSummary.metrics[metric.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {summary.variants.map((variantSummary) => (
              <Card key={variantSummary.variant.id} className="border border-stone-200 bg-white shadow-sm ring-0">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{variantSummary.variant.label}</CardTitle>
                        <Badge variant="secondary" className="bg-stone-900 text-white">
                          {variantSummary.variant.retrievalMode}
                        </Badge>
                        <Badge variant="outline">{variantSummary.sampleCount} cases</Badge>
                      </div>
                      <CardDescription>
                        Experiment {variantSummary.experimentName}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => toggleVariant(variantSummary.variant.id)}
                      aria-expanded={expandedVariants[variantSummary.variant.id] ?? false}
                    >
                      {expandedVariants[variantSummary.variant.id] ?? false ? "Collapse" : "Expand"}
                      <ChevronDownIcon
                        className={`size-4 transition-transform ${
                          expandedVariants[variantSummary.variant.id] ?? false ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </Button>
                  </div>
                </CardHeader>
                {(expandedVariants[variantSummary.variant.id] ?? false) ? (
                <CardContent className="grid gap-4 pt-0">
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {HEADER_METRICS.map((metric) => {
                      const value = variantSummary.metrics[metric.key];

                      return (
                        <div
                          key={metric.key}
                          className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 shadow-none"
                        >
                          <div className="flex min-h-32 flex-col">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {metric.eyebrow}
                            </p>
                            <p className="mt-4 text-sm font-medium leading-5 text-foreground">
                              {metric.label}
                            </p>
                            <p className="mt-auto pt-6 text-2xl font-semibold text-foreground">
                              {formatPercent(value)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <Card className="border border-stone-200 bg-stone-50 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <SearchCheckIcon className="size-4" />
                          Retrieval and generation metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid gap-2 text-sm text-muted-foreground">
                          {Object.entries(variantSummary.metrics).map(([name, value]) => (
                            <div key={name} className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white px-3 py-2">
                              <span>{formatMetricLabel(name)}</span>
                              <span className="font-medium text-foreground">
                                {formatPercent(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-stone-200 bg-stone-50 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <AlertTriangleIcon className="size-4" />
                          Weakest cases
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid gap-3">
                          {variantSummary.failedCases.map((caseResult) => (
                            <div key={caseResult.caseId} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {caseResult.question}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {caseResult.caseId}
                                  </p>
                                </div>
                                {caseResult.error ? (
                                  <Badge variant="destructive">error</Badge>
                                ) : (
                                  <Badge variant="outline">review</Badge>
                                )}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(caseResult.scores).map(([name, value]) => (
                                  <Badge key={name} variant="secondary" className="bg-stone-100 text-stone-700">
                                    {name} {formatPercent(value ?? undefined)}
                                  </Badge>
                                ))}
                              </div>
                              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {caseResult.answer || "No answer was captured for this case."}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
                ) : null}
              </Card>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-dashed border-stone-200 bg-stone-50 shadow-none">
          <CardContent className="flex flex-col items-start gap-3 px-6 py-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <CheckCircle2Icon className="size-4" />
              The harness is ready.
            </div>
            <p>
              Run the dataset to generate the first retrieval and generation scorecards, then use the same framework to compare prompt, retrieval, rerank, or model changes.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}