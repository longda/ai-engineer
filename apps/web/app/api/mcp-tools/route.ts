import {
  createChuckMcpClient,
  getDiscoveredToolNames,
} from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let mcpClient: Awaited<ReturnType<typeof createChuckMcpClient>> | undefined;

  try {
    mcpClient = await createChuckMcpClient(req.url);
    const tools = await mcpClient.tools();

    return Response.json({
      tools: getDiscoveredToolNames(tools),
    });
  } catch (error) {
    console.error("[mcp:tools] discovery failed", error);

    return Response.json(
      {
        error: "Failed to discover MCP tools.",
      },
      { status: 500 }
    );
  } finally {
    await mcpClient?.close();
  }
}