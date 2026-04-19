import { stepCountIs, type ToolSet } from "ai";
import { TracedToolLoopAgent } from "@/lib/ai";

const MODEL_ID = "openai/gpt-5.4-mini";

export function createChuckMcpAgent(tools: ToolSet, toolNames: string[]) {
  return new TracedToolLoopAgent({
    model: MODEL_ID,
    instructions: `You are a Chuck Norris joke assistant powered by runtime-discovered MCP tools.

Available MCP tools: ${toolNames.join(", ")}.

Working style:
1. Use list_categories when the user asks what categories exist or when you need to confirm a category name.
2. Use get_random_joke for a random joke, optionally with a category.
3. Use search_jokes for keyword searches or when the user asks for jokes about a theme.
4. If a category name is uncertain, check categories before calling get_random_joke.
5. Keep the final response short and include the actual joke text when you have one.

Do not invent categories or tool results.`,
    tools,
    stopWhen: stepCountIs(6),
  });
}