import { stepCountIs } from "ai";
import { TracedToolLoopAgent } from "@/lib/ai";
import { evaluateScenarioRun } from "./evaluate";
import {
  appendToolTrace,
  buildRefundAssistantInstructions,
  buildRefundAssistantPrompt,
  buildRefundScenarioTools,
  type ScenarioPhase,
} from "./refund-lab";
import { getFailureScenario, type FailureScenario } from "./scenarios";
import type {
  FailurePatternComparisonResponse,
  FailurePatternRunResult,
  ToolTraceEntry,
} from "./types";

const MODEL_ID = "openai/gpt-5.4-mini";

class InvalidScenarioIdError extends Error {
  constructor(scenarioId: string) {
    super(`Invalid failure-pattern scenario id: ${scenarioId}`);
    this.name = "InvalidScenarioIdError";
  }
}

type IntermediatePacket = {
  orderId: string;
  daysSinceDelivery: number;
  decisionRecommendation: "approve refund" | "deny refund";
  rationale: string;
  evidence: string[];
};

function getRunLabel(phase: ScenarioPhase) {
  return phase === "before" ? "Before remediation" : "After remediation";
}

function getRunDescription(scenario: FailureScenario, phase: ScenarioPhase) {
  return phase === "before"
    ? scenario.before.description
    : scenario.after.description;
}

function getStopLimit(scenario: FailureScenario, phase: ScenarioPhase) {
  if (scenario.id === "specification-drift" && phase === "after") {
    return 8;
  }

  if (scenario.id === "tool-selection-errors") {
    return 5;
  }

  return 6;
}

function makeRunErrorResult(
  scenario: FailureScenario,
  phase: ScenarioPhase,
  error: unknown
): FailurePatternRunResult {
  const message =
    error instanceof Error ? error.message : "Unknown model execution failure.";

  return {
    label: getRunLabel(phase),
    description: getRunDescription(scenario, phase),
    assistantText: "",
    toolTrace: [],
    evaluation: evaluateScenarioRun({
      scenario,
      phase,
      assistantText: "",
      toolTrace: [],
      error: message,
    }),
    error: message,
  };
}

async function runSingleAgentScenario(
  scenario: FailureScenario,
  phase: ScenarioPhase,
  abortSignal?: AbortSignal
): Promise<FailurePatternRunResult> {
  const toolTrace: ToolTraceEntry[] = [];
  const agent = new TracedToolLoopAgent({
    model: MODEL_ID,
    instructions: buildRefundAssistantInstructions(scenario, phase),
    tools: buildRefundScenarioTools(scenario, phase),
    stopWhen: stepCountIs(getStopLimit(scenario, phase)),
  });

  const result = await agent.generate({
    prompt: buildRefundAssistantPrompt(scenario, phase),
    abortSignal,
    onStepFinish: (event: Parameters<typeof appendToolTrace>[1]) =>
      appendToolTrace(toolTrace, event),
  });

  const assistantText = result.text.trim();

  return {
    label: getRunLabel(phase),
    description: getRunDescription(scenario, phase),
    assistantText,
    toolTrace,
    evaluation: evaluateScenarioRun({
      scenario,
      phase,
      assistantText,
      toolTrace,
    }),
    finishReason: String(result.finishReason),
  };
}

function pushManualTrace(
  trace: ToolTraceEntry[],
  toolName: string,
  input: unknown,
  output: unknown
) {
  trace.push({
    stepNumber: trace.length,
    toolName,
    input,
    output,
  });
}

function buildIntermediatePacket(attempt: number): IntermediatePacket {
  if (attempt === 1) {
    return {
      orderId: "8870",
      daysSinceDelivery: 3,
      decisionRecommendation: "approve refund",
      rationale:
        "The packet confused the last customer-contact age with delivery age and concluded the order was only 3 days old.",
      evidence: [
        "Last customer follow-up was 3 days ago.",
        "Refund window closes at 30 days.",
      ],
    };
  }

  return {
    orderId: "8870",
    daysSinceDelivery: 33,
    decisionRecommendation: "deny refund",
    rationale:
      "The verified order record shows delivery happened 33 days ago, which is outside the 30-day refund window.",
    evidence: [
      "Source order record: delivered 33 days ago.",
      "Refund window closes after 30 days.",
    ],
  };
}

function verifyIntermediatePacket(packet: IntermediatePacket) {
  const issues: string[] = [];

  if (packet.daysSinceDelivery !== 33) {
    issues.push(
      `daysSinceDelivery should be 33, not ${packet.daysSinceDelivery}.`
    );
  }

  if (
    packet.daysSinceDelivery > 30 &&
    packet.decisionRecommendation !== "deny refund"
  ) {
    issues.push("Packets outside the 30-day window must recommend denial.");
  }

  return {
    passed: issues.length === 0,
    authoritativeRecord: {
      orderId: packet.orderId,
      daysSinceDelivery: 33,
      refundWindowDays: 30,
    },
    issues,
  };
}

async function runCascadingFailureScenario(
  scenario: FailureScenario,
  phase: ScenarioPhase,
  abortSignal?: AbortSignal
): Promise<FailurePatternRunResult> {
  const toolTrace: ToolTraceEntry[] = [];
  const initialPacket = buildIntermediatePacket(1);

  pushManualTrace(toolTrace, "generate_intermediate_packet", { attempt: 1 }, initialPacket);

  let packetForWriter = initialPacket;

  if (phase === "after") {
    const initialVerification = verifyIntermediatePacket(initialPacket);
    pushManualTrace(
      toolTrace,
      "verify_intermediate_packet",
      initialPacket,
      initialVerification
    );

    if (!initialVerification.passed) {
      const retryPacket = buildIntermediatePacket(2);
      pushManualTrace(
        toolTrace,
        "retry_intermediate_packet",
        {
          issues: initialVerification.issues,
          attempt: 2,
        },
        retryPacket
      );

      const retryVerification = verifyIntermediatePacket(retryPacket);
      pushManualTrace(
        toolTrace,
        "verify_intermediate_packet",
        retryPacket,
        retryVerification
      );

      packetForWriter = retryPacket;
    }
  }

  const writerAgent = new TracedToolLoopAgent({
    model: MODEL_ID,
    instructions: [
      "You are the final response writer for DaveCanCode Returns Desk.",
      "Use only the provided packet and explain the decision briefly.",
      phase === "before"
        ? "Trust the packet exactly as received. Do not question or verify packet facts."
        : "The packet has been verified. Use it as the authoritative basis for the answer.",
    ].join("\n\n"),
    tools: {},
    stopWhen: stepCountIs(2),
  });

  const result = await writerAgent.generate({
    prompt: [
      scenario.userMessage,
      phase === "before" ? scenario.before.systemOverlay : scenario.after.systemOverlay,
      "Intermediate packet:",
      JSON.stringify(packetForWriter, null, 2),
    ].join("\n\n"),
    abortSignal,
  });

  const assistantText = result.text.trim();

  return {
    label: getRunLabel(phase),
    description: getRunDescription(scenario, phase),
    assistantText,
    toolTrace,
    evaluation: evaluateScenarioRun({
      scenario,
      phase,
      assistantText,
      toolTrace,
    }),
    finishReason: String(result.finishReason),
  };
}

async function runScenarioVariant(
  scenario: FailureScenario,
  phase: ScenarioPhase,
  abortSignal?: AbortSignal
): Promise<FailurePatternRunResult> {
  try {
    if (scenario.id === "cascading-failure") {
      return await runCascadingFailureScenario(scenario, phase, abortSignal);
    }

    return await runSingleAgentScenario(scenario, phase, abortSignal);
  } catch (error) {
    return makeRunErrorResult(scenario, phase, error);
  }
}

export async function runFailurePatternComparison(
  scenarioId: string,
  abortSignal?: AbortSignal
): Promise<FailurePatternComparisonResponse> {
  const scenario = getFailureScenario(scenarioId);

  if (!scenario) {
    throw new InvalidScenarioIdError(scenarioId);
  }

  const before = await runScenarioVariant(scenario, "before", abortSignal);
  const after = await runScenarioVariant(scenario, "after", abortSignal);

  return {
    scenario: {
      id: scenario.id,
      title: scenario.title,
      summary: scenario.summary,
      injectionSummary: scenario.injectionSummary,
      remediationSummary: scenario.remediationSummary,
      expectedOutcome: scenario.evaluation.expectedOutcome,
      hiddenTruth: scenario.hiddenTruth,
    },
    runs: {
      before,
      after,
    },
  };
}

export { InvalidScenarioIdError };