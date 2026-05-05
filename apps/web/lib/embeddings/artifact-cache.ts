import "server-only";
import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { canonicalizeUrl } from "./source-map";
import type { CachedScrapeArtifact } from "./types";

const SCRAPE_CACHE_KEY_PREFIX = "embeddings:scrape:";

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

function createCacheKey(url: string) {
  const digest = crypto
    .createHash("sha256")
    .update(canonicalizeUrl(url))
    .digest("hex");

  return `${SCRAPE_CACHE_KEY_PREFIX}${digest}`;
}

export function getArtifactCacheStore() {
  return getRedisClient() ? ("redis" as const) : ("none" as const);
}

export async function readCachedScrapeArtifacts(urls: string[]) {
  const redis = getRedisClient();
  const artifacts = new Map<string, CachedScrapeArtifact>();

  if (!redis || urls.length === 0) {
    return artifacts;
  }

  await Promise.all(
    urls.map(async (url) => {
      const canonicalUrl = canonicalizeUrl(url);
      const cached = await redis.get<CachedScrapeArtifact>(
        createCacheKey(canonicalUrl)
      );

      if (!cached || typeof cached !== "object") {
        return;
      }

      if (
        typeof cached.title !== "string" ||
        typeof cached.markdown !== "string" ||
        typeof cached.cachedAt !== "string"
      ) {
        return;
      }

      const cachedSourceUrl =
        typeof cached.metadata?.sourceURL === "string"
          ? canonicalizeUrl(cached.metadata.sourceURL)
          : typeof cached.metadata?.url === "string"
            ? canonicalizeUrl(cached.metadata.url)
            : null;

      // Ignore stale entries that were cached under the wrong key.
      if (cachedSourceUrl && cachedSourceUrl !== canonicalUrl) {
        return;
      }

      const links = Array.isArray(cached.links)
        ? cached.links.filter((link): link is string => typeof link === "string")
        : [];

      artifacts.set(canonicalUrl, {
        url: canonicalUrl,
        title: cached.title,
        markdown: cached.markdown,
        links,
        metadata:
          cached.metadata && typeof cached.metadata === "object"
            ? cached.metadata
            : null,
        cachedAt: cached.cachedAt,
      });
    })
  );

  return artifacts;
}

export async function writeCachedScrapeArtifacts(
  artifacts: CachedScrapeArtifact[]
) {
  const redis = getRedisClient();

  if (!redis || artifacts.length === 0) {
    return;
  }

  await Promise.all(
    artifacts.map((artifact) =>
      redis.set(createCacheKey(artifact.url), {
        ...artifact,
        url: canonicalizeUrl(artifact.url),
      })
    )
  );
}

export async function deleteCachedScrapeArtifacts(urls: string[]) {
  const redis = getRedisClient();

  if (!redis || urls.length === 0) {
    return;
  }

  await Promise.all(
    urls.map((url) => redis.del(createCacheKey(canonicalizeUrl(url))))
  );
}