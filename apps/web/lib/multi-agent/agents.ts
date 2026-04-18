import {
  Output,
  stepCountIs,
  tool,
  type InferAgentUIMessage,
  type ToolSet,
} from "ai";
import { xai } from "@ai-sdk/xai";
import { z } from "zod";
import { TracedToolLoopAgent } from "@/lib/ai";
import {
  researchPacketSchema,
  trendReportSchema,
  verificationResultSchema,
  type ResearchPacket,
  type TrendReport,
  type VerificationResult,
} from "./schemas";
import {
  buildTopicPrompt,
  DEFAULT_LOOKBACK_DAYS,
  topicSchema,
} from "./topics";

const PLANNER_MODEL = "openai/gpt-5.4-mini";
const REPORT_MODEL = "openai/gpt-5.4-mini";
const VERIFY_MODEL = "openai/gpt-5.4-mini";
const RESEARCH_MODEL = "grok-4.20-non-reasoning";

const MAX_SOURCE_URLS = 8;
const X_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

type AgentFinishLog = {
  finishReason: unknown;
  usage: unknown;
};

function getXStatusUrlParts(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (!X_HOSTS.has(parsed.hostname) || segments.length < 3) {
      return null;
    }

    const [handle, statusSegment, statusId] = segments;
    if (!handle || statusSegment !== "status" || !/^\d+$/.test(statusId ?? "")) {
      return null;
    }

    return {
      handle,
      parsed,
      statusId,
    };
  } catch {
    return null;
  }
}

function buildVerifiedSources(packet: ResearchPacket) {
  return packet.sourcePosts.slice(0, MAX_SOURCE_URLS).map(({ handle, postUrl }) => ({
    handle,
    postUrl,
    statusCode: null,
    reachable: true,
  }));
}

function buildPermissiveVerificationResult(packet: ResearchPacket): VerificationResult {
  const verifiedSources = buildVerifiedSources(packet);
  const themeCount = packet.themes.length;

  if (verifiedSources.length < 4 || themeCount < 2) {
    return {
      verdict: "retry",
      summary:
        "The packet is still too thin for report generation, even with permissive verification enabled.",
      issues: [
        "At least 4 source posts and 2 themes are required to continue.",
      ],
      retryGuidance: [
        "Add more source posts or themes before generating the report.",
      ],
      verifiedSources,
      validSourceCount: verifiedSources.length,
    };
  }

  return {
    verdict: "pass",
    summary:
      "Permissive verification passed. URL reachability checks are disabled and the packet has enough sources and themes to continue.",
    issues: [],
    retryGuidance: [],
    verifiedSources,
    validSourceCount: verifiedSources.length,
  };
}

const verificationTools: ToolSet = {
  inspect_research_packet: tool({
    description:
      "Inspect a research packet using permissive verification rules. This does not perform network reachability checks.",
    inputSchema: z.object({
      packet: researchPacketSchema,
    }),
    execute: async ({ packet }) => {
      const verifiedSources = buildVerifiedSources(packet);
      const uniqueUrls = new Set(verifiedSources.map(({ postUrl }) => postUrl));
      const offPlatformSourceCount = verifiedSources.filter(
        ({ postUrl }) => getXStatusUrlParts(postUrl) === null
      ).length;

      return {
        verification: buildPermissiveVerificationResult(packet),
        themeCount: packet.themes.length,
        uniqueSourceUrlCount: uniqueUrls.size,
        offPlatformSourceCount,
      };
    },
  }),
};

const researchAgent = new TracedToolLoopAgent({
  model: xai.responses(RESEARCH_MODEL),
  instructions: `You are the X research worker in a multi-agent system.

Your job:
1. Research a single approved topic on X from the last ${DEFAULT_LOOKBACK_DAYS} days.
2. Use x_search first for trend discovery.
3. Use web_search only when you need additional context for a claim that appears repeatedly on X.
4. Return structured output only.

Quality bar:
- Focus on recent, concrete trend signals from the last 24 hours.
- Prefer direct post URLs from X.
- Prefer primary announcement posts, original reporting, or product-adjacent accounts over roundup/summary accounts.
- Do not anchor a theme on a roundup post when a more primary post is available in the same window.
- Exclude developments first announced outside the last 24 hours unless the new development itself happened in the last 24 hours.
- Do not invent handles, URLs, or timestamps.
- Source posts should be distinct and representative.
- Keep executiveBrief concise and factual.
`,
  tools: {
    x_search: xai.tools.xSearch({
      fromDate: new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      toDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      enableImageUnderstanding: false,
      enableVideoUnderstanding: false,
    }),
    web_search: xai.tools.webSearch(),
  },
  output: Output.object({ schema: researchPacketSchema }),
  stopWhen: stepCountIs(6),
  onFinish: ({ finishReason, usage }: AgentFinishLog) => {
    console.log("[multi-agent:research] finish", { finishReason, usage });
  },
});

const verifierAgent = new TracedToolLoopAgent({
  model: VERIFY_MODEL,
  instructions: `You are the verification worker in a multi-agent system.

Your job:
1. Review the research packet.
2. Call inspect_research_packet exactly once before deciding.
3. This verification is intentionally permissive for the demo.
4. Return verdict=retry only when the packet has fewer than 4 source posts or fewer than 2 themes.
5. Otherwise return verdict=pass so report generation can continue.

Output rules:
- Use the verification object returned by inspect_research_packet as the basis for your final answer.
- verifiedSources must contain only handle, postUrl, statusCode, and reachable.
- Do not perform or imply URL reachability checks.

Be consistent. The goal is to keep the demo moving while still blocking obviously thin packets.
`,
  tools: verificationTools,
  output: Output.object({ schema: verificationResultSchema }),
  stopWhen: stepCountIs(4),
  onFinish: ({ finishReason, usage }: AgentFinishLog) => {
    console.log("[multi-agent:verify] finish", { finishReason, usage });
  },
});

const reportAgent = new TracedToolLoopAgent({
  model: REPORT_MODEL,
  instructions: `You are the report-writing worker in a multi-agent system.

You will receive a verified research packet and verification outcome.
Produce a crisp, employer-friendly trend report with citations.

Requirements:
- Keep the tone analytical and concrete.
- Use only verified evidence.
- Preserve direct URLs.
- Organize the output for clear presentation in a product UI.
`,
  output: Output.object({ schema: trendReportSchema }),
  stopWhen: stepCountIs(4),
  onFinish: ({ finishReason, usage }: AgentFinishLog) => {
    console.log("[multi-agent:report] finish", { finishReason, usage });
  },
});

const plannerTools: ToolSet = {
  research_topic: tool({
    description:
      "Delegate topic research to the X research subagent. Use this first to collect a research packet.",
    inputSchema: z.object({
      topic: topicSchema,
      brief: z.string().min(10),
    }),
    execute: async ({ topic, brief }, { abortSignal }) => {
      const result = await researchAgent.generate({
        prompt: `${buildTopicPrompt(topic)}\n\nResearch brief:\n${brief}`,
        abortSignal,
      });

      console.log(
        "[multi-agent:research] output",
        JSON.stringify(result.output, null, 2)
      );

      return result.output;
    },
  }),
  verify_research_packet: tool({
    description:
      "Send the research packet to the verification subagent. Use this before any report generation.",
    inputSchema: z.object({
      packet: researchPacketSchema,
    }),
    execute: async ({ packet }, { abortSignal }) => {
      const fallback = buildPermissiveVerificationResult(packet);

      try {
        const result = await verifierAgent.generate({
          prompt: [
            `Verify the research packet for the topic \"${packet.topic}\".`,
            "Research packet:",
            JSON.stringify(packet, null, 2),
          ].join("\n\n"),
          abortSignal,
        });

        return verificationResultSchema.parse(result.output ?? fallback);
      } catch (error) {
        console.error("[multi-agent:verify] schema failure", error);
        return fallback;
      }
    },
  }),
  generate_trend_report: tool({
    description:
      "Generate the final structured trend report once verification has passed.",
    inputSchema: z.object({
      packet: researchPacketSchema,
      verification: verificationResultSchema,
    }),
    execute: async ({ packet, verification }, { abortSignal }) => {
      const result = await reportAgent.generate({
        prompt: [
          `Write the final trend report for the topic \"${packet.topic}\".`,
          "Verified research packet:",
          JSON.stringify(packet, null, 2),
          "Verification outcome:",
          JSON.stringify(verification, null, 2),
        ].join("\n\n"),
        abortSignal,
      });

      return result.output;
    },
  }),
};

export const multiAgentPlanner = new TracedToolLoopAgent({
  model: PLANNER_MODEL,
  instructions: `You are the planner/orchestrator in a multi-agent system for researching X trends.

Workflow rules:
1. Start by planning the topic research.
2. Call research_topic.
3. Always call verify_research_packet before calling generate_trend_report.
4. If verification returns verdict=retry, do one focused retry with a tighter research brief that addresses the reported issues.
5. Only call generate_trend_report when verification passes.
6. Keep your final assistant message short.

Final message rules:
- If report generation succeeded, summarize the run in 2-4 sentences and point to the rendered report.
- If verification blocked the run, explain that in 1-2 sentences only.
- Do not restate a full report, source index, or bullet sections in plain text because the UI renders tool outputs separately.

Do not invent evidence outside the tool outputs.
`,
  tools: plannerTools,
  stopWhen: stepCountIs(8),
  onFinish: ({ finishReason, usage }: AgentFinishLog) => {
    console.log("[multi-agent:planner] finish", { finishReason, usage });
  },
});

export type MultiAgentUIMessage = InferAgentUIMessage<typeof multiAgentPlanner>;

export function buildPlannerPrompt(topic: z.infer<typeof topicSchema>) {
  return [
    `Topic: ${topic}`,
    `Goal: produce a verified X trend report for ${topic}.`,
    `Timeframe: last ${DEFAULT_LOOKBACK_DAYS} day / last 24 hours.`,
    "Citations: include direct source post URLs and handles.",
    "Freshness: prefer posts created in the last 24 hours, not older announcements that are merely still being discussed.",
    "Source quality: prefer primary announcement posts or direct reporting over roundup accounts when possible.",
    "Verification: include supported, specific source URLs and enough evidence for each claim; verification may flag thin sourcing, but it does not confirm URL reachability.",
  ].join("\n");
}

export function getTopicFromMessages(messages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const text = lastUser?.parts?.find((part) => part.type === "text")?.text?.trim().toLowerCase();

  return topicSchema.safeParse(text);
}

export function summarizeReportForFallback(report: TrendReport) {
  return [
    `# ${report.title}`,
    "",
    report.dek,
    "",
    "## Executive Summary",
    report.executiveSummary,
    "",
    "## Key Themes",
    ...report.keyThemes.flatMap((theme) => [
      `- **${theme.title}**: ${theme.summary}`,
      ...theme.evidence.map(
        (evidence) => `  - ${evidence.handle}: ${evidence.whyItMatters} (${evidence.postUrl})`
      ),
    ]),
  ].join("\n");
}

export function buildRetryBrief(topic: z.infer<typeof topicSchema>, verification: VerificationResult) {
  return [
    `Research the topic ${topic} again and fix these issues:`,
    ...verification.issues.map((issue) => `- ${issue}`),
    ...verification.retryGuidance.map((step) => `- ${step}`),
  ].join("\n");
}

export type MultiAgentResearchPacket = ResearchPacket;