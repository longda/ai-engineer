import type { ChunkStrategy } from "./types";

export const EMBEDDING_MODEL_ID = "openai/text-embedding-3-small";
export const VECTOR_NAMESPACE = "arc-raiders-v1";
export const DEFAULT_CHUNK_STRATEGY: ChunkStrategy = "semantic";

export const FIXED_CHUNK_SIZE = 900;
export const OVERLAPPING_CHUNK_SIZE = 900;
export const OVERLAPPING_CHUNK_OVERLAP = 180;
export const SEMANTIC_CHUNK_TARGET = 850;
export const SEARCH_TOP_K = 8;
export const CHUNKING_EVAL_TOP_K = 3;

export const MAX_DERIVED_PATCH_RECORDS_PER_DOCUMENT = 12;
export const MAX_SAMPLE_DOCUMENTS = 6;