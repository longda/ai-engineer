import { z } from "zod";

const httpUrlSchema = z
  .string()
  .regex(/^https?:\/\//, "Expected an http(s) URL.");

const isoTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/, "Expected a UTC ISO timestamp.");

export const sourceTypeSchema = z.enum([
  "official_docs",
  "official_updates",
  "community_items",
  "derived_patch_records",
]);

export const contentTypeSchema = z.enum([
  "docs_page",
  "news_page",
  "patch_page",
  "item_page",
  "item_index",
  "derived_change_record",
]);

export const entityTypeSchema = z.enum([
  "item",
  "weapon",
  "ammo",
  "material",
  "system",
  "patch",
  "update",
  "mixed",
  "unknown",
]);

export const freshnessTierSchema = z.enum([
  "evergreen",
  "update",
  "change_record",
]);

export const chunkStrategySchema = z.enum([
  "fixed",
  "overlapping",
  "semantic",
]);

export const changeTypeSchema = z.enum([
  "add",
  "remove",
  "buff",
  "nerf",
  "rework",
  "fix",
  "system_change",
  "unknown",
]);

export const artifactCacheStoreSchema = z.enum(["redis", "none"]);

export const scrapeCacheStateSchema = z.enum(["hit", "miss"]);

export const normalizedSourceDocumentSchema = z.object({
  documentId: z.string().min(1),
  sourceType: sourceTypeSchema,
  sourceName: z.string().min(1),
  url: httpUrlSchema,
  originUrl: httpUrlSchema.nullable(),
  title: z.string().min(1),
  contentType: contentTypeSchema,
  entityType: entityTypeSchema,
  entityNames: z.array(z.string()).default([]),
  publishedAt: isoTimestampSchema.nullable(),
  fetchedAt: isoTimestampSchema,
  freshnessTier: freshnessTierSchema,
  tags: z.array(z.string()).default([]),
  language: z.string().min(1),
  rawText: z.string(),
  normalizedText: z.string(),
  structuredFields: z.record(z.string(), z.unknown()).nullable(),
  originDocumentId: z.string().nullable(),
});

export const indexedChunkSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  chunkStrategy: chunkStrategySchema,
  chunkText: z.string().min(1),
  charCount: z.number().int().nonnegative(),
  tokenEstimate: z.number().int().nonnegative(),
  embeddingModel: z.string().min(1),
  sourceType: sourceTypeSchema,
  sourceName: z.string().min(1),
  url: httpUrlSchema,
  title: z.string().min(1),
  contentType: contentTypeSchema,
  entityType: entityTypeSchema,
  entityNames: z.array(z.string()).default([]),
  publishedAt: isoTimestampSchema.nullable(),
  fetchedAt: isoTimestampSchema,
  freshnessTier: freshnessTierSchema,
  tags: z.array(z.string()).default([]),
});

export const chunkingEvalQuerySchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  expectedTerms: z.array(z.string().min(1)).min(1),
});

export const chunkingEvalResultSchema = z.object({
  strategy: chunkStrategySchema,
  recallAt3: z.number(),
  hitCount: z.number().int().nonnegative(),
  queryCount: z.number().int().positive(),
});

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type ContentType = z.infer<typeof contentTypeSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type FreshnessTier = z.infer<typeof freshnessTierSchema>;
export type ChunkStrategy = z.infer<typeof chunkStrategySchema>;
export type ChangeType = z.infer<typeof changeTypeSchema>;
export type ArtifactCacheStore = z.infer<typeof artifactCacheStoreSchema>;
export type ScrapeCacheState = z.infer<typeof scrapeCacheStateSchema>;
export type NormalizedSourceDocument = z.infer<
  typeof normalizedSourceDocumentSchema
>;
export type IndexedChunk = z.infer<typeof indexedChunkSchema>;
export type ChunkingEvalQuery = z.infer<typeof chunkingEvalQuerySchema>;
export type ChunkingEvalResult = z.infer<typeof chunkingEvalResultSchema>;

export type EmbeddedChunk = IndexedChunk & {
  vector: number[];
};

export type CachedScrapeArtifactMetadata = {
  publishedAt?: string;
  publishedTime?: string;
  sourceURL?: string;
  url?: string;
};

export type CachedScrapeArtifact = {
  url: string;
  title: string;
  markdown: string;
  links: string[];
  metadata: CachedScrapeArtifactMetadata | null;
  cachedAt: string;
};

export type ScrapedPage = CachedScrapeArtifact & {
  cacheState: ScrapeCacheState;
};

export type ScrapeBatchResult = {
  pages: ScrapedPage[];
  cacheHitCount: number;
  cacheMissCount: number;
  cacheStore: ArtifactCacheStore;
};

export type IngestedDocumentSummary = {
  documentId: string;
  title: string;
  url: string;
  sourceType: SourceType;
  contentType: ContentType;
  chunkCount: number;
};

export type IngestRunSummary = {
  namespace: string;
  chunkStrategy: ChunkStrategy;
  embeddingModel: string;
  artifactCacheStore: ArtifactCacheStore;
  cacheHitCount: number;
  cacheMissCount: number;
  discoverySeedCount: number;
  discoveredUrlCount: number;
  scrapedDocumentCount: number;
  normalizedDocumentCount: number;
  derivedPatchRecordCount: number;
  upsertedChunkCount: number;
  sourceBreakdown: Record<SourceType, number>;
  samples: IngestedDocumentSummary[];
};

export type SemanticSearchResult = {
  chunkId: string;
  score: number;
  chunkText: string;
  metadata: IndexedChunk;
};