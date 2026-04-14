import "server-only";
import { initLogger, wrapAISDK, wrapAgentClass } from "braintrust";
import * as ai from "ai";

initLogger({
  projectName: "ai-engineer",
  apiKey: process.env.BRAINTRUST_API_KEY,
});

const wrapped = wrapAISDK(ai);

// Re-export wrapped AI SDK functions — add more as needed
export const { streamText, generateText, generateObject, streamObject } =
  wrapped;

// Wrap ToolLoopAgent class so all agent runs are traced in Braintrust
export const TracedToolLoopAgent = wrapAgentClass(ai.ToolLoopAgent);
