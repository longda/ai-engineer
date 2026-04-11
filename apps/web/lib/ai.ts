import { initLogger, wrapAISDK } from "braintrust";
import * as ai from "ai";

initLogger({
  projectName: "ai-engineer",
  apiKey: process.env.BRAINTRUST_API_KEY,
});

const wrapped = wrapAISDK(ai);

// Re-export wrapped AI SDK functions — add more as needed
export const { streamText, generateText, generateObject, streamObject } =
  wrapped;
