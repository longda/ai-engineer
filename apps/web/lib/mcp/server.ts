import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  getRandomJoke,
  listCategories,
  searchJokes,
} from "@/lib/mcp/chuck-norris";

function toToolResult(
  text: string,
  structuredContent?: Record<string, unknown>
): CallToolResult {
  return {
    content: [{ type: "text", text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

export function createChuckMcpServer() {
  const chuckMcpServer = new McpServer({
    name: "chuck-norris-mcp",
    version: "0.1.0",
  });

  chuckMcpServer.registerTool(
    "list_categories",
    {
      title: "List joke categories",
      description: "List all available Chuck Norris joke categories.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      const categories = await listCategories();

      return toToolResult(
        `Available categories: ${categories.join(", ")}`,
        { categories }
      );
    }
  );

  chuckMcpServer.registerTool(
    "get_random_joke",
    {
      title: "Get a random joke",
      description:
        "Fetch a random Chuck Norris joke. Optionally scope it to a specific category.",
      inputSchema: z.object({
        category: z.string().trim().min(1).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ category }) => {
      const joke = await getRandomJoke(category);
      const categoryLabel =
        joke.categories.length > 0 ? joke.categories.join(", ") : "uncategorized";

      return toToolResult(
        `${joke.value}\n\nCategory: ${categoryLabel}\nJoke ID: ${joke.id}`,
        { joke }
      );
    }
  );

  chuckMcpServer.registerTool(
    "search_jokes",
    {
      title: "Search jokes",
      description:
        "Search Chuck Norris jokes by keyword and return the best matching results.",
      inputSchema: z.object({
        query: z.string().trim().min(2),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ query, limit }) => {
      const results = await searchJokes(query, limit ?? 5);

      if (results.result.length === 0) {
        return toToolResult(
          `No jokes matched \"${query}\".`,
          { query, total: 0, results: [] }
        );
      }

      const summary = results.result
        .map((joke, index) => `${index + 1}. ${joke.value}`)
        .join("\n\n");

      return toToolResult(
        `Found ${results.total} jokes for \"${query}\". Showing ${results.result.length}:\n\n${summary}`,
        {
          query,
          total: results.total,
          results: results.result,
        }
      );
    }
  );

  return chuckMcpServer;
}