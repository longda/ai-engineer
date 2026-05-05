"use client";

import { FormEvent, useState } from "react";
import { DatabaseIcon, Layers3Icon, SearchIcon, SparklesIcon } from "lucide-react";
import { MetricTile } from "@/components/embeddings/metric-tile";
import { SearchResultCard } from "@/components/embeddings/search-result-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  ChunkStrategy,
  ChunkingEvalResult,
  IngestRunSummary,
  SemanticSearchResult,
} from "@/lib/embeddings/types";

type ChunkingResponse = {
  benchmarkId: string;
  benchmarkLabel: string;
  evaluationUrl: string;
  embeddingModel: string;
  winner: ChunkStrategy | null;
  benchmarkStatus: "winner" | "inconclusive";
  warning: string | null;
  rationale: string;
  results: ChunkingEvalResult[];
};

const STARTER_QUERIES = [
  "What are map conditions in ARC Raiders?",
  "What is the Acoustic Guitar item?",
  "What changed in the latest ARC Raiders patch notes?",
];

export function EmbeddingsClient() {
  const [searchQuery, setSearchQuery] = useState(STARTER_QUERIES[0]!);
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [ingestSummary, setIngestSummary] = useState<IngestRunSummary | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);

  const [chunkingResult, setChunkingResult] = useState<ChunkingResponse | null>(null);
  const [chunkingError, setChunkingError] = useState<string | null>(null);
  const [evaluatingChunking, setEvaluatingChunking] = useState(false);

  async function handleIngest() {
    if (ingesting) {
      return;
    }

    setIngesting(true);
    setIngestError(null);

    try {
      const response = await fetch("/api/embeddings/ingest", {
        method: "POST",
      });
      const payload = (await response.json()) as IngestRunSummary & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "ARC Raiders corpus ingest failed.");
      }

      setIngestSummary(payload);
    } catch (error) {
      setIngestError(
        error instanceof Error ? error.message : "ARC Raiders corpus ingest failed."
      );
    } finally {
      setIngesting(false);
    }
  }

  async function handleChunkingEvaluation() {
    if (evaluatingChunking) {
      return;
    }

    setEvaluatingChunking(true);
    setChunkingError(null);

    try {
      const response = await fetch("/api/embeddings/chunking", {
        method: "POST",
      });
      const payload = (await response.json()) as ChunkingResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Chunking evaluation failed.");
      }

      setChunkingResult(payload);
    } catch (error) {
      setChunkingError(
        error instanceof Error ? error.message : "Chunking evaluation failed."
      );
    } finally {
      setEvaluatingChunking(false);
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();

    if (!searchQuery.trim() || searching) {
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const response = await fetch("/api/embeddings/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
        }),
      });
      const payload = (await response.json()) as {
        results?: SemanticSearchResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Semantic search failed.");
      }

      setSearchResults(payload.results ?? []);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Semantic search failed."
      );
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Embedding model"
          value="text-embedding-3-small"
          detail="Generated through the AI Gateway with the repo's existing AI SDK setup."
        />
        <MetricTile
          label="Vector store"
          value="Upstash Vector"
          detail="Dense custom index with 1536 dimensions and cosine similarity."
        />
        <MetricTile
          label="Default chunking"
          value="Semantic"
          detail="Validated on the approved Metaforge item catalog benchmark, where semantic chunking beat overlapping 9/10 to 8/10 recall@3."
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-0 bg-white shadow-sm ring-0">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2">
              <DatabaseIcon className="size-4" />
              <CardTitle>Ingest the approved ARC Raiders corpus</CardTitle>
            </div>
            <CardDescription>
              Scrape the approved ARC Raiders seeds with Firecrawl, cache markdown-only artifacts in durable storage, normalize them into the shared source schema, derive patch records from official updates, chunk with the current default, embed with AI SDK, and upsert the final chunks into Upstash Vector.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">official docs</Badge>
              <Badge variant="outline">official updates</Badge>
              <Badge variant="outline">community items</Badge>
              <Badge variant="outline">derived patch records</Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleIngest} disabled={ingesting} size="lg">
                {ingesting ? "Ingesting…" : "Run corpus ingest"}
              </Button>
            </div>
            {ingestError ? (
              <p className="text-sm text-destructive">{ingestError}</p>
            ) : null}
            {ingestSummary ? (
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile
                    label="Discovered URLs"
                    value={String(ingestSummary.discoveredUrlCount)}
                  />
                  <MetricTile
                    label="Normalized docs"
                    value={String(ingestSummary.normalizedDocumentCount)}
                  />
                  <MetricTile
                    label="Derived records"
                    value={String(ingestSummary.derivedPatchRecordCount)}
                  />
                  <MetricTile
                    label="Upserted chunks"
                    value={String(ingestSummary.upsertedChunkCount)}
                  />
                </div>
                <div className="rounded-2xl border border-stone-200/70 bg-stone-50/80 p-4">
                  <p className="text-sm font-medium text-foreground">
                    Namespace: {ingestSummary.namespace}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Strategy: {ingestSummary.chunkStrategy} · Model: {ingestSummary.embeddingModel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cache: {ingestSummary.artifactCacheStore} · Hits: {ingestSummary.cacheHitCount} · Misses: {ingestSummary.cacheMissCount}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(ingestSummary.sourceBreakdown).map(
                      ([sourceType, count]) => (
                        <Badge
                          key={sourceType}
                          variant="secondary"
                          className="bg-stone-100 text-stone-700"
                        >
                          {sourceType.replace(/_/g, " ")}: {count}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                <div className="grid gap-3">
                  {ingestSummary.samples.map((sample) => (
                    <div
                      key={sample.documentId}
                      className="rounded-2xl border border-stone-200/70 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{sample.sourceType}</Badge>
                        <Badge variant="outline">{sample.contentType}</Badge>
                        <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                          {sample.chunkCount} chunks
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {sample.title}
                      </p>
                      <a
                        href={sample.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-sm text-muted-foreground hover:text-foreground"
                      >
                        {sample.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-sm ring-0">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2">
              <Layers3Icon className="size-4" />
              <CardTitle>Compare chunking strategies</CardTitle>
            </div>
            <CardDescription>
              Run the same retrieval-style query set against fixed, overlapping, and semantic chunking on the approved long-form ARC Raiders item catalog benchmark.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              onClick={handleChunkingEvaluation}
              disabled={evaluatingChunking}
              variant="outline"
              size="lg"
            >
              {evaluatingChunking ? "Evaluating…" : "Run chunking comparison"}
            </Button>
            {chunkingError ? (
              <p className="text-sm text-destructive">{chunkingError}</p>
            ) : null}
            {chunkingResult ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-stone-200/70 bg-stone-50/80 p-4">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="size-4 text-stone-700" />
                    <p className="text-sm font-medium text-foreground">
                      {chunkingResult.winner
                        ? `Winner: ${chunkingResult.winner}`
                        : "Benchmark inconclusive"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {chunkingResult.rationale}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                    Benchmark: {chunkingResult.benchmarkLabel}
                  </p>
                  {chunkingResult.warning ? (
                    <p className="mt-2 text-sm text-amber-700">
                      {chunkingResult.warning}
                    </p>
                  ) : null}
                </div>
                {chunkingResult.results.map((result) => (
                  <div
                    key={result.strategy}
                    className="rounded-2xl border border-stone-200/70 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {result.strategy}
                      </p>
                      <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                        recall@3 {(result.recallAt3 * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {result.hitCount} / {result.queryCount} evaluation queries found the expected evidence in the top 3 chunks.
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card className="border-0 bg-white shadow-sm ring-0">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <SearchIcon className="size-4" />
            <CardTitle>Semantic search API</CardTitle>
          </div>
          <CardDescription>
            Embed the query with AI SDK and return the top-ranked chunks, metadata, and similarity scores from the ARC Raiders vector index.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ask about ARC Raiders items, systems, or updates…"
              className="h-10 px-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={searching || !searchQuery.trim()} size="lg">
                {searching ? "Searching…" : "Search index"}
              </Button>
              {STARTER_QUERIES.map((starter) => (
                <Button
                  key={starter}
                  type="button"
                  variant="outline"
                  onClick={() => setSearchQuery(starter)}
                >
                  {starter}
                </Button>
              ))}
            </div>
          </form>
          {searchError ? (
            <p className="text-sm text-destructive">{searchError}</p>
          ) : null}
          <div className="grid gap-4">
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <SearchResultCard key={result.chunkId} result={result} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-200 px-4 py-8 text-sm text-muted-foreground">
                Run an ingest, then search the corpus index to inspect chunk-level results and citation metadata.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}