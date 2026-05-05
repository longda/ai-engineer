import type { SourceType } from "./types";

export type SourceSeed = {
  sourceType: Exclude<SourceType, "derived_patch_records">;
  sourceName: string;
  url: string;
  discoveryOnly: boolean;
};

const OFFICIAL_DOC_SOURCE_NAME = "Official ARC Raiders site";
const OFFICIAL_UPDATE_SOURCE_NAME = "Official ARC Raiders updates";
const COMMUNITY_SOURCE_NAME = "Metaforge ARC Raiders database";

export const OFFICIAL_DOC_SEEDS: SourceSeed[] = [
  {
    sourceType: "official_docs",
    sourceName: OFFICIAL_DOC_SOURCE_NAME,
    url: "https://arcraiders.com/",
    discoveryOnly: true,
  },
  {
    sourceType: "official_docs",
    sourceName: OFFICIAL_DOC_SOURCE_NAME,
    url: "https://arcraiders.com/map-conditions",
    discoveryOnly: false,
  },
];

export const OFFICIAL_UPDATE_SEEDS: SourceSeed[] = [
  {
    sourceType: "official_updates",
    sourceName: OFFICIAL_UPDATE_SOURCE_NAME,
    url: "https://arcraiders.com/news",
    discoveryOnly: true,
  },
  {
    sourceType: "official_updates",
    sourceName: OFFICIAL_UPDATE_SOURCE_NAME,
    url: "https://arcraiders.com/news/tag/patch-notes",
    discoveryOnly: true,
  },
];

export const COMMUNITY_INDEX_SEEDS: SourceSeed[] = Array.from(
  { length: 15 },
  (_, index) => ({
    sourceType: "community_items" as const,
    sourceName: COMMUNITY_SOURCE_NAME,
    url: `https://metaforge.app/arc-raiders/database/items/page/${index + 1}`,
    discoveryOnly: true,
  })
);

export const COMMUNITY_DETAIL_SEEDS: SourceSeed[] = [
  {
    sourceType: "community_items",
    sourceName: COMMUNITY_SOURCE_NAME,
    url: "https://metaforge.app/arc-raiders/database/item/acoustic-guitar",
    discoveryOnly: false,
  },
];

export const ARC_RAIDERS_CORPUS_SEEDS: SourceSeed[] = [
  ...OFFICIAL_DOC_SEEDS,
  ...OFFICIAL_UPDATE_SEEDS,
  ...COMMUNITY_INDEX_SEEDS,
  ...COMMUNITY_DETAIL_SEEDS,
];

const EXCLUDED_SEGMENTS = [
  "/search",
  "/login",
  "/account",
  "/checkout",
  "/profile",
  "/newsletter",
  "/legal",
  "/privacy",
  "/cookie",
  "/terms",
];

export function canonicalizeUrl(input: string) {
  const parsed = new URL(input);
  parsed.hash = "";

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

function hasExcludedSegment(url: string) {
  return EXCLUDED_SEGMENTS.some((segment) => url.includes(segment));
}

export function isCommunityItemDetailUrl(url: string) {
  return /^https:\/\/metaforge\.app\/arc-raiders\/database\/item\/[a-z0-9-]+$/i.test(
    canonicalizeUrl(url)
  );
}

export function isOfficialUpdateUrl(url: string) {
  const canonical = canonicalizeUrl(url);

  return (
    canonical.startsWith("https://arcraiders.com/news/") &&
    !canonical.includes("/tag/") &&
    !hasExcludedSegment(canonical)
  );
}

export function isOfficialEvergreenDocUrl(url: string) {
  const canonical = canonicalizeUrl(url);
  const parsed = new URL(canonical);

  if (parsed.origin !== "https://arcraiders.com") {
    return false;
  }

  if (parsed.pathname === "/" || parsed.pathname.startsWith("/news")) {
    return false;
  }

  if (hasExcludedSegment(canonical)) {
    return false;
  }

  return true;
}

export function uniqueUrls(urls: string[]) {
  return Array.from(new Set(urls.map(canonicalizeUrl)));
}