import type {
  ContentType,
  EntityType,
  NormalizedSourceDocument,
  ScrapedPage,
  SourceType,
} from "./types";
import { hashString, collapseWhitespace, dedupeAndSort, toUtcIsoString } from "./utils";
import { canonicalizeUrl } from "./source-map";
import { MAX_DERIVED_PATCH_RECORDS_PER_DOCUMENT } from "./config";

const BOILERPLATE_PATTERNS = [
  /^cookie/i,
  /^privacy/i,
  /^terms/i,
  /^legal/i,
  /^newsletter/i,
  /^all rights reserved/i,
];

const COMMUNITY_NOISE_PATTERNS = [
  /^back to database/i,
  /^add to favorites/i,
  /^quick use/i,
  /^login to comment/i,
  /^comments?$/i,
  /market history/i,
  /marketplace trades/i,
  /sold by traders/i,
  /last available median price/i,
  /to vote on item locations/i,
];

function cleanMarkdown(markdown: string, sourceType: SourceType) {
  const cleanedLines = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/^>\s*/, "").trim())
    .filter((line) => line && !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line)))
    .filter(
      (line) =>
        sourceType !== "community_items" ||
        !COMMUNITY_NOISE_PATTERNS.some((pattern) => pattern.test(line))
    );

  return collapseWhitespace(cleanedLines.join("\n"));
}

function inferContentType(sourceType: SourceType, url: string, title: string): ContentType {
  if (sourceType === "community_items") {
    return url.includes("/database/items/page/") ? "item_index" : "item_page";
  }

  if (sourceType === "derived_patch_records") {
    return "derived_change_record";
  }

  if (sourceType === "official_updates") {
    return /patch/i.test(title) || /patch-notes/i.test(url) ? "patch_page" : "news_page";
  }

  return "docs_page";
}

function inferEntityType(sourceType: SourceType, contentType: ContentType, title: string): EntityType {
  if (sourceType === "community_items") {
    if (/ammo/i.test(title)) return "ammo";
    if (/weapon/i.test(title)) return "weapon";
    if (/material/i.test(title)) return "material";
    return "item";
  }

  if (sourceType === "official_updates") {
    return contentType === "patch_page" ? "patch" : "update";
  }

  if (sourceType === "derived_patch_records") {
    return "patch";
  }

  if (/map|condition|system|mode/i.test(title)) {
    return "system";
  }

  return "unknown";
}

function inferFreshnessTier(sourceType: SourceType) {
  if (sourceType === "official_updates") {
    return "update" as const;
  }

  if (sourceType === "derived_patch_records") {
    return "change_record" as const;
  }

  return "evergreen" as const;
}

function extractTags(sourceType: SourceType, title: string, url: string) {
  const tags = [sourceType.replace(/_/g, "-")];

  if (/patch/i.test(title) || /patch-notes/i.test(url)) {
    tags.push("patch-notes");
  }

  if (/map/i.test(title)) {
    tags.push("map");
  }

  if (/condition/i.test(title)) {
    tags.push("conditions");
  }

  if (/ammo/i.test(title)) {
    tags.push("ammo");
  }

  if (/material/i.test(title)) {
    tags.push("material");
  }

  if (/weapon/i.test(title)) {
    tags.push("weapon");
  }

  if (sourceType === "community_items") {
    tags.push("gear");
  }

  return dedupeAndSort(tags);
}

function extractEntityNames(title: string) {
  return dedupeAndSort([title]);
}

function extractStructuredFields(sourceType: SourceType, contentType: ContentType, title: string, text: string) {
  const fields = Object.fromEntries(
    text
      .split("\n")
      .slice(0, 40)
      .map((line) => line.match(/^([A-Za-z][A-Za-z0-9 /-]{1,40}):\s+(.+)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [
        match[1]!
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_"),
        match[2]!.trim(),
      ])
  );

  if (sourceType === "official_updates" && contentType === "patch_page") {
    const version = title.match(/(?:patch|update)\s+([a-z0-9.\-]+)/i)?.[1] ?? null;

    return {
      ...fields,
      patchVersion: version,
    };
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

export function normalizeScrapedPage(params: {
  sourceType: SourceType;
  sourceName: string;
  scrapedPage: ScrapedPage;
  fetchedAt?: string;
  originUrl?: string | null;
  originDocumentId?: string | null;
}) {
  const canonicalUrl = canonicalizeUrl(params.scrapedPage.url);
  const normalizedText = cleanMarkdown(
    params.scrapedPage.markdown,
    params.sourceType
  );
  const title = params.scrapedPage.title.trim() || canonicalUrl;
  const contentType = inferContentType(params.sourceType, canonicalUrl, title);
  const publishedAt = toUtcIsoString(
    typeof params.scrapedPage.metadata?.publishedTime === "string"
      ? params.scrapedPage.metadata.publishedTime
      : typeof params.scrapedPage.metadata?.publishedAt === "string"
        ? params.scrapedPage.metadata.publishedAt
        : null
  );
  const fetchedAt =
    params.fetchedAt ?? params.scrapedPage.cachedAt ?? new Date().toISOString();

  const document: NormalizedSourceDocument = {
    documentId: `${params.sourceType}_${hashString(canonicalUrl)}`,
    sourceType: params.sourceType,
    sourceName: params.sourceName,
    url: canonicalUrl,
    originUrl: params.originUrl ?? null,
    title,
    contentType,
    entityType: inferEntityType(params.sourceType, contentType, title),
    entityNames: extractEntityNames(title),
    publishedAt,
    fetchedAt,
    freshnessTier: inferFreshnessTier(params.sourceType),
    tags: extractTags(params.sourceType, title, canonicalUrl),
    language: "en",
    rawText: params.scrapedPage.markdown.trim(),
    normalizedText,
    structuredFields: extractStructuredFields(
      params.sourceType,
      contentType,
      title,
      normalizedText
    ),
    originDocumentId: params.originDocumentId ?? null,
  };

  return document;
}

function inferChangeType(text: string) {
  if (/\badded\b/i.test(text)) return "add" as const;
  if (/\bremoved\b/i.test(text)) return "remove" as const;
  if (/\bbuff|increase|improved\b/i.test(text)) return "buff" as const;
  if (/\bnerf|decrease|reduced\b/i.test(text)) return "nerf" as const;
  if (/\brework|overhaul\b/i.test(text)) return "rework" as const;
  if (/\bfix|fixed\b/i.test(text)) return "fix" as const;
  if (/\bupdate|change|adjusted\b/i.test(text)) return "system_change" as const;
  return "unknown" as const;
}

function extractAffectedEntityNames(text: string, fallbackTitle: string) {
  const capitalizedMatches = text.match(/\b[A-Z][A-Za-z0-9'/-]+(?:\s+[A-Z][A-Za-z0-9'/-]+){0,2}\b/g) ?? [];
  return dedupeAndSort(capitalizedMatches.length > 0 ? capitalizedMatches : [fallbackTitle]);
}

export function derivePatchRecords(document: NormalizedSourceDocument) {
  if (document.sourceType !== "official_updates") {
    return [];
  }

  const evidenceLines = document.normalizedText
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(
      (line) =>
        line.length > 40 &&
        /\b(added|removed|increased|decreased|reduced|fixed|updated|changed|adjusted|reworked)\b/i.test(
          line
        )
    )
    .slice(0, MAX_DERIVED_PATCH_RECORDS_PER_DOCUMENT);

  return evidenceLines.map((line, index) => {
    const changeType = inferChangeType(line);
    const affectedEntityNames = extractAffectedEntityNames(line, document.title);
    const derivedUrl = `${document.url}#change-${index + 1}`;

    return {
      documentId: `derived_patch_records_${hashString(`${document.documentId}:${index}`)}`,
      sourceType: "derived_patch_records" as const,
      sourceName: "Derived patch record",
      url: derivedUrl,
      originUrl: document.url,
      title: `${document.title} · change ${index + 1}`,
      contentType: "derived_change_record" as const,
      entityType: "patch" as const,
      entityNames: affectedEntityNames,
      publishedAt: document.publishedAt,
      fetchedAt: document.fetchedAt,
      freshnessTier: "change_record" as const,
      tags: dedupeAndSort([...document.tags, "derived-change-record", changeType]),
      language: document.language,
      rawText: line,
      normalizedText: line,
      structuredFields: {
        patchVersion:
          typeof document.structuredFields?.patchVersion === "string"
            ? document.structuredFields.patchVersion
            : null,
        changeType,
        affectedEntityNames,
        changeSummary: line,
        evidenceText: line,
      },
      originDocumentId: document.documentId,
    } satisfies NormalizedSourceDocument;
  });
}