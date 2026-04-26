export const OBSERVABILITY_RANGE_OPTIONS = [
  {
    id: "1d",
    label: "1D",
    description: "Last 24 hours",
    btqlInterval: "1 day",
  },
  {
    id: "7d",
    label: "7D",
    description: "Last 7 days",
    btqlInterval: "7 day",
  },
  {
    id: "14d",
    label: "14D",
    description: "Last 14 days",
    btqlInterval: "14 day",
  },
] as const;

export type ObservabilityRange =
  (typeof OBSERVABILITY_RANGE_OPTIONS)[number]["id"];

export function isObservabilityRange(
  value: string | null | undefined
): value is ObservabilityRange {
  return OBSERVABILITY_RANGE_OPTIONS.some((option) => option.id === value);
}

export type ObservabilitySummary = {
  llmSpanCount: number;
  queryCount: number;
  totalCostUsd: number;
  promptTokens: number;
  completionTokens: number;
  averageLatencySeconds: number;
  maxLatencySeconds: number;
  averageCostPerQueryUsd: number;
  averageTokensPerQuery: number;
};

export type ObservabilityTrendPoint = {
  date: string;
  totalCostUsd: number;
  queryCount: number;
  promptTokens: number;
  completionTokens: number;
};

export type ObservabilityModelBreakdown = {
  model: string;
  llmSpanCount: number;
  queryCount: number;
  totalCostUsd: number;
  averageCostPerQueryUsd: number;
  promptTokens: number;
  completionTokens: number;
};

export type ObservabilityRecentSpan = {
  spanId: string;
  created: string;
  model: string;
  rootSpanId: string;
  estimatedCostUsd: number;
  latencySeconds: number;
  promptTokens: number;
  completionTokens: number;
};

export type ObservabilityDashboardData = {
  projectId: string;
  projectName: string;
  range: ObservabilityRange;
  summary: ObservabilitySummary;
  trend: ObservabilityTrendPoint[];
  modelBreakdown: ObservabilityModelBreakdown[];
  recentSpans: ObservabilityRecentSpan[];
};