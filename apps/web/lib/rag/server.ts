import "server-only";
import bm25 from "wink-bm25-text-search";
import { gateway } from "@ai-sdk/gateway";
import { rerank } from "@/lib/ai";
import { readIndexedChunkCorpus } from "@/lib/embeddings/corpus-store";
import { runSemanticSearch } from "@/lib/embeddings/search";
import type {
  IndexedChunk,
  SemanticSearchResult,
  SourceType,
} from "@/lib/embeddings/types";
import type {
  RagCitation,
  RagContextPacket,
  RagMeasurementPacket,
  RagMeasurementRow,
  RagRetrievalFilters,
  RagRetrievalMode,
} from "./types";

export const RAG_MODEL_ID = "openai/gpt-5.4-mini";
export const RAG_RETRIEVAL_TOP_K = 6;
export const RAG_CONTEXT_LIMIT = 4;
export const RAG_RRF_K = 60;
export const RAG_RERANK_MODEL_ID = "cohere/rerank-v3.5";
export const RAG_MEASUREMENT_QUERIES = [
  "What is the Acoustic Guitar item in ARC Raiders?",
  "What category does Heavy Ammo belong to?",
  "What related ammo or materials are mentioned for a rifle item?",
  "How does Scrap Metal compare to nearby materials in the corpus?",
] as const;

type RetrievalCandidate = RagCitation;
type Bm25SearchEngine = ReturnType<typeof bm25>;

let cachedBm25CorpusSignature: string | null = null;
let cachedBm25Engine: Bm25SearchEngine | null = null;
let cachedBm25Docs = new Map<string, IndexedChunk>();

function normalizeFilterTerm(value: string) {
  return value.trim().toLowerCase();
}

function matchesAnyFilterTerm(values: string[], filters?: string[]) {
  if (!filters || filters.length === 0) {
    return true;
  }

  const normalizedValues = values.map((value) => normalizeFilterTerm(value));

  return filters.some((filter) => normalizedValues.includes(normalizeFilterTerm(filter)));
}

function escapeUpstashFilterLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function buildSourceTypeFilter(sourceTypes: SourceType[]) {
  if (sourceTypes.length === 1) {
    const [sourceType] = sourceTypes;
    return `sourceType = '${escapeUpstashFilterLiteral(sourceType ?? "")}'`;
  }

  return `(${sourceTypes
    .map((sourceType) => `sourceType = '${escapeUpstashFilterLiteral(sourceType)}'`)
    .join(" OR ")})`;
}

function buildContainsAnyFilter(field: "entityNames" | "tags", values: string[]) {
  if (values.length === 1) {
    const [value] = values;
    return `${field} CONTAINS '${escapeUpstashFilterLiteral(value ?? "")}'`;
  }

  return `(${values
    .map((value) => `${field} CONTAINS '${escapeUpstashFilterLiteral(value)}'`)
    .join(" OR ")})`;
}

function buildVectorMetadataFilter(filters?: RagRetrievalFilters) {
  if (!filters) {
    return undefined;
  }

  const clauses: string[] = [];

  if (filters.sourceTypes?.length) {
    clauses.push(buildSourceTypeFilter(filters.sourceTypes));
  }

  if (filters.entityNames?.length) {
    clauses.push(buildContainsAnyFilter("entityNames", filters.entityNames));
  }

  if (filters.tags?.length) {
    clauses.push(buildContainsAnyFilter("tags", filters.tags));
  }

  if (filters.publishedAfter) {
    clauses.push(`publishedAt >= '${escapeUpstashFilterLiteral(filters.publishedAfter)}'`);
  }

  if (filters.publishedBefore) {
    clauses.push(`publishedAt <= '${escapeUpstashFilterLiteral(filters.publishedBefore)}'`);
  }

  return clauses.length > 0 ? clauses.join(" AND ") : undefined;
}

function chunkMatchesFilters(chunk: IndexedChunk, filters?: RagRetrievalFilters) {
  if (!filters) {
    return true;
  }

  if (
    filters.sourceTypes?.length &&
    !filters.sourceTypes.includes(chunk.sourceType)
  ) {
    return false;
  }

  if (!matchesAnyFilterTerm(chunk.entityNames, filters.entityNames)) {
    return false;
  }

  if (!matchesAnyFilterTerm(chunk.tags, filters.tags)) {
    return false;
  }

  if (filters.publishedAfter) {
    if (!chunk.publishedAt || chunk.publishedAt < filters.publishedAfter) {
      return false;
    }
  }

  if (filters.publishedBefore) {
    if (!chunk.publishedAt || chunk.publishedAt > filters.publishedBefore) {
      return false;
    }
  }

  return true;
}

function sanitizeFilters(filters?: RagRetrievalFilters) {
  if (!filters) {
    return undefined;
  }

  const sourceTypes = filters.sourceTypes?.length
    ? [...new Set(filters.sourceTypes)]
    : undefined;
  const entityNames = filters.entityNames
    ?.map((value) => value.trim())
    .filter(Boolean);
  const tags = filters.tags?.map((value) => value.trim()).filter(Boolean);

  const nextFilters: RagRetrievalFilters = {
    ...(sourceTypes?.length ? { sourceTypes } : {}),
    ...(entityNames?.length ? { entityNames } : {}),
    ...(tags?.length ? { tags } : {}),
    ...(filters.publishedAfter ? { publishedAfter: filters.publishedAfter } : {}),
    ...(filters.publishedBefore ? { publishedBefore: filters.publishedBefore } : {}),
  };

  return Object.keys(nextFilters).length > 0 ? nextFilters : undefined;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildBm25Doc(chunk: IndexedChunk) {
  return {
    title: chunk.title,
    chunkText: chunk.chunkText,
    entityNames: chunk.entityNames.join(" "),
    tags: chunk.tags.join(" "),
  };
}

function createCitationFromSemanticResult(
  result: SemanticSearchResult,
  vectorRank: number
): RetrievalCandidate {
  return {
    chunkId: result.chunkId,
    title: result.metadata.title,
    url: result.metadata.url,
    sourceType: result.metadata.sourceType,
    sourceName: result.metadata.sourceName,
    contentType: result.metadata.contentType,
    entityType: result.metadata.entityType,
    entityNames: result.metadata.entityNames,
    publishedAt: result.metadata.publishedAt,
    freshnessTier: result.metadata.freshnessTier,
    tags: result.metadata.tags,
    tokenEstimate: result.metadata.tokenEstimate,
    score: result.score,
    retrievalScore: result.score,
    chunkText: result.chunkText,
    vectorRank,
  };
}

function createCitationFromIndexedChunk(
  chunk: IndexedChunk,
  keywordScore: number,
  keywordRank: number
): RetrievalCandidate {
  return {
    chunkId: chunk.chunkId,
    title: chunk.title,
    url: chunk.url,
    sourceType: chunk.sourceType,
    sourceName: chunk.sourceName,
    contentType: chunk.contentType,
    entityType: chunk.entityType,
    entityNames: chunk.entityNames,
    publishedAt: chunk.publishedAt,
    freshnessTier: chunk.freshnessTier,
    tags: chunk.tags,
    tokenEstimate: chunk.tokenEstimate,
    score: keywordScore,
    retrievalScore: keywordScore,
    chunkText: chunk.chunkText,
    keywordRank,
  };
}

function buildBm25IndexFromCorpus(corpus: IndexedChunk[]) {
  const corpusSignature = corpus
    .map((chunk) => `${chunk.chunkId}:${chunk.chunkText.length}`)
    .join("|");

  if (cachedBm25Engine && cachedBm25CorpusSignature === corpusSignature) {
    return {
      engine: cachedBm25Engine,
      docs: cachedBm25Docs,
    };
  }

  const engine = bm25();
  engine.defineConfig({
    fldWeights: {
      title: 2,
      chunkText: 3,
      entityNames: 2,
      tags: 1,
    },
  });
  engine.definePrepTasks([tokenize]);

  const docs = new Map<string, IndexedChunk>();

  for (const chunk of corpus) {
    docs.set(chunk.chunkId, chunk);
    engine.addDoc(buildBm25Doc(chunk), chunk.chunkId);
  }

  engine.consolidate();
  cachedBm25CorpusSignature = corpusSignature;
  cachedBm25Engine = engine;
  cachedBm25Docs = docs;

  return { engine, docs };
}

async function getBm25Index(filters?: RagRetrievalFilters) {
  const corpus = await readIndexedChunkCorpus();
  const filteredCorpus = filters
    ? corpus.filter((chunk) => chunkMatchesFilters(chunk, filters))
    : corpus;

  if (filteredCorpus.length === 0) {
    const engine = bm25();
    engine.defineConfig({
      fldWeights: {
        title: 2,
        chunkText: 3,
        entityNames: 2,
        tags: 1,
      },
    });
    engine.definePrepTasks([tokenize]);
    engine.consolidate();
    return { engine, docs: new Map<string, IndexedChunk>() };
  }

  if (!filters) {
    return buildBm25IndexFromCorpus(filteredCorpus);
  }

  const engine = bm25();
  engine.defineConfig({
    fldWeights: {
      title: 2,
      chunkText: 3,
      entityNames: 2,
      tags: 1,
    },
  });
  engine.definePrepTasks([tokenize]);

  const docs = new Map<string, IndexedChunk>();

  for (const chunk of filteredCorpus) {
    docs.set(chunk.chunkId, chunk);
    engine.addDoc(buildBm25Doc(chunk), chunk.chunkId);
  }

  engine.consolidate();
  return { engine, docs };
}

async function runBm25Search(
  query: string,
  topK: number,
  filters?: RagRetrievalFilters
) {
  const { engine, docs } = await getBm25Index(filters);
  const results = engine.search(query, topK) as Array<[string, number]>;

  return results
    .map(([chunkId, score], index) => {
      const chunk = docs.get(String(chunkId));
      return chunk ? createCitationFromIndexedChunk(chunk, score, index + 1) : null;
    })
    .filter((result): result is RetrievalCandidate => result !== null);
}

function applyRrf(
  vectorResults: RetrievalCandidate[],
  keywordResults: RetrievalCandidate[]
) {
  const merged = new Map<string, RetrievalCandidate>();

  for (const result of vectorResults) {
    merged.set(result.chunkId, { ...result });
  }

  for (const result of keywordResults) {
    const existing = merged.get(result.chunkId);

    if (!existing) {
      merged.set(result.chunkId, { ...result });
      continue;
    }

    merged.set(result.chunkId, {
      ...existing,
      keywordRank: result.keywordRank,
    });
  }

  return [...merged.values()]
    .map((result) => {
      const vectorComponent = result.vectorRank
        ? 1 / (RAG_RRF_K + result.vectorRank)
        : 0;
      const keywordComponent = result.keywordRank
        ? 1 / (RAG_RRF_K + result.keywordRank)
        : 0;

      return {
        ...result,
        score: vectorComponent + keywordComponent,
        retrievalScore: vectorComponent + keywordComponent,
      };
    })
    .sort((left, right) => right.score - left.score);
}

async function rerankCitations(
  query: string,
  citations: RetrievalCandidate[],
  contextLimit: number
): Promise<RetrievalCandidate[]> {
  if (citations.length === 0) {
    return citations;
  }

  try {
    const result = await rerank({
      model: gateway.rerankingModel(RAG_RERANK_MODEL_ID),
      query,
      documents: citations.map((citation) => citation.chunkText),
      topN: contextLimit,
    });

    const reranked: RetrievalCandidate[] = [];

    for (const item of result.ranking) {
      const citation = citations[item.originalIndex];

      if (!citation) {
        continue;
      }

      reranked.push({
        ...citation,
        score: item.score,
        rerankScore: item.score,
      });
    }

    return reranked;
  } catch (error) {
    console.error("[rag] rerank failed; falling back to hybrid results", error);
    return citations.slice(0, contextLimit);
  }
}

async function retrieveVectorCandidates(query: string, topK: number) {
  const results = await runSemanticSearch(query, topK);
  return results.map((result, index) =>
    createCitationFromSemanticResult(result, index + 1)
  );
}

async function retrieveFilteredVectorCandidates(
  query: string,
  topK: number,
  filters?: RagRetrievalFilters
) {
  const results = await runSemanticSearch(query, topK, {
    filter: buildVectorMetadataFilter(filters),
  });

  return results
    .map((result, index) => createCitationFromSemanticResult(result, index + 1))
    .filter((result) => chunkMatchesFilters({
      chunkId: result.chunkId,
      documentId: result.chunkId,
      chunkIndex: 0,
      chunkStrategy: "semantic",
      chunkText: result.chunkText,
      charCount: result.chunkText.length,
      tokenEstimate: result.tokenEstimate,
      embeddingModel: "",
      sourceType: result.sourceType,
      sourceName: result.sourceName,
      url: result.url,
      title: result.title,
      contentType: result.contentType,
      entityType: result.entityType,
      entityNames: result.entityNames,
      publishedAt: result.publishedAt,
      fetchedAt: result.publishedAt ?? new Date(0).toISOString(),
      freshnessTier: result.freshnessTier,
      tags: result.tags,
    }, filters));
}

export async function retrieveRagContext(
  query: string,
  options: {
    topK?: number;
    contextLimit?: number;
    retrievalMode?: RagRetrievalMode;
    filters?: RagRetrievalFilters;
  } = {}
): Promise<RagContextPacket> {
  const topK = options.topK ?? RAG_RETRIEVAL_TOP_K;
  const contextLimit = options.contextLimit ?? RAG_CONTEXT_LIMIT;
  const retrievalMode = options.retrievalMode ?? "vector-only";
  const filters = sanitizeFilters(options.filters);
  const vectorCandidates = filters
    ? await retrieveFilteredVectorCandidates(query, topK, filters)
    : await retrieveVectorCandidates(query, topK);

  if (retrievalMode === "vector-only") {
    return {
      query,
      retrievalMode,
      ...(filters ? { filters } : {}),
      citations: vectorCandidates.slice(0, contextLimit),
    };
  }

  const keywordCandidates = await runBm25Search(query, topK, filters);
  const hybridCandidates = applyRrf(vectorCandidates, keywordCandidates);

  if (retrievalMode === "hybrid") {
    return {
      query,
      retrievalMode,
      ...(filters ? { filters } : {}),
      citations: hybridCandidates.slice(0, contextLimit),
    };
  }

  return {
    query,
    retrievalMode,
    ...(filters ? { filters } : {}),
    citations: await rerankCitations(
      query,
      hybridCandidates.slice(0, topK),
      contextLimit
    ),
  };
}

export async function measureRagRetrievalModes(
  queries = [...RAG_MEASUREMENT_QUERIES]
): Promise<RagMeasurementPacket> {
  const rows: RagMeasurementRow[] = [];

  for (const query of queries) {
    for (const retrievalMode of [
      "vector-only",
      "hybrid",
      "hybrid-rerank",
    ] satisfies RagRetrievalMode[]) {
      const context = await retrieveRagContext(query, { retrievalMode });
      rows.push({
        query,
        retrievalMode,
        citationCount: context.citations.length,
        topTitles: context.citations.map((citation) => citation.title),
      });
    }
  }

  return { queries, rows };
}

export function buildRagSystemPrompt(
  context: RagContextPacket,
  options: {
    promptVersion?: string;
  } = {}
) {
  const promptVersion = options.promptVersion ?? "rag-v1";
  const contextBlock = context.citations
    .map((citation, index) => {
      const entityNames = citation.entityNames.length
        ? citation.entityNames.join(", ")
        : "unknown";

      return [
        `[${index + 1}] ${citation.title}`,
        `url: ${citation.url}`,
        `source_type: ${citation.sourceType}`,
        `entity_type: ${citation.entityType}`,
        `entity_names: ${entityNames}`,
        `score: ${citation.score.toFixed(4)}`,
        citation.vectorRank ? `vector_rank: ${citation.vectorRank}` : null,
        citation.keywordRank ? `keyword_rank: ${citation.keywordRank}` : null,
        citation.rerankScore != null
          ? `rerank_score: ${citation.rerankScore.toFixed(4)}`
          : null,
        `excerpt: ${citation.chunkText}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");
    })
    .join("\n\n");

  const instructions =
    promptVersion === "rag-v2"
      ? [
          "You are the ARC Raiders retrieval assistant for the RAG demo.",
          "",
          "Answer only from the retrieved context below.",
          "",
          "Rules:",
          "- Start with the direct answer in the first sentence.",
          "- Keep the answer grounded in the provided evidence.",
          "- If the evidence is incomplete, say that the corpus does not clearly support the missing part.",
          "- Do not invent item stats, categories, patch details, or comparisons.",
          "- If the user asks for a comparison, only compare properties that are explicitly supported by the retrieved excerpts.",
          "- If the corpus supports only part of the request, separate supported facts from unsupported gaps clearly.",
          "- End with a short \"Sources:\" line that cites the relevant source titles in square brackets, for example [1] [3].",
        ].join("\n")
      : [
          "You are the ARC Raiders retrieval assistant for the RAG demo.",
          "",
          "Answer only from the retrieved context below.",
          "",
          "Rules:",
          "- Keep the answer grounded in the provided evidence.",
          "- If the evidence is incomplete, say that the corpus does not clearly support the missing part.",
          "- Do not invent item stats, categories, patch details, or comparisons.",
          "- Prefer concise, direct answers.",
          "- If the user asks for a comparison, only compare properties that are explicitly supported by the retrieved excerpts.",
          "- End with a short \"Sources:\" line that cites the relevant source titles in square brackets, for example [1] [3].",
        ].join("\n");

  return `${instructions}

Retrieved context:
${contextBlock || "No retrieved context was available."}`;
}