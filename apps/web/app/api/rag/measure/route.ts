import { measureRagRetrievalModes } from "@/lib/rag/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const packet = await measureRagRetrievalModes();
    return Response.json(packet);
  } catch (error) {
    console.error("[rag/measure] route failed", error);

    return Response.json(
      { error: "The RAG measurement run failed." },
      { status: 500 }
    );
  }
}