import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import { generateText } from "@/lib/ai";

const redis = Redis.fromEnv();
const MEMORY_PREFIX = "agent:memory:";

export const agentTools: ToolSet = {
  /**
   * Web search via Perplexity's model.
   * This runs as a normal execute-based tool so ToolLoopAgent can take a
   * follow-up reasoning step and emit a final text response.
   */
  web_search: tool({
    description:
      "Search the web for recent sports news, scores, standings, and stats. Returns a concise research summary with source links.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The sports topic, team, league, score, or news item to research"),
    }),
    execute: async ({ query }, { abortSignal }) => {
      const { text } = await generateText({
        abortSignal,
        model: "perplexity/sonar-pro",
        prompt: [
          "Research the following sports question using current web information.",
          "Return a concise summary followed by a short Sources section with direct URLs when available.",
          `Question: ${query}`,
        ].join("\n\n"),
      });

      return {
        query,
        summary: text,
      };
    },
  }),

  /**
   * Current date/time — lets the agent reason about "today", "yesterday", etc.
   */
  get_current_date: tool({
    description:
      "Get the current date, day of week, and time. Use this when you need to know what day it is to contextualize recent events.",
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date();
      return {
        date: now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        time: now.toLocaleTimeString("en-US", { hour12: true }),
        iso: now.toISOString(),
      };
    },
  }),

  /**
   * Sports math calculator — win percentage, averages, differences, ratios.
   */
  calculate_stats: tool({
    description:
      "Calculate sports statistics: win percentage, averages, point differentials, ratios. Use for any math the user asks about.",
    inputSchema: z.object({
      operation: z
        .enum(["average", "percentage", "difference", "ratio", "sum"])
        .describe("The type of calculation to perform"),
      values: z
        .array(z.number())
        .min(1)
        .describe(
          "Numbers to compute on. For percentage: [part, whole]. For difference: [a, b]. For ratio: [a, b]. For average/sum: any list of numbers."
        ),
      label: z
        .string()
        .optional()
        .describe("Optional label for the result, e.g. 'FG%' or 'PPG'"),
    }),
    execute: async ({ operation, values, label }) => {
      let result: number;
      let explanation: string;

      switch (operation) {
        case "average":
          result = values.reduce((a, b) => a + b, 0) / values.length;
          explanation = `Average of [${values.join(", ")}]`;
          break;
        case "percentage":
          result = (values[0]! / values[1]!) * 100;
          explanation = `${values[0]} / ${values[1]} as percentage`;
          break;
        case "difference":
          result = values[0]! - values[1]!;
          explanation = `${values[0]} - ${values[1]}`;
          break;
        case "ratio":
          result = values[0]! / values[1]!;
          explanation = `${values[0]} : ${values[1]}`;
          break;
        case "sum":
          result = values.reduce((a, b) => a + b, 0);
          explanation = `Sum of [${values.join(", ")}]`;
          break;
      }

      return {
        result: Math.round(result * 100) / 100,
        explanation,
        ...(label ? { label } : {}),
      };
    },
  }),

  /**
   * Remember — persist a fact to Redis for long-term cross-session memory.
   */
  remember: tool({
    description:
      "Save a key fact to long-term memory so you can recall it in future conversations. Use for user preferences, important scores, or anything worth remembering across sessions.",
    inputSchema: z.object({
      key: z
        .string()
        .describe(
          "A short, descriptive key for lookup, e.g. 'favorite_team' or 'lakers_vs_celtics_apr10'"
        ),
      value: z
        .string()
        .describe("The fact or information to remember"),
    }),
    execute: async ({ key, value }) => {
      await redis.set(`${MEMORY_PREFIX}${key}`, value, { ex: 60 * 60 * 24 * 30 }); // 30-day TTL
      return { saved: true, key, value };
    },
  }),

  /**
   * Recall — retrieve a fact from Redis long-term memory.
   */
  recall: tool({
    description:
      "Retrieve a previously saved fact from long-term memory. Use when the user asks about something you may have saved before, or to check what you remember.",
    inputSchema: z.object({
      key: z
        .string()
        .describe(
          "The key to look up. Use the same key format used when saving."
        ),
    }),
    execute: async ({ key }) => {
      const value = await redis.get<string>(`${MEMORY_PREFIX}${key}`);
      return value
        ? { found: true, key, value }
        : { found: false, key, message: "No memory found for this key." };
    },
  }),

  /**
   * List memories — see all saved memory keys.
   */
  list_memories: tool({
    description:
      "List all keys currently stored in long-term memory. Use when the user asks what you remember or you want to check available memories.",
    inputSchema: z.object({}),
    execute: async () => {
      const keys = await redis.keys(`${MEMORY_PREFIX}*`);
      const cleanKeys = keys.map((k) =>
        typeof k === "string" ? k.replace(MEMORY_PREFIX, "") : String(k)
      );
      return {
        count: cleanKeys.length,
        keys: cleanKeys,
      };
    },
  }),
};
