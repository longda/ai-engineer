import type { UIMessage } from "ai";
import { z } from "zod";

export const guardrailCheckSchema = z.object({
  label: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

export const guardrailDataSchema = z.object({
  packetId: z.string(),
  phase: z.enum(["input", "output"]),
  status: z.enum(["pass", "fail"]),
  title: z.string(),
  summary: z.string(),
  checks: z.array(guardrailCheckSchema),
});

export type GuardrailCheck = z.infer<typeof guardrailCheckSchema>;
export type GuardrailData = z.infer<typeof guardrailDataSchema>;

export type GuardrailsUIMessage = UIMessage<
  never,
  {
    guardrail: GuardrailData;
  }
>;