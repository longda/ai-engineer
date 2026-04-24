import type { FailureScenarioId } from "./scenarios";

export type EvaluationVerdict = "pass" | "warn" | "fail";

export type ToolTraceEntry = {
  stepNumber: number;
  toolName: string;
  input: unknown;
  output?: unknown;
};

export type RunEvaluation = {
  verdict: EvaluationVerdict;
  checks: string[];
};

export type FailurePatternRunResult = {
  label: "Before remediation" | "After remediation";
  description: string;
  assistantText: string;
  toolTrace: ToolTraceEntry[];
  evaluation: RunEvaluation;
  finishReason?: string;
  error?: string;
};

export type FailurePatternScenarioSummary = {
  id: FailureScenarioId;
  title: string;
  summary: string;
  injectionSummary: string;
  remediationSummary: string;
  expectedOutcome: string;
  hiddenTruth: string[];
};

export type FailurePatternComparisonResponse = {
  scenario: FailurePatternScenarioSummary;
  runs: {
    before: FailurePatternRunResult;
    after: FailurePatternRunResult;
  };
};