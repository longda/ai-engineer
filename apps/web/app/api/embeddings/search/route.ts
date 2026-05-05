import { z } from "zod";
import { runSemanticSearch } from "@/lib/embeddings/search";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(20).optional(),
});

function isBadRequestError(error: unknown) {
  return error instanceof SyntaxError || error instanceof z.ZodError;
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  console.info("[embeddings/search] Starting ARC Raiders semantic search");

  try {
    const payload = requestSchema.parse(await req.json());
    const results = await runSemanticSearch(payload.query, payload.topK);

    return Response.json({
      query: payload.query,
      topK: payload.topK ?? 8,
      results,
    });
  } catch (error) {
    console.error("[embeddings/search] Failed ARC Raiders semantic search", error);

    const message =
      error instanceof Error ? error.message : "Semantic search failed.";

    return Response.json(
      { error: message },
      { status: isBadRequestError(error) ? 400 : 500 }
    );
  } finally {
    console.info(
      `[embeddings/search] Completed ARC Raiders semantic search in ${Date.now() - startedAt}ms`
    );
  }
}