import "server-only";

import { Eval } from "braintrust";
import { z } from "zod";
import { generateObject, generateText } from "@/lib/ai";
import {
  buildRagSystemPrompt,
  RAG_CONTEXT_LIMIT,
  RAG_MODEL_ID,
  retrieveRagContext,
} from "@/lib/rag/server";
import type { RagCitation } from "@/lib/rag/types";
import {
  arcRaidersRagV1Dataset,
  ARC_RAIDERS_RAG_V1_DATASET,
} from "./dataset";
import type {
  RagEvalCase,
  RagEvalCaseResult,
  RagEvalEvidenceTarget,
  RagEvaluationRunSummary,
  RagEvalTaskOutput,
  RagEvalVariant,
  RagEvalVariantSummary,
} from "./types";

const DATASET_ID = "arc-raiders-rag-v1";
const DATASET_LABEL = "ARC Raiders RAG v1";
const PROJECT_NAME = process.env.BRAINTRUST_PROJECT_NAME?.trim() || "ai-engineer";
const JUDGE_MODEL_ID = RAG_MODEL_ID;
const MAX_CONCURRENCY = 4;

const generationJudgeSchema = z.object({
  correctnessScore: z.number().min(0).max(1),
  relevanceScore: z.number().min(0).max(1),
  hallucinationRiskRating: z.enum(["low", "medium", "high"]),
  hallucinationRiskScore: z.number().min(0).max(1),
  correctnessRationale: z.string().min(1),
  relevanceRationale: z.string().min(1),
  hallucinationRiskRationale: z.string().min(1),
});

export const RAG_EVAL_DEFAULT_VARIANTS: RagEvalVariant[] = [
  {
    id: "vector-only",
    label: "Vector only",
    retrievalMode: "vector-only",
    modelId: RAG_MODEL_ID,
    promptVersion: "rag-v1",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    retrievalMode: "hybrid",
    modelId: RAG_MODEL_ID,
    promptVersion: "rag-v1",
  },
  {
    id: "hybrid-rerank",
    label: "Hybrid + rerank",
    retrievalMode: "hybrid-rerank",
    modelId: RAG_MODEL_ID,
    promptVersion: "rag-v1",
  },
  {
    id: "hybrid-rerank-prompt-v2",
    label: "Hybrid + rerank · prompt v2",
    retrievalMode: "hybrid-rerank",
    modelId: RAG_MODEL_ID,
    promptVersion: "rag-v2",
  },
  {
    id: "hybrid-rerank-gpt-5-mini",
    label: "Hybrid + rerank · GPT-5 mini",
    retrievalMode: "hybrid-rerank",
    modelId: "openai/gpt-5-mini",
    promptVersion: "rag-v1",
  },
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function citationMatchesTarget(citation: RagCitation, target: RagEvalEvidenceTarget) {
  if (target.sourceType && citation.sourceType !== target.sourceType) {
    return false;
  }

  if (target.url && citation.url !== target.url) {
    return false;
  }

  if (
    target.titleContains &&
    !normalizeText(citation.title).includes(normalizeText(target.titleContains))
  ) {
    return false;
  }

  if (target.entityName) {
    const normalizedEntity = normalizeText(target.entityName);
    const citationEntities = citation.entityNames.map((entity) => normalizeText(entity));

    if (
      !citationEntities.includes(normalizedEntity) &&
      !normalizeText(citation.title).includes(normalizedEntity)
    ) {
      return false;
    }
  }

  return true;
}

function computeRetrievalMetrics(expected: RagEvalCase, citations: RagCitation[]) {
  const matchedTargets = expected.expectedEvidence.filter((target) =>
    citations.some((citation) => citationMatchesTarget(citation, target))
  );
  const firstRelevantRank = citations.findIndex((citation) =>
    expected.expectedEvidence.some((target) => citationMatchesTarget(citation, target))
  );
  const matchedSourceTypes = expected.expectedSourceTypes.filter((sourceType) =>
    citations.some((citation) => citation.sourceType === sourceType)
  );
  const matchedEntities = expected.expectedEntityNames.filter((entityName) => {
    const normalizedEntity = normalizeText(entityName);
    return citations.some((citation) => {
      const entities = citation.entityNames.map((entity) => normalizeText(entity));
      return (
        entities.includes(normalizedEntity) ||
        normalizeText(citation.title).includes(normalizedEntity)
      );
    });
  });

  return {
    recallAtK:
      expected.expectedEvidence.length > 0
        ? matchedTargets.length / expected.expectedEvidence.length
        : 0,
    mrrAtK: firstRelevantRank >= 0 ? 1 / (firstRelevantRank + 1) : 0,
    sourceTypeCoverage:
      expected.expectedSourceTypes.length > 0
        ? matchedSourceTypes.length / expected.expectedSourceTypes.length
        : 0,
    entityCoverage:
      expected.expectedEntityNames.length > 0
        ? matchedEntities.length / expected.expectedEntityNames.length
        : 0,
    matchedTargets,
    matchedSourceTypes,
    matchedEntities,
  };
}

async function judgeGeneration(expected: RagEvalCase, output: RagEvalTaskOutput) {
  const citationBlock = output.citations
    .map((citation, index) => {
      const entityNames = citation.entityNames.join(", ") || "unknown";

      return [
        `[${index + 1}] ${citation.title}`,
        `source_type: ${citation.sourceType}`,
        `entity_names: ${entityNames}`,
        `excerpt: ${citation.chunkText}`,
      ].join("\n");
    })
    .join("\n\n");

  const result = await generateObject({
    model: JUDGE_MODEL_ID,
    schema: generationJudgeSchema,
    system: `You are evaluating a retrieval-grounded ARC Raiders answer.

Score each dimension from 0 to 1.

Rules:
- Base correctness on whether the answer matches the expected answer traits.
- Base relevance on whether the answer directly addresses the user question.
- Base hallucination risk on whether the answer stays inside the retrieved evidence.
- Treat 1.0 as best.
- If the answer invents unsupported item details, categories, or comparisons, lower correctness and hallucination risk score.
- If the answer omits a required source line when sources are required, lower correctness and relevance.
- Keep rationales short and concrete.`,
    prompt: [
      `Question: ${expected.question}`,
      `Expected entity names: ${expected.expectedEntityNames.join(", ") || "none"}`,
      `Expected source types: ${expected.expectedSourceTypes.join(", ") || "none"}`,
      `Required answer traits: ${expected.answerTraits.mustMention.join(" | ") || "none"}`,
      `Forbidden answer traits: ${expected.answerTraits.shouldNotMention.join(" | ") || "none"}`,
      `Sources required: ${expected.answerTraits.mustCiteSources ? "yes" : "no"}`,
      expected.answerTraits.notes ? `Notes: ${expected.answerTraits.notes}` : null,
      "Retrieved citations:",
      citationBlock || "No citations were retrieved.",
      "Answer:",
      output.answer || "",
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n\n"),
  });

  return result.object;
}

async function runTask(input: RagEvalCase, variant: RagEvalVariant) {
  const context = await retrieveRagContext(input.question, {
    retrievalMode: variant.retrievalMode,
  });
  const result = await generateText({
    model: variant.modelId,
    system: buildRagSystemPrompt(context, {
      promptVersion: variant.promptVersion,
    }),
    prompt: input.question,
  });

  return {
    answer: result.text.trim(),
    citations: context.citations,
    retrievalMode: variant.retrievalMode,
    modelId: variant.modelId,
    promptVersion: variant.promptVersion,
  } satisfies RagEvalTaskOutput;
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return error ? String(error) : null;
}

function averageScores(results: RagEvalCaseResult[]) {
  const totals = new Map<string, { sum: number; count: number }>();

  for (const result of results) {
    for (const [name, score] of Object.entries(result.scores)) {
      if (typeof score !== "number") {
        continue;
      }

      const existing = totals.get(name) ?? { sum: 0, count: 0 };
      existing.sum += score;
      existing.count += 1;
      totals.set(name, existing);
    }
  }

  return Object.fromEntries(
    [...totals.entries()].map(([name, value]) => [name, value.sum / value.count])
  );
}

function splitMetricGroups(metrics: Record<string, number>) {
  const retrievalMetrics = Object.fromEntries(
    Object.entries(metrics).filter(([name]) => name.startsWith("retrieval_"))
  );
  const generationMetrics = Object.fromEntries(
    Object.entries(metrics).filter(([name]) => name.startsWith("generation_"))
  );

  return { retrievalMetrics, generationMetrics };
}

function scoreFailedCases(results: RagEvalCaseResult[]) {
  return [...results]
    .sort((left, right) => {
      const leftAggregate = Object.values(left.scores).reduce<number>(
        (sum, score) => sum + (typeof score === "number" ? score : 0),
        0
      );
      const rightAggregate = Object.values(right.scores).reduce<number>(
        (sum, score) => sum + (typeof score === "number" ? score : 0),
        0
      );

      return leftAggregate - rightAggregate;
    })
    .slice(0, 5);
}

async function runVariantEvaluation(
  variant: RagEvalVariant,
  startedAt: string
): Promise<RagEvalVariantSummary> {
  const experimentName = `${DATASET_ID}-${variant.id}-${startedAt.replace(/[:.]/g, "-")}`;
  let experimentId: string | null = null;
  let projectId: string | null = null;

  const result = await Eval(PROJECT_NAME, {
    data: () => arcRaidersRagV1Dataset.map((example) => ({ input: example, expected: example })),
    task: async (input) => runTask(input, variant),
    scores: [
      ({ output, expected }) => {
        const metrics = computeRetrievalMetrics(expected, output.citations);

        return [
          {
            name: `retrieval_recall_at_${RAG_CONTEXT_LIMIT}`,
            score: metrics.recallAtK,
            metadata: {
              matchedTargets: metrics.matchedTargets.length,
              expectedTargets: expected.expectedEvidence.length,
            },
          },
          {
            name: `retrieval_mrr_at_${RAG_CONTEXT_LIMIT}`,
            score: metrics.mrrAtK,
          },
          {
            name: "retrieval_source_type_coverage",
            score: metrics.sourceTypeCoverage,
            metadata: {
              matchedSourceTypes: metrics.matchedSourceTypes,
            },
          },
          {
            name: "retrieval_entity_coverage",
            score: metrics.entityCoverage,
            metadata: {
              matchedEntities: metrics.matchedEntities,
            },
          },
        ];
      },
      ({ output, expected }) => ({
        name: "generation_sources_line",
        score:
          !expected.answerTraits.mustCiteSources || /sources\s*:/i.test(output.answer)
            ? 1
            : 0,
      }),
      async ({ output, expected }) => {
        const verdict = await judgeGeneration(expected, output);

        return [
          {
            name: "generation_correctness",
            score: verdict.correctnessScore,
            metadata: { rationale: verdict.correctnessRationale },
          },
          {
            name: "generation_relevance",
            score: verdict.relevanceScore,
            metadata: { rationale: verdict.relevanceRationale },
          },
          {
            name: "generation_hallucination_risk",
            score: verdict.hallucinationRiskScore,
            metadata: {
              rating: verdict.hallucinationRiskRating,
              rationale: verdict.hallucinationRiskRationale,
            },
          },
        ];
      },
    ],
    experimentName,
    metadata: {
      objective: 5,
      datasetId: DATASET_ID,
      datasetLabel: DATASET_LABEL,
      datasetSize: ARC_RAIDERS_RAG_V1_DATASET.length,
      variantId: variant.id,
      retrievalMode: variant.retrievalMode,
      modelId: variant.modelId,
      promptVersion: variant.promptVersion,
    },
    maxConcurrency: MAX_CONCURRENCY,
  }, {
    onStart: (metadata) => {
      experimentId = metadata.experimentId ?? null;
      projectId = metadata.projectId ?? null;
    },
  });

  const cases: RagEvalCaseResult[] = result.results.map((entry) => ({
    caseId: entry.input.id,
    question: entry.input.question,
    scores: entry.scores,
    answer: entry.output?.answer ?? "",
    citations: entry.output?.citations ?? [],
    error: asErrorMessage(entry.error),
  }));
  const metrics = averageScores(cases);
  const { retrievalMetrics, generationMetrics } = splitMetricGroups(metrics);

  return {
    variant,
    experimentName,
    experimentId,
    projectId,
    sampleCount: cases.length,
    metrics,
    retrievalMetrics,
    generationMetrics,
    cases,
    failedCases: scoreFailedCases(cases),
  };
}

export async function runRagEvaluationHarness(): Promise<RagEvaluationRunSummary> {
  const startedAt = new Date().toISOString();
  const variants: RagEvalVariantSummary[] = [];

  for (const variant of RAG_EVAL_DEFAULT_VARIANTS) {
    variants.push(await runVariantEvaluation(variant, startedAt));
  }

  return {
    datasetId: DATASET_ID,
    datasetLabel: DATASET_LABEL,
    sampleCount: ARC_RAIDERS_RAG_V1_DATASET.length,
    startedAt,
    completedAt: new Date().toISOString(),
    variants,
  };
}