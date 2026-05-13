import "server-only";
import { Redis } from "@upstash/redis";
import { VECTOR_NAMESPACE } from "./config";
import type { EmbeddedChunk, IndexedChunk } from "./types";

const CORPUS_SNAPSHOT_KEY = `embeddings:corpus:${VECTOR_NAMESPACE}:chunks`;

let cachedRedis: Redis | null | undefined;

function getRedisClient() {
  if (cachedRedis !== undefined) {
    return cachedRedis;
  }

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    cachedRedis = null;
    return cachedRedis;
  }

  cachedRedis = Redis.fromEnv();
  return cachedRedis;
}

function toIndexedChunk(chunk: EmbeddedChunk): IndexedChunk {
  const { vector: _vector, ...indexedChunk } = chunk;
  return indexedChunk;
}

function isIndexedChunkArray(value: unknown): value is IndexedChunk[] {
  return Array.isArray(value) && value.every((chunk) => {
    return (
      chunk !== null &&
      typeof chunk === "object" &&
      typeof (chunk as IndexedChunk).chunkId === "string" &&
      typeof (chunk as IndexedChunk).chunkText === "string"
    );
  });
}

export async function readIndexedChunkCorpus() {
  const redis = getRedisClient();

  if (!redis) {
    return [];
  }

  const snapshot = await redis.get<unknown>(CORPUS_SNAPSHOT_KEY);
  return isIndexedChunkArray(snapshot) ? snapshot : [];
}

export async function writeIndexedChunkCorpus(
  chunks: EmbeddedChunk[],
  options: { reset?: boolean } = {}
) {
  const redis = getRedisClient();

  if (!redis || chunks.length === 0) {
    return;
  }

  const nextChunks = chunks.map(toIndexedChunk);

  if (options.reset) {
    await redis.set(CORPUS_SNAPSHOT_KEY, nextChunks);
    return;
  }

  const existingChunks = await readIndexedChunkCorpus();
  const merged = new Map(existingChunks.map((chunk) => [chunk.chunkId, chunk]));

  for (const chunk of nextChunks) {
    merged.set(chunk.chunkId, chunk);
  }

  await redis.set(CORPUS_SNAPSHOT_KEY, [...merged.values()]);
}