import "server-only";

import { z } from "zod";
import {
  OBSERVABILITY_RANGE_OPTIONS,
  type ObservabilityDashboardData,
  type ObservabilityModelBreakdown,
  type ObservabilityRange,
  type ObservabilityRecentSpan,
  type ObservabilitySummary,
  type ObservabilityTrendPoint,
} from "@/lib/observability/types";

const BRAINTRUST_API_URL = "https://api.braintrust.dev";

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const projectsResponseSchema = z.object({
  objects: z.array(projectSchema),
});

const summaryRowSchema = z.object({
  llm_span_count: z.number().nullable().optional(),
  query_count: z.number().nullable().optional(),
  total_cost: z.number().nullable().optional(),
  prompt_tokens: z.number().nullable().optional(),
  completion_tokens: z.number().nullable().optional(),
  avg_latency_seconds: z.number().nullable().optional(),
  max_latency_seconds: z.number().nullable().optional(),
});

const trendRowSchema = z.object({
  date: z.string().nullable().optional(),
  total_cost: z.number().nullable().optional(),
  query_count: z.number().nullable().optional(),
  prompt_tokens: z.number().nullable().optional(),
  completion_tokens: z.number().nullable().optional(),
});

const modelBreakdownRowSchema = z.object({
  model: z.string().nullable().optional(),
  llm_span_count: z.number().nullable().optional(),
  query_count: z.number().nullable().optional(),
  total_cost: z.number().nullable().optional(),
  avg_cost: z.number().nullable().optional(),
  prompt_tokens: z.number().nullable().optional(),
  completion_tokens: z.number().nullable().optional(),
});

const recentSpanRowSchema = z.object({
  id: z.string().nullable().optional(),
  created: z.string(),
  model: z.string().nullable().optional(),
  estimated_cost: z.number().nullable().optional(),
  latency_seconds: z.number().nullable().optional(),
  prompt_tokens: z.number().nullable().optional(),
  completion_tokens: z.number().nullable().optional(),
  root_span_id: z.string().nullable().optional(),
});

const btqlResponseSchema = <TRow extends z.ZodTypeAny>(rowSchema: TRow) =>
  z.object({
    data: z.array(rowSchema),
  });

let cachedProjectIdPromise: Promise<string> | null = null;

const RANGE_DAY_COUNT: Record<ObservabilityRange, number> = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
};

function getBraintrustApiKey() {
  const apiKey = process.env.BRAINTRUST_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing BRAINTRUST_API_KEY. Add it to apps/web/.env.local to load the observability dashboard."
    );
  }

  return apiKey;
}

function getConfiguredProjectName() {
  const projectName = process.env.BRAINTRUST_PROJECT_NAME?.trim();

  return projectName || null;
}

function getProjectName() {
  const projectName = getConfiguredProjectName();

  if (projectName) {
    return projectName;
  }

  if (process.env.BRAINTRUST_PROJECT_ID) {
    return "Unknown project";
  }

  throw new Error(
    "Missing BRAINTRUST_PROJECT_NAME. Add it to apps/web/.env.local or set BRAINTRUST_PROJECT_ID to skip project-name lookup."
  );
}

function getRangeInterval(range: ObservabilityRange) {
  const match = OBSERVABILITY_RANGE_OPTIONS.find((option) => option.id === range);

  if (!match) {
    throw new Error(`Unsupported observability range: ${range}`);
  }

  return match.btqlInterval;
}

function asNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toUtcDayKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTrendDayKey(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return toUtcDayKey(parsed);
}

async function fetchBraintrustJson<T>(
  input: string,
  init: RequestInit,
  schema: z.ZodSchema<T>
) {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${getBraintrustApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Braintrust request failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const json = await response.json();

  return schema.parse(json);
}

async function runBtql<TRow extends z.ZodTypeAny>(
  query: string,
  rowSchema: TRow
) {
  const response = await fetchBraintrustJson(
    `${BRAINTRUST_API_URL}/btql`,
    {
      method: "POST",
      body: JSON.stringify({ query, fmt: "json" }),
    },
    btqlResponseSchema(rowSchema)
  );

  return response.data;
}

async function resolveProjectId() {
  const configuredProjectId = process.env.BRAINTRUST_PROJECT_ID;

  if (configuredProjectId) {
    return configuredProjectId;
  }

  if (!cachedProjectIdPromise) {
    cachedProjectIdPromise = (async () => {
      const projectName = getConfiguredProjectName();

      if (!projectName) {
        throw new Error(
          "Missing BRAINTRUST_PROJECT_NAME. Add it to apps/web/.env.local or set BRAINTRUST_PROJECT_ID to skip project-name lookup."
        );
      }

      const response = await fetchBraintrustJson(
        `${BRAINTRUST_API_URL}/v1/project?limit=200`,
        { method: "GET" },
        projectsResponseSchema
      );

      const project = response.objects.find((entry) => entry.name === projectName);

      if (!project) {
        throw new Error(
          `Braintrust project \"${projectName}\" was not found for the configured API key.`
        );
      }

      return project.id;
    })().catch((error) => {
      cachedProjectIdPromise = null;
      throw error;
    });
  }

  return cachedProjectIdPromise;
}

function buildBaseFilter(projectId: string, range: ObservabilityRange) {
  return `
    FROM project_logs('${projectId}', shape => 'traces')
    WHERE created > now() - interval ${getRangeInterval(range)}
      AND span_attributes.type = 'llm'
  `;
}

function toSummary(
  row:
    | z.infer<typeof summaryRowSchema>
    | undefined
): ObservabilitySummary {
  const llmSpanCount = asNumber(row?.llm_span_count);
  const queryCount = asNumber(row?.query_count);
  const promptTokens = asNumber(row?.prompt_tokens);
  const completionTokens = asNumber(row?.completion_tokens);
  const totalCostUsd = asNumber(row?.total_cost);
  const averageLatencySeconds = asNumber(row?.avg_latency_seconds);
  const maxLatencySeconds = asNumber(row?.max_latency_seconds);

  return {
    llmSpanCount,
    queryCount,
    totalCostUsd,
    promptTokens,
    completionTokens,
    averageLatencySeconds,
    maxLatencySeconds,
    averageCostPerQueryUsd: queryCount > 0 ? totalCostUsd / queryCount : 0,
    averageTokensPerQuery:
      queryCount > 0 ? (promptTokens + completionTokens) / queryCount : 0,
  };
}

function toTrendPoint(
  row: z.infer<typeof trendRowSchema>
): ObservabilityTrendPoint | null {
  if (!row.date) {
    return null;
  }

  return {
    date: row.date,
    totalCostUsd: asNumber(row.total_cost),
    queryCount: asNumber(row.query_count),
    promptTokens: asNumber(row.prompt_tokens),
    completionTokens: asNumber(row.completion_tokens),
  };
}

function toModelBreakdown(
  row: z.infer<typeof modelBreakdownRowSchema>
): ObservabilityModelBreakdown {
  return {
    model: row.model || "Unknown model",
    llmSpanCount: asNumber(row.llm_span_count),
    queryCount: asNumber(row.query_count),
    totalCostUsd: asNumber(row.total_cost),
    averageCostPerQueryUsd: asNumber(row.avg_cost),
    promptTokens: asNumber(row.prompt_tokens),
    completionTokens: asNumber(row.completion_tokens),
  };
}

function fillTrendGaps(
  range: ObservabilityRange,
  rows: ObservabilityTrendPoint[]
) {
  const pointsByDay = new Map(
    rows.map((row) => [getTrendDayKey(row.date), row] as const)
  );
  const pointCount = RANGE_DAY_COUNT[range];
  const endDate = new Date();
  const cursor = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate() - (pointCount - 1)
    )
  );
  const filled: ObservabilityTrendPoint[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const key = toUtcDayKey(cursor);
    const existingPoint = pointsByDay.get(key);

    filled.push(
      existingPoint ?? {
        date: key,
        totalCostUsd: 0,
        queryCount: 0,
        promptTokens: 0,
        completionTokens: 0,
      }
    );

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return filled;
}

function sortModelBreakdown(rows: ObservabilityModelBreakdown[]) {
  return [...rows].sort((left, right) => {
    if (right.totalCostUsd !== left.totalCostUsd) {
      return right.totalCostUsd - left.totalCostUsd;
    }

    if (right.queryCount !== left.queryCount) {
      return right.queryCount - left.queryCount;
    }

    return right.llmSpanCount - left.llmSpanCount;
  });
}

function toRecentSpan(
  row: z.infer<typeof recentSpanRowSchema>
): ObservabilityRecentSpan {
  return {
    spanId:
      row.id ||
      `${row.root_span_id || "unknown-root-span"}:${row.created}`,
    created: row.created,
    model: row.model || "Unknown model",
    rootSpanId: row.root_span_id || "unknown-root-span",
    estimatedCostUsd: asNumber(row.estimated_cost),
    latencySeconds: asNumber(row.latency_seconds),
    promptTokens: asNumber(row.prompt_tokens),
    completionTokens: asNumber(row.completion_tokens),
  };
}

export async function getObservabilityDashboard(
  range: ObservabilityRange
): Promise<ObservabilityDashboardData> {
  const projectId = await resolveProjectId();
  const projectName = getProjectName();
  const baseFilter = buildBaseFilter(projectId, range);

  const [summaryRows, trendRows, modelBreakdownRows, recentSpanRows] =
    await Promise.all([
      runBtql(
        `
          SELECT
            count(1) AS llm_span_count,
            count(distinct root_span_id) AS query_count,
            sum(estimated_cost()) AS total_cost,
            sum(metrics.prompt_tokens) AS prompt_tokens,
            sum(metrics.completion_tokens) AS completion_tokens,
            avg(metrics.end - metrics.start) AS avg_latency_seconds,
            max(metrics.end - metrics.start) AS max_latency_seconds
          ${baseFilter}
        `,
        summaryRowSchema
      ),
      runBtql(
        `
          SELECT
            day(created) AS date,
            sum(estimated_cost()) AS total_cost,
            count(distinct root_span_id) AS query_count,
            sum(metrics.prompt_tokens) AS prompt_tokens,
            sum(metrics.completion_tokens) AS completion_tokens
          ${baseFilter}
          GROUP BY 1
          ORDER BY date ASC
        `,
        trendRowSchema
      ),
      runBtql(
        `
          SELECT
            metadata.model AS model,
            count(1) AS llm_span_count,
            count(distinct root_span_id) AS query_count,
            sum(estimated_cost()) AS total_cost,
            sum(estimated_cost()) / count(distinct root_span_id) AS avg_cost,
            sum(metrics.prompt_tokens) AS prompt_tokens,
            sum(metrics.completion_tokens) AS completion_tokens
          ${baseFilter}
          GROUP BY 1
          ORDER BY total_cost DESC
          LIMIT 8
        `,
        modelBreakdownRowSchema
      ),
      runBtql(
        `
          SELECT
            id,
            created,
            metadata.model AS model,
            estimated_cost() AS estimated_cost,
            metrics.end - metrics.start AS latency_seconds,
            metrics.prompt_tokens AS prompt_tokens,
            metrics.completion_tokens AS completion_tokens,
            root_span_id
          ${baseFilter}
          ORDER BY created DESC
          LIMIT 8
        `,
        recentSpanRowSchema
      ),
    ]);

  return {
    projectId,
    projectName,
    range,
    summary: toSummary(summaryRows[0]),
    trend: fillTrendGaps(
      range,
      trendRows.map(toTrendPoint).filter((row) => row !== null)
    ),
    modelBreakdown: sortModelBreakdown(modelBreakdownRows.map(toModelBreakdown)),
    recentSpans: recentSpanRows.map(toRecentSpan),
  };
}