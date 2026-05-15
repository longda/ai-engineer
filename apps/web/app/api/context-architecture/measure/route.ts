import { measureContextArchitectureScenarios } from "@/lib/context-architecture/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const packet = await measureContextArchitectureScenarios();
    return Response.json(packet);
  } catch (error) {
    console.error("[context-architecture/measure] route failed", error);

    return Response.json(
      { error: "The context architecture measurement run failed." },
      { status: 500 }
    );
  }
}