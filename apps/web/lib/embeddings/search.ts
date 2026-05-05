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

  return semanticSearchByVector(embedding, topK);
}