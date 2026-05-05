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

export async function POST(req: Request) {
  const startedAt = Date.now();

  console.info("[embeddings/ingest] Starting ingest ARC Raiders corpus");

  try {
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
      { status: 500 }
    );
  } finally {
    console.info(
      `[embeddings/ingest] Completed ingest ARC Raiders corpus in ${Date.now() - startedAt}ms`
    );
  }
}