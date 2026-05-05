import "server-only";
import Firecrawl from "@mendable/firecrawl-js";
import {
  deleteCachedScrapeArtifacts,
  getArtifactCacheStore,
  readCachedScrapeArtifacts,
  writeCachedScrapeArtifacts,
} from "./artifact-cache";
import {
  canonicalizeUrl,
  isCommunityItemDetailUrl,
  uniqueUrls,
} from "./source-map";
import type {
  CachedScrapeArtifact,
  ScrapeBatchResult,
  ScrapedPage,
} from "./types";
import { batchArray } from "./utils";

const FIRECRAWL_BATCH_SIZE = 12;
const FIRECRAWL_POLL_INTERVAL_SECONDS = 2;
const FIRECRAWL_BATCH_TIMEOUT_SECONDS = 120;

let firecrawlClient: Firecrawl | null = null;

function getFirecrawlClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("Missing FIRECRAWL_API_KEY.");
  }

  if (!firecrawlClient) {
    firecrawlClient = new Firecrawl({ apiKey });
  }

  return firecrawlClient;
}

function extractMarkdown(document: Record<string, unknown>) {
  return typeof document.markdown === "string" ? document.markdown : "";
}

function extractTitle(document: Record<string, unknown>, fallbackUrl: string) {
  if (typeof document.title === "string" && document.title.trim()) {
    return document.title.trim();
  }

  if (
    document.metadata &&
    typeof document.metadata === "object" &&
    typeof (document.metadata as Record<string, unknown>).title === "string"
  ) {
    const title = (document.metadata as Record<string, unknown>).title as string;

    if (title.trim()) {
      return title.trim();
    }
  }

  return fallbackUrl;
}

function extractMetadata(document: Record<string, unknown>) {
  if (!document.metadata || typeof document.metadata !== "object") {
    return null;
  }

  const rawMetadata = document.metadata as Record<string, unknown>;
  const metadata: NonNullable<CachedScrapeArtifact["metadata"]> = {};

  if (typeof rawMetadata.publishedAt === "string" && rawMetadata.publishedAt.trim()) {
    metadata.publishedAt = rawMetadata.publishedAt;
  }

  if (
    typeof rawMetadata.publishedTime === "string" &&
    rawMetadata.publishedTime.trim()
  ) {
    metadata.publishedTime = rawMetadata.publishedTime;
  }

  if (typeof rawMetadata.sourceURL === "string" && rawMetadata.sourceURL.trim()) {
    metadata.sourceURL = rawMetadata.sourceURL;
  }

  if (typeof rawMetadata.url === "string" && rawMetadata.url.trim()) {
    metadata.url = rawMetadata.url;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function extractDocumentUrl(document: Record<string, unknown>) {
  const metadata = extractMetadata(document);

  if (typeof metadata?.sourceURL === "string" && metadata.sourceURL.trim()) {
    return canonicalizeUrl(metadata.sourceURL);
  }

  if (typeof metadata?.url === "string" && metadata.url.trim()) {
    return canonicalizeUrl(metadata.url);
  }

  return null;
}

function extractLinks(document: Record<string, unknown>, markdown: string) {
  const directLinks = Array.isArray(document.links)
    ? document.links.filter((link): link is string => typeof link === "string")
    : [];

  const markdownLinks = Array.from(
    markdown.matchAll(/https?:\/\/[\w./?=#%&+:-]+/g),
    (match) => match[0]
  );

  return Array.from(
    new Set([...directLinks, ...markdownLinks].map(canonicalizeUrl))
  );
}

function slugifyTitle(value: string) {
  return value
    .split("|")[0]
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ?? "";
}

function isValidCommunityItemArtifact(artifact: CachedScrapeArtifact) {
  if (!isCommunityItemDetailUrl(artifact.url)) {
    return true;
  }

  const slug = artifact.url.split("/").pop() ?? "";
  const titleSlug = slugifyTitle(artifact.title);

  return Boolean(titleSlug) && titleSlug === slug;
}

function toCachedScrapeArtifact(
  document: Record<string, unknown>,
  requestedUrl: string
): CachedScrapeArtifact {
  const canonicalUrl = canonicalizeUrl(requestedUrl);
  const markdown = extractMarkdown(document);

  return {
    url: canonicalUrl,
    title: extractTitle(document, canonicalUrl),
    markdown,
    links: extractLinks(document, markdown),
    metadata: extractMetadata(document),
    cachedAt: new Date().toISOString(),
  };
}

function toScrapedPage(
  artifact: CachedScrapeArtifact,
  cacheState: ScrapedPage["cacheState"]
): ScrapedPage {
  return {
    ...artifact,
    cacheState,
  };
}

async function fetchAndCachePage(url: string) {
  const canonicalUrl = canonicalizeUrl(url);
  const document = (await getFirecrawlClient().scrape(canonicalUrl, {
    formats: ["markdown", "links"],
  })) as Record<string, unknown>;
  const artifact = toCachedScrapeArtifact(document, canonicalUrl);

  if (!isValidCommunityItemArtifact(artifact)) {
    throw new Error(`Rejected mismatched community item scrape for ${canonicalUrl}.`);
  }

  await writeCachedScrapeArtifacts([artifact]);

  return artifact;
}

async function fetchAndCachePageBatches(urls: string[]) {
  const fetchedArtifacts: CachedScrapeArtifact[] = [];
  const requestedUrls = new Set(urls.map(canonicalizeUrl));

  for (const batch of batchArray(urls, FIRECRAWL_BATCH_SIZE)) {
    const job = await getFirecrawlClient().batchScrape(batch, {
      options: {
        formats: ["markdown", "links"],
      },
      pollInterval: FIRECRAWL_POLL_INTERVAL_SECONDS,
      timeout: FIRECRAWL_BATCH_TIMEOUT_SECONDS,
    });

    const batchArtifacts = job.data
      .map((document, index) => {
        const rawDocument = document as unknown as Record<string, unknown>;
        const extractedUrl = extractDocumentUrl(rawDocument);
        const fallbackUrl = batch[index];
        const requestedUrl =
          extractedUrl ??
          (fallbackUrl && !isCommunityItemDetailUrl(fallbackUrl)
            ? fallbackUrl
            : null);

        if (!requestedUrl) {
          return null;
        }

        const canonicalRequestedUrl = canonicalizeUrl(requestedUrl);

        if (!requestedUrls.has(canonicalRequestedUrl)) {
          return null;
        }

        const artifact = toCachedScrapeArtifact(rawDocument, canonicalRequestedUrl);

        if (!isValidCommunityItemArtifact(artifact)) {
          return null;
        }

        return artifact;
      })
      .filter(
        (artifact): artifact is CachedScrapeArtifact => artifact !== null
      );

    await writeCachedScrapeArtifacts(batchArtifacts);
    fetchedArtifacts.push(...batchArtifacts);
  }

  return fetchedArtifacts;
}

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const { pages } = await scrapePages([url]);
  const page = pages[0];

  if (!page) {
    throw new Error(`Unable to scrape ${canonicalizeUrl(url)}.`);
  }

  return page;
}

export async function scrapePages(urls: string[]): Promise<ScrapeBatchResult> {
  const canonicalUrls = uniqueUrls(urls);
  const cacheStore = getArtifactCacheStore();

  if (canonicalUrls.length === 0) {
    return {
      pages: [],
      cacheHitCount: 0,
      cacheMissCount: 0,
      cacheStore,
    };
  }

  const cachedArtifacts = await readCachedScrapeArtifacts(canonicalUrls);
  const pagesByUrl = new Map<string, ScrapedPage>();
  const missingUrls: string[] = [];

  for (const url of canonicalUrls) {
    const artifact = cachedArtifacts.get(url);

    if (artifact) {
      pagesByUrl.set(url, toScrapedPage(artifact, "hit"));
      continue;
    }

    missingUrls.push(url);
  }

  if (missingUrls.length === 1) {
    const artifact = await fetchAndCachePage(missingUrls[0]!);
    pagesByUrl.set(artifact.url, toScrapedPage(artifact, "miss"));
  } else if (missingUrls.length > 1) {
    const fetchedArtifacts = await fetchAndCachePageBatches(missingUrls);

    for (const artifact of fetchedArtifacts) {
      pagesByUrl.set(artifact.url, toScrapedPage(artifact, "miss"));
    }
  }

  return {
    pages: canonicalUrls.filter((url) => pagesByUrl.has(url)).map((url) => pagesByUrl.get(url)!),
    cacheHitCount: canonicalUrls.length - missingUrls.length,
    cacheMissCount: missingUrls.length,
    cacheStore,
  };
}

export async function invalidateScrapePages(urls: string[]) {
  await deleteCachedScrapeArtifacts(uniqueUrls(urls));
}