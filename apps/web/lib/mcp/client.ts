import "server-only";
import { createMCPClient } from "@ai-sdk/mcp";

export async function createChuckMcpClient(requestUrl: string) {
  return createMCPClient({
    transport: {
      type: "http",
      url: new URL("/api/mcp", requestUrl).toString(),
    },
  });
}

export function getDiscoveredToolNames(tools: Record<string, unknown>) {
  return Object.keys(tools).sort();
}