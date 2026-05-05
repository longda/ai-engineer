import { scrapePage } from "@/lib/embeddings/firecrawl";
import {
  DEFAULT_CHUNKING_EVAL_BENCHMARK,
  runChunkingEvaluation,
} from "@/lib/embeddings/chunking-eval";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const startedAt = Date.now();

  console.info(
    `[embeddings/chunking] Starting ARC Raiders chunking comparison for ${DEFAULT_CHUNKING_EVAL_BENCHMARK.id}`
  );

  try {
    const scrapedPage = await scrapePage(DEFAULT_CHUNKING_EVAL_BENCHMARK.url);
    const evaluation = await runChunkingEvaluation(scrapedPage, DEFAULT_CHUNKING_EVAL_BENCHMARK);

    return Response.json({
      ...evaluation,
      source: {
        url: scrapedPage.url,
        cacheState: scrapedPage.cacheState,
        cachedAt: scrapedPage.cachedAt,
      },
    });
  } catch (error) {
    console.error(
      "[embeddings/chunking] Failed ARC Raiders chunking comparison",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chunking evaluation failed.",
      },
      { status: 500 }
    );
  } finally {
    console.info(
      `[embeddings/chunking] Completed ARC Raiders chunking comparison in ${Date.now() - startedAt}ms`
    );
  }
}