import {
  createAgentUIStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type ToolSet,
  type UIMessage,
} from "ai";
import { createChuckMcpAgent } from "@/lib/mcp/agent";
import {
  createChuckMcpClient,
  getDiscoveredToolNames,
} from "@/lib/mcp/client";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const uiMessages = messages as UIMessage[];
  let mcpClient: Awaited<ReturnType<typeof createChuckMcpClient>> | undefined;

  try {
    mcpClient = await createChuckMcpClient(req.url);
    const discoveredTools = await mcpClient.tools();
    const toolNames = getDiscoveredToolNames(discoveredTools);
    const tools = discoveredTools as unknown as ToolSet;
    const agent = createChuckMcpAgent(tools, toolNames);
    const agentStream = await createAgentUIStream({
      agent,
      uiMessages,
      abortSignal: req.signal,
    });

    const stream = createUIMessageStream({
      originalMessages: uiMessages,
      execute: async ({ writer }) => {
        writer.merge(agentStream);
      },
      onError: (error) => {
        console.error("[mcp:agent] stream failed", error);
        return "The MCP demo agent failed.";
      },
      onFinish: async () => {
        await mcpClient?.close();
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("[mcp:agent] request failed", error);
    await mcpClient?.close();

    return Response.json(
      {
        error: "The MCP demo agent failed before streaming could start.",
      },
      { status: 500 }
    );
  }
}