import { z } from "zod";

export const TOPIC_OPTIONS = [
  "ai",
  "sports",
  "music",
  "tech",
  "science",
  "business",
  "arts + culture",
  "entertainment",
] as const;

export const topicSchema = z.enum(TOPIC_OPTIONS);

export const TOPIC_LABELS: Record<(typeof TOPIC_OPTIONS)[number], string> = {
  ai: "AI",
  sports: "Sports",
  music: "Music",
  tech: "Tech",
  science: "Science",
  business: "Business",
  "arts + culture": "Arts + Culture",
  entertainment: "Entertainment",
};

export const DEFAULT_LOOKBACK_DAYS = 1;

export function buildTopicPrompt(topic: z.infer<typeof topicSchema>) {
  return `Research the latest trend signals on X for the topic "${topic}" from the last ${DEFAULT_LOOKBACK_DAYS} days.`;
}