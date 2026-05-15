import type {
  ContentType,
  EntityType,
  FreshnessTier,
  SourceType,
} from "@/lib/embeddings/types";

export type RagRetrievalFilters = {
  sourceTypes?: SourceType[];
  entityNames?: string[];
  tags?: string[];
  publishedAfter?: string | null;
  publishedBefore?: string | null;
};

export type RagCitation = {
  chunkId: string;
  title: string;
  url: string;
  sourceType: SourceType;
  sourceName: string;
  contentType: ContentType;
  entityType: EntityType;
  entityNames: string[];
  publishedAt: string | null;
  freshnessTier: FreshnessTier;
  tags: string[];
  tokenEstimate: number;
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
  filters?: RagRetrievalFilters;
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