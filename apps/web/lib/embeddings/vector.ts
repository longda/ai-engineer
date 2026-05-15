import "server-only";
import { Index } from "@upstash/vector";
import { SEARCH_TOP_K, VECTOR_NAMESPACE } from "./config";
import type { ChunkMetadata, EmbeddedChunk, SemanticSearchResult } from "./types";
import { batchArray } from "./utils";

let cachedIndex: Index<ChunkMetadata> | null = null;

function toChunkMetadata(chunk: EmbeddedChunk): ChunkMetadata {
  const { chunkText: _chunkText, vector: _vector, ...metadata } = chunk;
  return metadata;
}

function getIndex() {
  if (cachedIndex) {
    return cachedIndex;
  }

  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN."
    );
  }

  cachedIndex = new Index<ChunkMetadata>({ url, token });
  return cachedIndex;
}

function getNamespace() {
  return getIndex().namespace(VECTOR_NAMESPACE);
}

export async function deleteChunksByPrefix(prefixes: string[]) {
  const namespace = getNamespace();

  for (const prefix of prefixes) {
    await namespace.delete({ prefix });
  }
}

export async function upsertChunks(
  chunks: EmbeddedChunk[],
  options: { reset?: boolean } = {}
) {
  const namespace = getNamespace();

  if (options.reset) {
    await namespace.reset();
  }

  for (const batch of batchArray(chunks, 100)) {
    await namespace.upsert(
      batch.map((chunk) => ({
        id: chunk.chunkId,
        vector: chunk.vector,
        data: chunk.chunkText,
        metadata: toChunkMetadata(chunk),
      }))
    );
  }

  return {
    namespace: VECTOR_NAMESPACE,
    upsertedChunkCount: chunks.length,
  };
}

export async function semanticSearchByVector(
  vector: number[],
  topK = SEARCH_TOP_K,
  options: { filter?: string } = {}
) {
  const results = await getNamespace().query({
    vector,
    topK,
    includeMetadata: true,
    includeData: true,
    ...(options.filter ? { filter: options.filter } : {}),
  });

  return results.map((result) => {
    const metadata = result.metadata as ChunkMetadata;

    return {
      chunkId: String(result.id),
      score: typeof result.score === "number" ? result.score : 0,
      chunkText:
        typeof result.data === "string"
          ? result.data
          : "",
      metadata,
    } satisfies SemanticSearchResult;
  });
}