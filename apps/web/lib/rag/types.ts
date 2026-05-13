import type { EntityType, SourceType } from "@/lib/embeddings/types";

export type RagCitation = {
  chunkId: string;
  title: string;
  url: string;
  sourceType: SourceType;
  entityType: EntityType;
  entityNames: string[];
  score: number;
  chunkText: string;
  retrievalScore?: number;
  rerankScore?: number;
  vectorRank?: number;
  keywordRank?: number;
};

export type RagRetrievalMode =
  | "vector-only"
  | "hybrid"
  | "hybrid-rerank";

export type RagContextPacket = {
  query: string;
  retrievalMode: RagRetrievalMode;
  citations: RagCitation[];
};

export type RagMeasurementRow = {
  query: string;
  retrievalMode: RagRetrievalMode;
  citationCount: number;
  topTitles: string[];
};

export type RagMeasurementPacket = {
  queries: string[];
  rows: RagMeasurementRow[];
};