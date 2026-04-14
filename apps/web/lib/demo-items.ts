export type DemoStatus = "live" | "soon";

export type DemoItem = {
  id: string;
  number: number;
  title: string;
  description: string;
  href?: string;
  status: DemoStatus;
};

export const DEMO_ITEMS: DemoItem[] = [
  {
    id: "spec-precision",
    number: 1,
    title: "Specification precision",
    description:
      "System prompt library and Zod-validated structured output with generateObject.",
    status: "soon",
  },
  {
    id: "prompt-patterns",
    number: 2,
    title: "Prompt engineering patterns",
    description:
      "Compare zero-shot, few-shot, and chain-of-thought prompt patterns side-by-side.",
    href: "/prompt-patterns",
    status: "live",
  },
  {
    id: "embeddings",
    number: 3,
    title: "Embeddings & vector search",
    description: "Semantic search API with embed / embedMany and a vector store.",
    status: "soon",
  },
  {
    id: "rag",
    number: 4,
    title: "RAG pipeline",
    description: "End-to-end retrieve-augment-generate with streaming responses.",
    status: "soon",
  },
  {
    id: "evaluation",
    number: 5,
    title: "Evaluation",
    description: "Eval harness with LLM-as-a-judge and retrieval metrics.",
    status: "soon",
  },
  {
    id: "single-agent",
    number: 6,
    title: "Single agent",
    description: "ReAct-style agent with tools, steps, and memory.",
    href: "/agent",
    status: "live",
  },
  {
    id: "multi-agent",
    number: 7,
    title: "Multi-agent",
    description: "Planner–worker orchestration with verification checkpoints.",
    status: "soon",
  },
  {
    id: "failure-patterns",
    number: 8,
    title: "Failure patterns",
    description: "Demos and fixes for common agent failure modes.",
    status: "soon",
  },
  {
    id: "context-architecture",
    number: 9,
    title: "Context architecture",
    description: "Multi-source RAG with metadata filtering.",
    status: "soon",
  },
  {
    id: "guardrails",
    number: 10,
    title: "Guardrails",
    description: "Input/output validation and human-in-the-loop approval flows.",
    status: "soon",
  },
  {
    id: "observability",
    number: 11,
    title: "Observability",
    description: "Tracing, latency, tokens, and cost visibility.",
    status: "soon",
  },
  {
    id: "token-economics",
    number: 12,
    title: "Token economics",
    description: "Model cost comparison and routing by task complexity.",
    status: "soon",
  },
  {
    id: "fine-tuning",
    number: 13,
    title: "Fine-tuning",
    description: "Small fine-tune vs RAG comparison on a focused task.",
    status: "soon",
  },
  {
    id: "mcp",
    number: 14,
    title: "MCP",
    description: "TypeScript MCP server with tools for a desktop client.",
    status: "soon",
  },
  {
    id: "deploy",
    number: 15,
    title: "Deploy & ship",
    description: "Live demos, repo narrative, and portfolio polish.",
    status: "soon",
  },
];
