import "server-only";

import { Output } from "ai";
import { generateText } from "@/lib/ai";
import { readIndexedChunkCorpus } from "@/lib/embeddings/corpus-store";
import type { RagCitation, RagRetrievalFilters, RagRetrievalMode } from "@/lib/rag/types";
import {
  buildRagSystemPrompt,
  RAG_CONTEXT_LIMIT,
  RAG_MODEL_ID,
  RAG_RETRIEVAL_TOP_K,
  retrieveRagContext,
} from "@/lib/rag/server";
import { getSpecificationPromptDefinition } from "@/lib/specification/server";
import {
  CONTEXT_ARCHITECTURE_DEFAULT_TOKEN_BUDGET,
  CONTEXT_ARCHITECTURE_SOURCE_PROFILES,
  type ContextArchitectureFilterOptions,
  type ContextArchitectureMeasurePacket,
  type ContextArchitectureMeasureScenario,
  type ContextArchitecturePacket,
  type ContextArchitectureSourceProfile,
  type ContextPackPacket,
} from "./types";

const DEFAULT_SOURCE_PROFILE: ContextArchitectureSourceProfile = "all";
const CONTEXT_ARCHITECTURE_CONTEXT_LIMIT = 6;
const CONTEXT_ARCHITECTURE_TOP_K = Math.max(RAG_RETRIEVAL_TOP_K, 8);

const CONTEXT_ARCHITECTURE_MEASURE_SCENARIOS: ContextArchitectureMeasureScenario[] = [
  {
    id: "official-systems",
    title: "Official evergreen knowledge",
    query: "What are map conditions in ARC Raiders?",
    sourceProfile: "official_knowledge",
    preferredSourceTypes: ["official_docs", "official_updates"],
    topic: "map-conditions",
    whyItFits:
      "Evergreen gameplay questions should bias toward official docs and official updates instead of community item records.",
  },
  {
    id: "community-item-lookup",
    title: "Structured item lookup",
    query: "What is the Acoustic Guitar item in ARC Raiders?",
    sourceProfile: "community_items",
    preferredSourceTypes: ["community_items"],
    entityName: "Acoustic Guitar",
    whyItFits:
      "Inventory lookup questions are best answered from structured item records rather than broad official marketing pages.",
  },
  {
    id: "patch-change-records",
    title: "Patch-note change extraction",
    query: "What change records are available from ARC Raiders patch notes?",
    sourceProfile: "patch_change_records",
    preferredSourceTypes: ["derived_patch_records"],
    topic: "patch-notes",
    whyItFits:
      "Change-oriented questions should route toward derived patch-note records instead of generic evergreen or item-detail chunks.",
  },
];

function normalizeDateBoundary(value: string | undefined, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const date = new Date(`${trimmed}${suffix}`);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildSourceProfileMap() {
  return new Map(
    CONTEXT_ARCHITECTURE_SOURCE_PROFILES.map((profile) => [profile.value, profile])
  );
}

const sourceProfileMap = buildSourceProfileMap();

export function resolveSourceProfile(profile?: ContextArchitectureSourceProfile) {
  return sourceProfileMap.get(profile ?? DEFAULT_SOURCE_PROFILE) ??
    sourceProfileMap.get(DEFAULT_SOURCE_PROFILE)!;
}

export function buildContextArchitectureFilters(input: {
  sourceProfile?: ContextArchitectureSourceProfile;
  entityName?: string;
  topic?: string;
  startDate?: string;
  endDate?: string;
}): RagRetrievalFilters | undefined {
  const profile = resolveSourceProfile(input.sourceProfile);
  const entityName = input.entityName?.trim();
  const topic = input.topic?.trim();
  const publishedAfter = normalizeDateBoundary(input.startDate, "start");
  const publishedBefore = normalizeDateBoundary(input.endDate, "end");

  const filters: RagRetrievalFilters = {
    ...(profile.value !== "all" ? { sourceTypes: profile.sourceTypes } : {}),
    ...(entityName ? { entityNames: [entityName] } : {}),
    ...(topic ? { tags: [topic] } : {}),
    ...(publishedAfter ? { publishedAfter } : {}),
    ...(publishedBefore ? { publishedBefore } : {}),
  };

  return Object.keys(filters).length > 0 ? filters : undefined;
}

function buildFallbackContextPack(
  query: string,
  citations: RagCitation[],
  tokenBudget: number,
  sessionContext: string | null
): ContextPackPacket {
  const selectedSources: ContextPackPacket["selectedSources"] = [];
  const excludedSources: ContextPackPacket["excludedSources"] = [];
  let totalEstimatedTokens = 0;

  for (const citation of citations) {
    const nextTotal = totalEstimatedTokens + citation.tokenEstimate;

    if (selectedSources.length === 0 || nextTotal <= tokenBudget) {
      selectedSources.push({
        sourceId: citation.chunkId,
        sourceType: citation.sourceType,
        reason: "Kept because it ranked highly for the current question.",
        estimatedTokens: citation.tokenEstimate,
      });
      totalEstimatedTokens = nextTotal;
      continue;
    }

    excludedSources.push({
      sourceId: citation.chunkId,
      reason: "Dropped to keep the context pack inside the requested token budget.",
    });
  }

  return {
    taskSummary: `Answer the ARC Raiders question: ${query}`,
    selectedSources,
    excludedSources,
    totalEstimatedTokens,
    fitsBudget: totalEstimatedTokens <= tokenBudget,
    compressionPlan:
      excludedSources.length > 0
        ? [
            "Drop lower-ranked sources first.",
            "Keep only the excerpts that support the direct answer.",
          ]
        : [],
    warningFlags: [
      ...(sessionContext ? [] : ["No per-session task context was provided."]),
      ...(excludedSources.length > 0
        ? ["Some retrieved evidence was excluded to stay within the token budget."]
        : []),
    ],
  };
}

async function assembleContextPack(
  query: string,
  citations: RagCitation[],
  tokenBudget: number,
  sessionContext: string | null
) {
  if (citations.length === 0) {
    return buildFallbackContextPack(query, citations, tokenBudget, sessionContext);
  }

  const definition = getSpecificationPromptDefinition("context-pack-assembler");
  const candidateBlock = citations
    .map((citation) => {
      const entityNames = citation.entityNames.join(", ") || "none";
      const tags = citation.tags.join(", ") || "none";

      return [
        `- ${citation.chunkId}`,
        `  sourceType: ${citation.sourceType}`,
        `  title: ${citation.title}`,
        `  estimatedTokens: ${citation.tokenEstimate}`,
        `  entityNames: ${entityNames}`,
        `  tags: ${tags}`,
        `  excerpt: ${citation.chunkText}`,
      ].join("\n");
    })
    .join("\n");

  try {
    const result = await generateText({
      model: RAG_MODEL_ID,
      system: definition.systemPrompt,
      prompt: [
        `Task: Answer the ARC Raiders question with source-grounded context control.`,
        `Question: ${query}`,
        `Token budget: ${tokenBudget}`,
        sessionContext
          ? `Per-session task context: ${sessionContext}`
          : "Per-session task context: none provided.",
        "Candidate sources:",
        candidateBlock,
      ].join("\n\n"),
      output: Output.object({
        schema: definition.schema,
        name: definition.schemaName,
        description: definition.schemaDescription,
      }),
    });

    return result.output as ContextPackPacket;
  } catch (error) {
    console.error("[context-architecture] context-pack assembly failed", error);
    return buildFallbackContextPack(query, citations, tokenBudget, sessionContext);
  }
}

function selectCitationsFromPack(citations: RagCitation[], pack: ContextPackPacket) {
  const citationMap = new Map(citations.map((citation) => [citation.chunkId, citation]));
  const ordered = pack.selectedSources
    .map((source) => citationMap.get(source.sourceId) ?? null)
    .filter((citation): citation is RagCitation => citation !== null);

  return ordered.length > 0 ? ordered : citations.slice(0, Math.min(4, citations.length));
}

function formatAppliedFilters(filters?: RagRetrievalFilters) {
  if (!filters) {
    return "No metadata filters were applied.";
  }

  const parts: string[] = [];

  if (filters.sourceTypes?.length) {
    parts.push(`source types: ${filters.sourceTypes.join(", ")}`);
  }

  if (filters.entityNames?.length) {
    parts.push(`entities: ${filters.entityNames.join(", ")}`);
  }

  if (filters.tags?.length) {
    parts.push(`topics: ${filters.tags.join(", ")}`);
  }

  if (filters.publishedAfter) {
    parts.push(`published after: ${filters.publishedAfter}`);
  }

  if (filters.publishedBefore) {
    parts.push(`published before: ${filters.publishedBefore}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "No metadata filters were applied.";
}

export async function getContextArchitectureFilterOptions(): Promise<ContextArchitectureFilterOptions> {
  const corpus = await readIndexedChunkCorpus();
  const entityNames = [...new Set(corpus.flatMap((chunk) => chunk.entityNames))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 80);
  const tags = [...new Set(corpus.flatMap((chunk) => chunk.tags))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 80);

  return {
    entityNames,
    tags,
    sourceProfiles: CONTEXT_ARCHITECTURE_SOURCE_PROFILES,
  };
}

export async function buildContextArchitecturePacket(options: {
  query: string;
  retrievalMode?: RagRetrievalMode;
  sourceProfile?: ContextArchitectureSourceProfile;
  entityName?: string;
  topic?: string;
  startDate?: string;
  endDate?: string;
  sessionContext?: string;
  tokenBudget?: number;
}): Promise<ContextArchitecturePacket> {
  const sourceProfile = resolveSourceProfile(options.sourceProfile);
  const sessionContext = options.sessionContext?.trim() || null;
  const tokenBudget = Math.max(
    300,
    Math.min(4000, options.tokenBudget ?? CONTEXT_ARCHITECTURE_DEFAULT_TOKEN_BUDGET)
  );
  const filters = buildContextArchitectureFilters({
    sourceProfile: sourceProfile.value,
    entityName: options.entityName,
    topic: options.topic,
    startDate: options.startDate,
    endDate: options.endDate,
  });
  const retrieval = await retrieveRagContext(options.query, {
    retrievalMode: options.retrievalMode ?? "hybrid-rerank",
    topK: CONTEXT_ARCHITECTURE_TOP_K,
    contextLimit: CONTEXT_ARCHITECTURE_CONTEXT_LIMIT,
    filters,
  });
  const contextPack = await assembleContextPack(
    options.query,
    retrieval.citations,
    tokenBudget,
    sessionContext
  );
  const selectedCitations = selectCitationsFromPack(retrieval.citations, contextPack);

  return {
    query: options.query,
    retrievalMode: retrieval.retrievalMode,
    sourceProfile: sourceProfile.value,
    sourceProfileLabel: sourceProfile.label,
    resolvedSourceTypes: sourceProfile.sourceTypes,
    ...(filters ? { filters } : {}),
    sessionContext,
    tokenBudget,
    retrieval,
    selectedCitations,
    contextPack,
  };
}

export function buildContextArchitectureSystemPrompt(packet: ContextArchitecturePacket) {
  const persistentContext = packet.selectedCitations.length
    ? packet.selectedCitations
    : packet.retrieval.citations;
  const sourceScopedRagPrompt = buildRagSystemPrompt(
    {
      ...packet.retrieval,
      citations: persistentContext,
    },
    { promptVersion: "rag-v2" }
  );

  return [
    "You are the ARC Raiders context architecture demo assistant.",
    "",
    "This demo separates persistent game knowledge from per-session task context.",
    "",
    "Rules:",
    "- Use persistent game knowledge for all factual claims.",
    "- Use per-session task context only to narrow scope, prioritize details, or explain why certain sources were chosen.",
    "- If the per-session task context conflicts with the retrieved evidence, say so and follow the evidence.",
    "- Keep the answer grounded in the selected context pack.",
    "- End with a short \"Sources:\" line using the square-bracket citation numbers from the selected pack.",
    "",
    `Source profile: ${packet.sourceProfileLabel}`,
    `Applied filters: ${formatAppliedFilters(packet.filters)}`,
    `Token budget: ${packet.tokenBudget}`,
    "",
    "Per-session task context:",
    packet.sessionContext ?? "No per-session task context was provided.",
    "",
    sourceScopedRagPrompt,
  ].join("\n");
}

function computeSourcePrecision(citations: RagCitation[], preferredSourceTypes: string[]) {
  if (citations.length === 0) {
    return 0;
  }

  const matchCount = citations.filter((citation) =>
    preferredSourceTypes.includes(citation.sourceType)
  ).length;

  return matchCount / citations.length;
}

export async function measureContextArchitectureScenarios(
  retrievalMode: RagRetrievalMode = "hybrid-rerank"
): Promise<ContextArchitectureMeasurePacket> {
  const scenarios = await Promise.all(
    CONTEXT_ARCHITECTURE_MEASURE_SCENARIOS.map(async (scenario) => {
      const unfiltered = await retrieveRagContext(scenario.query, {
        retrievalMode,
        contextLimit: 4,
      });
      const filteredFilters = buildContextArchitectureFilters({
        sourceProfile: scenario.sourceProfile,
        entityName: scenario.entityName,
        topic: scenario.topic,
      });
      const filtered = await retrieveRagContext(scenario.query, {
        retrievalMode,
        contextLimit: 4,
        filters: filteredFilters,
      });
      const sourceProfile = resolveSourceProfile(scenario.sourceProfile);
      const unfilteredPrecisionAt4 = computeSourcePrecision(
        unfiltered.citations,
        scenario.preferredSourceTypes
      );
      const filteredPrecisionAt4 = computeSourcePrecision(
        filtered.citations,
        scenario.preferredSourceTypes
      );

      return {
        id: scenario.id,
        title: scenario.title,
        query: scenario.query,
        sourceProfile: scenario.sourceProfile,
        sourceProfileLabel: sourceProfile.label,
        preferredSourceTypes: scenario.preferredSourceTypes,
        whyItFits: scenario.whyItFits,
        unfilteredPrecisionAt4,
        filteredPrecisionAt4,
        improvement: filteredPrecisionAt4 - unfilteredPrecisionAt4,
        unfilteredTopTitles: unfiltered.citations.map((citation) => citation.title),
        filteredTopTitles: filtered.citations.map((citation) => citation.title),
        unfilteredSourceTypes: unfiltered.citations.map((citation) => citation.sourceType),
        filteredSourceTypes: filtered.citations.map((citation) => citation.sourceType),
      };
    })
  );

  return {
    retrievalMode,
    scenarios,
  };
}