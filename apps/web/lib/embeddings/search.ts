import "server-only";
import { embed } from "@/lib/ai";
import { EMBEDDING_MODEL_ID, SEARCH_TOP_K } from "./config";
import { semanticSearchByVector } from "./vector";

export async function runSemanticSearch(query: string, topK = SEARCH_TOP_K) {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const { embedding } = await embed({
    model: EMBEDDING_MODEL_ID,
    value: trimmed,
  });

  const candidateCount = Math.min(Math.max(topK * 4, topK), 40);
  const rawResults = await semanticSearchByVector(embedding, candidateCount);
  const seenDocumentIds = new Set<string>();
  const distinctResults = [];

  for (const result of rawResults) {
    const documentId = result.metadata.documentId;

    if (seenDocumentIds.has(documentId)) {
      continue;
    }

    seenDocumentIds.add(documentId);
    distinctResults.push(result);

    if (distinctResults.length === topK) {
      break;
    }
  }

  return distinctResults;
}