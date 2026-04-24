"use client";

import { useMemo, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, Clock3Icon } from "lucide-react";
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
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  FAILURE_SCENARIOS,
  type FailureScenarioId,
} from "@/lib/failure-patterns/scenarios";
import type {
  FailurePatternComparisonResponse,
  FailurePatternRunResult,
} from "@/lib/failure-patterns/types";

const DEFAULT_SCENARIO = FAILURE_SCENARIOS[0]!;

function getVerdictBadgeClasses(verdict: FailurePatternRunResult["evaluation"]["verdict"]) {
  switch (verdict) {
    case "pass":
      return "bg-emerald-100 text-emerald-800";
    case "warn":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-rose-100 text-rose-900";
  }
}

function ToolTraceBlock({
  run,
}: {
  run: FailurePatternRunResult;
}) {
  if (run.toolTrace.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
        No tool or verification trace was captured for this run.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {run.toolTrace.map((entry, index) => (
        <div
          key={`${run.label}-${entry.toolName}-${entry.stepNumber}-${index}`}
          className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3"
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-stone-100 text-stone-700">
              {entry.toolName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Step {entry.stepNumber + 1}
            </span>
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-background p-3 text-[11px] text-muted-foreground">
            {JSON.stringify(
              {
                input: entry.input,
                output: entry.output,
              },
              null,
              2
            )}
          </pre>
        </div>
      ))}
    </div>
  );
}

function RunResultCard({
  run,
}: {
  run: FailurePatternRunResult;
}) {
  const verdictIcon =
    run.evaluation.verdict === "pass"
      ? CheckCircle2Icon
      : run.evaluation.verdict === "warn"
        ? Clock3Icon
        : AlertCircleIcon;
  const VerdictIcon = verdictIcon;

  return (
    <Card className="h-full border border-border/50 bg-white shadow-none ring-0">
      <CardHeader className="gap-3 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{run.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{run.description}</p>
          </div>
          <Badge
            variant="secondary"
            className={`gap-1 capitalize ${getVerdictBadgeClasses(run.evaluation.verdict)}`}
          >
            <VerdictIcon className="size-3.5" />
            {run.evaluation.verdict}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        {run.error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {run.error}
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Assistant answer
          </p>
          {run.assistantText ? (
            <Message from="assistant" className="max-w-full">
              <MessageContent className="w-full max-w-full rounded-xl border border-border/60 bg-background px-4 py-4">
                <MessageResponse>{run.assistantText}</MessageResponse>
              </MessageContent>
            </Message>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              No assistant text was returned for this run.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Evaluation
          </p>
          <ul className="space-y-2 text-sm text-foreground">
            {run.evaluation.checks.map((check) => (
              <li key={check} className="rounded-lg bg-muted/30 px-3 py-2">
                {check}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Evidence trace
          </p>
          <ToolTraceBlock run={run} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function FailurePatternsPage() {
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<FailureScenarioId>(DEFAULT_SCENARIO.id);
  const [comparison, setComparison] =
    useState<FailurePatternComparisonResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedScenario = useMemo(
    () =>
      FAILURE_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) ??
      DEFAULT_SCENARIO,
    [selectedScenarioId]
  );

  const showingStaleResult =
    comparison != null && comparison.scenario.id !== selectedScenarioId;

  async function handleGenerate() {
    setIsLoading(true);
    setRequestError(null);

    try {
      const response = await fetch("/api/failure-patterns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenarioId: selectedScenarioId }),
      });

      const payload = (await response.json()) as
        | FailurePatternComparisonResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? payload.error || "The failure-pattern request failed."
            : "The failure-pattern request failed."
        );
      }

      setComparison(payload as FailurePatternComparisonResponse);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "The failure-pattern request failed."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12 sm:px-12 sm:pb-32 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Failure pattern lab
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare the same refund-assistant case before and after remediation for
          six common agent failure patterns.
        </p>
      </header>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Choose a scenario</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {FAILURE_SCENARIOS.map((scenario) => (
              <Button
                key={scenario.id}
                type="button"
                variant={
                  scenario.id === selectedScenarioId ? "default" : "outline"
                }
                disabled={isLoading}
                onClick={() => setSelectedScenarioId(scenario.id)}
                className="h-auto min-h-14 justify-start px-4 py-3 text-left"
              >
                {scenario.title}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              size="lg"
              disabled={isLoading}
              onClick={handleGenerate}
            >
              {isLoading ? "Generating…" : "Generate comparison"}
            </Button>
            {showingStaleResult ? (
              <p className="text-xs text-muted-foreground">
                The results below still show {comparison?.scenario.title}. Run the
                selected scenario to update them.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Click the button to run the selected scenario.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="gap-3 pb-3">
          <CardTitle className="text-base">{selectedScenario.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {selectedScenario.summary}
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 pt-0 lg:grid-cols-[1.1fr_1.1fr_0.8fr]">
          <div className="space-y-2 rounded-xl bg-muted/25 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Broken run
            </p>
            <p className="text-sm text-foreground">
              {selectedScenario.injectionSummary}
            </p>
          </div>
          <div className="space-y-2 rounded-xl bg-muted/25 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Remediation
            </p>
            <p className="text-sm text-foreground">
              {selectedScenario.remediationSummary}
            </p>
          </div>
          <div className="space-y-2 rounded-xl bg-muted/25 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Expected outcome
            </p>
            <p className="text-sm text-foreground">
              {selectedScenario.evaluation.expectedOutcome}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comparison results</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-0">
          {requestError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {requestError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {["before", "after"].map((slot) => (
                <Card
                  key={slot}
                  className="border border-border/50 bg-white shadow-none ring-0"
                >
                  <CardHeader>
                    <CardTitle className="text-base capitalize">
                      {slot === "before"
                        ? "Before remediation"
                        : "After remediation"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 pt-0">
                    <Shimmer className="text-sm text-muted-foreground">
                      Running refund-assistant comparison…
                    </Shimmer>
                    <div className="h-24 rounded-xl bg-muted/30" />
                    <div className="h-20 rounded-xl bg-muted/30" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : comparison ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <RunResultCard run={comparison.runs.before} />
              <RunResultCard run={comparison.runs.after} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-sm text-muted-foreground">
              Select a scenario, then generate a before-versus-after comparison to
              view the real assistant outputs, evidence trace, and deterministic
              verdicts.
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}