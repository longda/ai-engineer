import { z } from "zod";
import { ingestArcRaidersCorpus } from "@/lib/embeddings/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z
  .object({
    reset: z.boolean().optional(),
    sourceTypes: z
      .array(z.enum(["official_docs", "official_updates", "community_items"]))
      .optional(),
    communityItemOffset: z.number().int().nonnegative().optional(),
    communityItemLimit: z.number().int().nonnegative().optional(),
    targetUrls: z.array(z.string().url()).optional(),
    refreshCache: z.boolean().optional(),
    repairExisting: z.boolean().optional(),
  })
  .optional();

function isBadRequestError(error: unknown) {
  return error instanceof SyntaxError || error instanceof z.ZodError;
}

function authorizeIngest(req: Request) {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const secret = process.env.EMBEDDINGS_INGEST_API_KEY;

  if (!secret) {
    return Response.json(
      {
        error:
          "Embeddings ingest is disabled in production until EMBEDDINGS_INGEST_API_KEY is configured.",
      },
      { status: 503 }
    );
  }

  if (req.headers.get("x-embeddings-ingest-key") !== secret) {
    return Response.json(
      { error: "Unauthorized embeddings ingest request." },
      { status: 403 }
    );
  }

  return null;
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  console.info("[embeddings/ingest] Starting ingest ARC Raiders corpus");

  try {
    const authorizationFailure = authorizeIngest(req);

    if (authorizationFailure) {
      return authorizationFailure;
    }

    const bodyText = await req.text();
    const payload = requestSchema.parse(bodyText ? JSON.parse(bodyText) : undefined);
    const summary = await ingestArcRaidersCorpus(payload ?? {});

    return Response.json(summary);
  } catch (error) {
    console.error("[embeddings/ingest] Failed ingest ARC Raiders corpus", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ARC Raiders corpus ingest failed.",
      },
          { status: isBadRequestError(error) ? 400 : 500 }
    );
  } finally {
    console.info(
      `[embeddings/ingest] Completed ingest ARC Raiders corpus in ${Date.now() - startedAt}ms`
    );
  }
}