import "server-only";
import { embedMany } from "@/lib/ai";
import { chunkDocument } from "./chunking";
import {
  DEFAULT_CHUNK_STRATEGY,
  EMBEDDING_MODEL_ID,
  MAX_DERIVED_PATCH_RECORDS_PER_DOCUMENT,
  MAX_SAMPLE_DOCUMENTS,
  VECTOR_NAMESPACE,
} from "./config";
import { getArtifactCacheStore } from "./artifact-cache";
import { invalidateScrapePages, scrapePages } from "./firecrawl";
import { derivePatchRecords, normalizeScrapedPage } from "./normalize";
import {
  ARC_RAIDERS_CORPUS_SEEDS,
  COMMUNITY_SOURCE_NAME,
  canonicalizeUrl,
  isCommunityItemDetailUrl,
  isOfficialEvergreenDocUrl,
  isOfficialUpdateUrl,
  OFFICIAL_DOC_SOURCE_NAME,
  OFFICIAL_UPDATE_SOURCE_NAME,
  uniqueUrls,
} from "./source-map";
import type {
  EmbeddedChunk,
  IndexedChunk,
  IngestRunSummary,
  NormalizedSourceDocument,
  SourceType,
} from "./types";
import { batchArray, hashString } from "./utils";
import { deleteChunksByPrefix, upsertChunks } from "./vector";

type IngestTarget = {
  sourceType: Exclude<SourceType, "derived_patch_records">;
  sourceName: string;
  url: string;
};

type IngestOptions = {
  reset?: boolean;
  sourceTypes?: Exclude<SourceType, "derived_patch_records">[];
  communityItemOffset?: number;
  communityItemLimit?: number;
  targetUrls?: string[];
  refreshCache?: boolean;
  repairExisting?: boolean;
};

function createSourceBreakdown() {
  return {
    official_docs: 0,
    official_updates: 0,
    community_items: 0,
    derived_patch_records: 0,
  } satisfies Record<SourceType, number>;
}

function seedToTarget(seed: IngestTarget) {
  return {
    ...seed,
    url: canonicalizeUrl(seed.url),
  };
}

function classifyTargetUrl(url: string): IngestTarget | null {
  const canonicalUrl = canonicalizeUrl(url);

  if (isCommunityItemDetailUrl(canonicalUrl)) {
    return {
      sourceType: "community_items",
      sourceName: COMMUNITY_SOURCE_NAME,
      url: canonicalUrl,
    };
  }

  if (isOfficialUpdateUrl(canonicalUrl)) {
    return {
      sourceType: "official_updates",
      sourceName: OFFICIAL_UPDATE_SOURCE_NAME,
      url: canonicalUrl,
    };
  }

  if (isOfficialEvergreenDocUrl(canonicalUrl)) {
    return {
      sourceType: "official_docs",
      sourceName: OFFICIAL_DOC_SOURCE_NAME,
      url: canonicalUrl,
    };
  }

  return null;
}

function discoverUrlsFromSeed(seed: IngestTarget, links: string[]) {
  switch (seed.sourceType) {
    case "official_docs":
      return links.filter(isOfficialEvergreenDocUrl).map((url) => ({
        sourceType: "official_docs" as const,
        sourceName: seed.sourceName,
        url,
      }));
    case "official_updates":
      return links.filter(isOfficialUpdateUrl).map((url) => ({
        sourceType: "official_updates" as const,
        sourceName: seed.sourceName,
        url,
      }));
    case "community_items":
      return links.filter(isCommunityItemDetailUrl).map((url) => ({
        sourceType: "community_items" as const,
        sourceName: seed.sourceName,
        url,
      }));
    default:
      return [];
  }
}

async function buildCorpusTargets(options: IngestOptions = {}) {
  const allowedSourceTypes = options.sourceTypes
    ? new Set(options.sourceTypes)
    : null;
  const targetUrls = options.targetUrls
    ? uniqueUrls(options.targetUrls)
    : null;

  if (targetUrls && targetUrls.length > 0) {
    const scopedTargets = targetUrls
      .map((url) => classifyTargetUrl(url))
      .filter((target): target is IngestTarget => {
        if (!target) {
          return false;
        }

        return allowedSourceTypes
          ? allowedSourceTypes.has(target.sourceType)
          : true;
      });

    return {
      discoverySeeds: [],
      discoveredTargets: [],
      discoveredUrlCount: 0,
      dedupedTargets: scopedTargets,
      discoveryCacheHitCount: 0,
      discoveryCacheMissCount: 0,
      cacheStore: getArtifactCacheStore(),
    };
  }

  const scopedSeeds = allowedSourceTypes
    ? ARC_RAIDERS_CORPUS_SEEDS.filter((seed) => allowedSourceTypes.has(seed.sourceType))
    : ARC_RAIDERS_CORPUS_SEEDS;
  const discoverySeeds = scopedSeeds.filter((seed) => seed.discoveryOnly);
  const directSeeds = scopedSeeds.filter((seed) => !seed.discoveryOnly).map(seedToTarget);
  const discoveredTargets: IngestTarget[] = [];

  if (options.refreshCache && discoverySeeds.length > 0) {
    await invalidateScrapePages(discoverySeeds.map((seed) => seed.url));
  }

  const {
    pages: scrapedDiscoverySeeds,
    cacheHitCount: discoveryCacheHitCount,
    cacheMissCount: discoveryCacheMissCount,
    cacheStore,
  } = await scrapePages(
    discoverySeeds.map((seed) => seed.url)
  );

  for (const seed of discoverySeeds) {
    const scraped = scrapedDiscoverySeeds.find(
      (page) => page.url === canonicalizeUrl(seed.url)
    );

    if (!scraped) {
      continue;
    }

    discoveredTargets.push(
      ...discoverUrlsFromSeed(seedToTarget(seed), scraped.links)
    );
  }

  const dedupedTargets = uniqueUrls([
    ...directSeeds.map((seed) => seed.url),
    ...discoveredTargets.map((seed) => seed.url),
  ]).map((url) => {
    const directMatch = directSeeds.find((seed) => seed.url === url);

    if (directMatch) {
      return directMatch;
    }

    return discoveredTargets.find((seed) => seed.url === url)!;
  });

  const communityItemOffset = options.communityItemOffset ?? 0;
  const communityItemLimit = options.communityItemLimit;
  const limitedTargets =
    typeof communityItemLimit === "number" && communityItemLimit >= 0
      ? dedupedTargets.filter((target) => target.sourceType !== "community_items").concat(
          dedupedTargets
            .filter((target) => target.sourceType === "community_items")
            .slice(communityItemOffset)
            .slice(0, communityItemLimit)
        )
      : dedupedTargets;

  const discoveredUrlCount = uniqueUrls(
    discoveredTargets.map((target) => target.url)
  ).length;

  return {
    discoverySeeds,
    discoveredTargets,
    discoveredUrlCount,
    dedupedTargets: limitedTargets,
    discoveryCacheHitCount,
    discoveryCacheMissCount,
    cacheStore,
  };
}

function getDocumentIdForTarget(target: IngestTarget) {
  return `${target.sourceType}_${hashString(target.url)}`;
}

function getDerivedPatchRecordDocumentId(originDocumentId: string, index: number) {
  return `derived_patch_records_${hashString(`${originDocumentId}:${index}`)}`;
}

function getRepairPrefixes(targets: IngestTarget[]) {
  const prefixes = new Set<string>();

  for (const target of targets) {
    const documentId = getDocumentIdForTarget(target);
    prefixes.add(`${documentId}_`);

    if (target.sourceType !== "official_updates") {
      continue;
    }

    for (
      let index = 0;
      index < MAX_DERIVED_PATCH_RECORDS_PER_DOCUMENT;
      index += 1
    ) {
      prefixes.add(`${getDerivedPatchRecordDocumentId(documentId, index)}_`);
    }
  }

  return [...prefixes];
}

function summarizeDocuments(
  documents: NormalizedSourceDocument[],
  chunks: IndexedChunk[]
) {
  return documents.slice(0, MAX_SAMPLE_DOCUMENTS).map((document) => ({
    documentId: document.documentId,
    title: document.title,
    url: document.url,
    sourceType: document.sourceType,
    contentType: document.contentType,
    chunkCount: chunks.filter((chunk) => chunk.documentId === document.documentId).length,
  }));
}

export async function ingestArcRaidersCorpus(options: IngestOptions = {}) {
  const {
    discoverySeeds,
    discoveredTargets,
    discoveredUrlCount,
    dedupedTargets,
    discoveryCacheHitCount,
    discoveryCacheMissCount,
    cacheStore,
  } = await buildCorpusTargets(options);

  if (options.refreshCache) {
    await invalidateScrapePages(dedupedTargets.map((target) => target.url));
  }

  if (options.repairExisting) {
    await deleteChunksByPrefix(getRepairPrefixes(dedupedTargets));
  }

  const {
    pages: scrapedTargets,
    cacheHitCount: targetCacheHitCount,
    cacheMissCount: targetCacheMissCount,
  } = await scrapePages(dedupedTargets.map((target) => target.url));
  const documents: NormalizedSourceDocument[] = [];
  const sourceBreakdown = createSourceBreakdown();

  for (const target of dedupedTargets) {
    const scrapedPage = scrapedTargets.find((page) => page.url === target.url);

    if (!scrapedPage || scrapedPage.markdown.trim().length === 0) {
      continue;
    }

    const document = normalizeScrapedPage({
      sourceType: target.sourceType,
      sourceName: target.sourceName,
      scrapedPage,
    });

    if (document.normalizedText.length < 120) {
      continue;
    }

    documents.push(document);
    sourceBreakdown[document.sourceType] += 1;
  }

  const derivedPatchRecords = documents.flatMap((document) => derivePatchRecords(document));

  for (const record of derivedPatchRecords) {
    sourceBreakdown[record.sourceType] += 1;
  }

  const allDocuments = [...documents, ...derivedPatchRecords];
  const indexedChunks = allDocuments.flatMap((document) =>
    chunkDocument(document, DEFAULT_CHUNK_STRATEGY)
  );
  const embeddedChunks: EmbeddedChunk[] = [];

  for (const batch of batchArray(indexedChunks, 96)) {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL_ID,
      values: batch.map((chunk) => chunk.chunkText),
    });

    embeddedChunks.push(
      ...batch.map((chunk, index) => ({
        ...chunk,
        vector: embeddings[index]!,
      }))
    );
  }

  const isScopedIngest =
    Boolean(options.targetUrls?.length) ||
    Boolean(options.sourceTypes?.length) ||
    typeof options.communityItemLimit === "number" ||
    (options.communityItemOffset ?? 0) > 0 ||
    options.repairExisting === true;

  await upsertChunks(embeddedChunks, { reset: options.reset ?? !isScopedIngest });

  const summary: IngestRunSummary = {
    namespace: VECTOR_NAMESPACE,
    chunkStrategy: DEFAULT_CHUNK_STRATEGY,
    embeddingModel: EMBEDDING_MODEL_ID,
    artifactCacheStore: cacheStore,
    cacheHitCount: discoveryCacheHitCount + targetCacheHitCount,
    cacheMissCount: discoveryCacheMissCount + targetCacheMissCount,
    discoverySeedCount: discoverySeeds.length,
    discoveredUrlCount,
    scrapedDocumentCount: scrapedTargets.length,
    normalizedDocumentCount: documents.length,
    derivedPatchRecordCount: derivedPatchRecords.length,
    upsertedChunkCount: embeddedChunks.length,
    sourceBreakdown,
    samples: summarizeDocuments(allDocuments, indexedChunks),
  };

  return summary;
}