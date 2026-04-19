import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createChuckMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

const TOOL_NAMES = ["list_categories", "get_random_joke", "search_jokes"];

export function GET() {
  return Response.json({
    name: "chuck-norris-mcp",
    transport: "streamable-http",
    tools: TOOL_NAMES,
  });
}

export async function POST(req: Request) {
  try {
    const parsedBody = await req.json().catch(() => undefined);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const chuckMcpServer = createChuckMcpServer();

    await chuckMcpServer.connect(transport);
    return transport.handleRequest(req, { parsedBody });
  } catch (error) {
    console.error("[mcp:server] request failed", error);

    return Response.json(
      { error: "The MCP server failed to handle the request." },
      { status: 500 }
    );
  }
}