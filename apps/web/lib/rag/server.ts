import "server-only";
import bm25 from "wink-bm25-text-search";
import { gateway } from "@ai-sdk/gateway";
import { rerank } from "@/lib/ai";
import { readIndexedChunkCorpus } from "@/lib/embeddings/corpus-store";
import { runSemanticSearch } from "@/lib/embeddings/search";
import type { IndexedChunk, SemanticSearchResult } from "@/lib/embeddings/types";
import type {
  RagCitation,
  RagContextPacket,
  RagMeasurementPacket,
  RagMeasurementRow,
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
    entityType: result.metadata.entityType,
    entityNames: result.metadata.entityNames,
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
    entityType: chunk.entityType,
    entityNames: chunk.entityNames,
    score: keywordScore,
    retrievalScore: keywordScore,
    chunkText: chunk.chunkText,
    keywordRank,
  };
}

async function getBm25Index() {
  const corpus = await readIndexedChunkCorpus();
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

async function runBm25Search(query: string, topK: number) {
  const { engine, docs } = await getBm25Index();
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

export async function retrieveRagContext(
  query: string,
  options: {
    topK?: number;
    contextLimit?: number;
    retrievalMode?: RagRetrievalMode;
  } = {}
): Promise<RagContextPacket> {
  const topK = options.topK ?? RAG_RETRIEVAL_TOP_K;
  const contextLimit = options.contextLimit ?? RAG_CONTEXT_LIMIT;
  const retrievalMode = options.retrievalMode ?? "vector-only";
  const vectorCandidates = await retrieveVectorCandidates(query, topK);

  if (retrievalMode === "vector-only") {
    return {
      query,
      retrievalMode,
      citations: vectorCandidates.slice(0, contextLimit),
    };
  }

  const keywordCandidates = await runBm25Search(query, topK);
  const hybridCandidates = applyRrf(vectorCandidates, keywordCandidates);

  if (retrievalMode === "hybrid") {
    return {
      query,
      retrievalMode,
      citations: hybridCandidates.slice(0, contextLimit),
    };
  }

  return {
    query,
    retrievalMode,
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

export function buildRagSystemPrompt(context: RagContextPacket) {
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

  return `You are the ARC Raiders retrieval assistant for the RAG demo.

Answer only from the retrieved context below.

Rules:
- Keep the answer grounded in the provided evidence.
- If the evidence is incomplete, say that the corpus does not clearly support the missing part.
- Do not invent item stats, categories, patch details, or comparisons.
- Prefer concise, direct answers.
- If the user asks for a comparison, only compare properties that are explicitly supported by the retrieved excerpts.
- End with a short "Sources:" line that cites the relevant source titles in square brackets, for example [1] [3].

Retrieved context:
${contextBlock || "No retrieved context was available."}`;
}