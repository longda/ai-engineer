import { EmbeddingsClient } from "./embeddings-client";

export default function EmbeddingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-24 pt-12 sm:px-10 sm:pb-28 sm:pt-16 md:px-14 lg:px-20 xl:px-24 2xl:px-28">
      <header className="flex max-w-4xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Embeddings and vector search lab
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          This demo turns approved ARC Raiders sources into a reusable corpus: cached markdown ingestion, normalized source and chunk schemas, AI SDK embeddings through the gateway, Upstash Vector storage, a semantic search API, and a reproducible chunking comparison.
        </p>
      </header>

      <EmbeddingsClient />
    </main>
  );
}