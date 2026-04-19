import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CHUCK_MCP_TOOL_NAMES,
  createChuckMcpServer,
} from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    name: "chuck-norris-mcp",
    transport: "streamable-http",
    tools: CHUCK_MCP_TOOL_NAMES,
  });
}

export async function POST(req: Request) {
  try {
    let parsedBody: unknown;

    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        parsedBody = await req.clone().json();
      } catch {
        return Response.json(
          { error: "Invalid JSON request body." },
          { status: 400 }
        );
      }
    }

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