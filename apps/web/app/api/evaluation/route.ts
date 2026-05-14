import { runRagEvaluationHarness } from "@/lib/evaluation/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const summary = await runRagEvaluationHarness();
    return Response.json(summary);
  } catch (error) {
    console.error("[evaluation] route failed", error);

    return Response.json(
      { error: "The evaluation harness failed." },
      { status: 500 }
    );
  }
}