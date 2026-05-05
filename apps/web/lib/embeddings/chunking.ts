import { EMBEDDING_MODEL_ID, FIXED_CHUNK_SIZE, OVERLAPPING_CHUNK_OVERLAP, OVERLAPPING_CHUNK_SIZE, SEMANTIC_CHUNK_TARGET } from "./config";
import type { ChunkStrategy, IndexedChunk, NormalizedSourceDocument } from "./types";
import { estimateTokenCount, hashString } from "./utils";

function sliceText(text: string, start: number, end: number) {
  return text.slice(start, end).trim();
}

function fixedSlices(text: string, chunkSize: number) {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    const chunk = sliceText(text, index, index + chunkSize);

    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

function overlappingSlices(text: string, chunkSize: number, overlap: number) {
  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);

  for (let index = 0; index < text.length; index += step) {
    const chunk = sliceText(text, index, index + chunkSize);

    if (!chunk) {
      continue;
    }

    chunks.push(chunk);

    if (index + chunkSize >= text.length) {
      break;
    }
  }

  return chunks;
}

function semanticSlices(text: string, targetSize: number) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length <= targetSize || current.length < targetSize * 0.6) {
      current = next;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function buildIndexedChunks(
  document: NormalizedSourceDocument,
  strategy: ChunkStrategy,
  chunkTexts: string[]
) {
  return chunkTexts.map((chunkText, chunkIndex) => {
    const indexedChunk: IndexedChunk = {
      chunkId: `${document.documentId}_${hashString(`${document.documentId}:${chunkIndex}`)}`,
      documentId: document.documentId,
      chunkIndex,
      chunkStrategy: strategy,
      chunkText,
      charCount: chunkText.length,
      tokenEstimate: estimateTokenCount(chunkText),
      embeddingModel: EMBEDDING_MODEL_ID,
      sourceType: document.sourceType,
      sourceName: document.sourceName,
      url: document.url,
      title: document.title,
      contentType: document.contentType,
      entityType: document.entityType,
      entityNames: document.entityNames,
      publishedAt: document.publishedAt,
      fetchedAt: document.fetchedAt,
      freshnessTier: document.freshnessTier,
      tags: document.tags,
    };

    return indexedChunk;
  });
}

export function chunkDocument(
  document: NormalizedSourceDocument,
  strategy: ChunkStrategy
) {
  const text = document.normalizedText;

  if (!text) {
    return [];
  }

  switch (strategy) {
    case "fixed":
      return buildIndexedChunks(document, strategy, fixedSlices(text, FIXED_CHUNK_SIZE));
    case "overlapping":
      return buildIndexedChunks(
        document,
        strategy,
        overlappingSlices(text, OVERLAPPING_CHUNK_SIZE, OVERLAPPING_CHUNK_OVERLAP)
      );
    case "semantic":
      return buildIndexedChunks(document, strategy, semanticSlices(text, SEMANTIC_CHUNK_TARGET));
    default:
      return [];
  }
}