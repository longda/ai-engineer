import { z } from "zod";
import { topicSchema } from "./topics";

const absoluteUrlSchema = z
  .string()
  .min(1)
  .describe("Absolute URL string including the https:// prefix.");

export const sourcePostSchema = z.object({
  handle: z.string(),
  displayName: z.string(),
  postUrl: absoluteUrlSchema,
  postText: z.string(),
  postedAt: z.string(),
  rationale: z.string(),
});

export const themeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  evidenceHandles: z.array(z.string()).min(1),
  evidenceUrls: z.array(absoluteUrlSchema).min(1),
});

export const researchPacketSchema = z.object({
  topic: topicSchema,
  timeframe: z.string(),
  searchFocus: z.array(z.string()).min(2).max(6),
  executiveBrief: z.string(),
  themes: z.array(themeSchema).min(2).max(5),
  sourcePosts: z.array(sourcePostSchema).min(4).max(10),
  notableSignals: z.array(z.string()).min(2).max(6),
  caveats: z.array(z.string()).max(4),
});

export const verifiedSourceSchema = z.object({
  handle: z.string(),
  postUrl: absoluteUrlSchema,
  statusCode: z.number().int().min(100).max(599).nullable(),
  reachable: z.boolean(),
});

export const verificationResultSchema = z.object({
  verdict: z.enum(["pass", "retry"]),
  summary: z.string(),
  issues: z.array(z.string()).max(6),
  retryGuidance: z.array(z.string()).max(4),
  verifiedSources: z.array(verifiedSourceSchema),
  validSourceCount: z.number().int().nonnegative(),
});

export const trendReportSchema = z.object({
  title: z.string(),
  dek: z.string(),
  executiveSummary: z.string(),
  keyThemes: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      evidence: z.array(
        z.object({
          handle: z.string(),
          postUrl: absoluteUrlSchema,
          whyItMatters: z.string(),
        })
      ).min(1),
    })
  ).min(2).max(5),
  supportingData: z.array(z.string()).min(2).max(6),
  sourceIndex: z.array(
    z.object({
      handle: z.string(),
      displayName: z.string(),
      postUrl: absoluteUrlSchema,
      postedAt: z.string(),
    })
  ).min(4),
  citations: z.array(absoluteUrlSchema).min(4),
});

export type ResearchPacket = z.infer<typeof researchPacketSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type TrendReport = z.infer<typeof trendReportSchema>;