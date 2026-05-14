import { z } from "zod";
import { sourceTypeSchema } from "@/lib/embeddings/types";
import type { RagCitation, RagRetrievalMode } from "@/lib/rag/types";

export const ragEvalDifficultySchema = z.enum(["easy", "medium", "hard"]);

export const ragEvalQuestionTypeSchema = z.enum([
  "item_lookup",
  "category_lookup",
  "relationship_lookup",
  "comparison",
]);

export const ragEvalEvidenceTargetSchema = z.object({
  sourceType: sourceTypeSchema.optional(),
  entityName: z.string().min(1).optional(),
  titleContains: z.string().min(1).optional(),
  url: z
    .string()
    .regex(/^https?:\/\//, "Expected an http(s) URL.")
    .optional(),
});

export const ragEvalAnswerTraitsSchema = z.object({
  mustMention: z.array(z.string().min(1)).default([]),
  shouldNotMention: z.array(z.string().min(1)).default([]),
  mustCiteSources: z.boolean().default(true),
  notes: z.string().min(1).optional(),
});

export const ragEvalCaseSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  questionType: ragEvalQuestionTypeSchema,
  difficulty: ragEvalDifficultySchema,
  expectedSourceTypes: z.array(sourceTypeSchema).default([]),
  expectedEntityNames: z.array(z.string().min(1)).default([]),
  expectedEvidence: z.array(ragEvalEvidenceTargetSchema).min(1),
  answerTraits: ragEvalAnswerTraitsSchema,
});

export const ragEvalVariantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  retrievalMode: z.enum(["vector-only", "hybrid", "hybrid-rerank"]),
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
});

export type RagEvalDifficulty = z.infer<typeof ragEvalDifficultySchema>;
export type RagEvalQuestionType = z.infer<typeof ragEvalQuestionTypeSchema>;
export type RagEvalEvidenceTarget = z.infer<typeof ragEvalEvidenceTargetSchema>;
export type RagEvalAnswerTraits = z.infer<typeof ragEvalAnswerTraitsSchema>;
export type RagEvalCase = z.infer<typeof ragEvalCaseSchema>;
export type RagEvalVariant = z.infer<typeof ragEvalVariantSchema>;

export type RagEvalTaskOutput = {
  answer: string;
  citations: RagCitation[];
  retrievalMode: RagRetrievalMode;
  modelId: string;
  promptVersion: string;
};

export type RagEvalCaseResult = {
  caseId: string;
  question: string;
  scores: Record<string, number | null>;
  answer: string;
  citations: RagCitation[];
  error: string | null;
};

export type RagEvalVariantSummary = {
  variant: RagEvalVariant;
  experimentName: string;
  experimentId: string | null;
  projectId: string | null;
  sampleCount: number;
  metrics: Record<string, number>;
  retrievalMetrics: Record<string, number>;
  generationMetrics: Record<string, number>;
  cases: RagEvalCaseResult[];
  failedCases: RagEvalCaseResult[];
};

export type RagEvaluationRunSummary = {
  datasetId: string;
  datasetLabel: string;
  sampleCount: number;
  startedAt: string;
  completedAt: string;
  variants: RagEvalVariantSummary[];
};