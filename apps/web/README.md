# AI Engineer Web App

This app is the interactive Next.js surface for the ai-engineer portfolio repo. It currently ships the live demos for prompt-pattern comparison, the ARC Raiders embeddings and vector-search lab, and a tool-using sports agent with persistent memory.

## Initial Project Setup

Run the app from the repository root:

```bash
pnpm install
cp apps/web/.sample.env apps/web/.env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) after the dev server starts.

Useful follow-up commands:

```bash
pnpm --filter web dev
pnpm --filter web check-types
pnpm --filter web lint
```

`pnpm dev` runs the workspace through Turborepo. If you only want this app, use `pnpm --filter web dev`.

## Environment Variables

For local development, use `.env.local` in this app instead of a committed `.env` file:

```bash
# from the repo root
cp apps/web/.sample.env apps/web/.env.local

# or from apps/web
cp .sample.env .env.local
```

The sample file includes the environment variables this app expects:

| Variable | What it is for | Where to get it |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Authenticates model calls sent through the Vercel AI Gateway. Required for the prompt-pattern demo, the sports agent, the token-economics routing lab, and the multi-agent planner/report/verification steps. | Create an API key in the Vercel AI Gateway dashboard.
| `BRAINTRUST_API_KEY` | Enables Braintrust tracing for AI SDK calls and agent runs. | Create an API key in the Braintrust dashboard.
| `BRAINTRUST_PROJECT_NAME` | Tells the observability dashboard which Braintrust project to resolve by name. Required unless you set `BRAINTRUST_PROJECT_ID` directly. | Use the Braintrust project name you want the dashboard to read from.
| `BRAINTRUST_PROJECT_ID` | Optional override for the observability dashboard so it can query a known Braintrust project directly instead of resolving by project name first. | Copy the project ID from the Braintrust project settings or URL.
| `FIRECRAWL_API_KEY` | Authenticates Firecrawl ingestion for the ARC Raiders embeddings and vector-search lab. | Create an API key in the Firecrawl dashboard.
| `UPSTASH_REDIS_REST_URL` | Points both the agent memory layer and the ARC Raiders scrape-artifact cache at your Upstash Redis REST endpoint. | Create an Upstash Redis database and copy the REST URL from its details page.
| `UPSTASH_REDIS_REST_TOKEN` | Authenticates requests to the Upstash Redis REST API for agent memory and cached markdown artifacts. | Copy the REST token from the same Upstash Redis database settings page.
| `UPSTASH_VECTOR_REST_URL` | Points the ARC Raiders corpus indexer and search API at your Upstash Vector REST endpoint. | Create an Upstash Vector index and copy the REST URL from its details page.
| `UPSTASH_VECTOR_REST_TOKEN` | Authenticates requests to the Upstash Vector REST API for corpus upserts and semantic search. | Copy the REST token from the same Upstash Vector index settings page.
| `XAI_API_KEY` | Authenticates the direct xAI Responses API calls used by the multi-agent research worker for `x_search` and `web_search`. This is needed in addition to `AI_GATEWAY_API_KEY` because the current X research tool path runs directly against xAI, not through the gateway. | Create an API key in the xAI console.

Notes:

- Do not commit real credentials.
- Braintrust tracing is wired into the app, so `BRAINTRUST_API_KEY` should be set if you want trace visibility during local runs.
- For the multi-agent trend-report flow, set both `AI_GATEWAY_API_KEY` and `XAI_API_KEY`: the planner/report/verifier agents still use the gateway, while the X research worker uses xAI's native tool-enabled Responses API.

## Completed Objective Tasks

These are the objective tasks currently implemented in this app.

### Objective 2.1: Prompt Pattern Comparison Tool

Description: A side-by-side prompt lab that runs the same question through zero-shot, few-shot, and chain-of-thought system prompts.

Key details:

- Live route: `/prompt-patterns`
- One question fans out into three parallel AI SDK chat lanes.
- Prompt templates are defined server-side in `app/api/prompt-patterns/prompts.ts`.
- The chain-of-thought lane separates visible reasoning steps from the final answer in the UI.
- Braintrust wraps the AI SDK route so prompt runs are traceable.

### Objective 3: Embeddings and Vector Search

Description: An ARC Raiders embeddings lab that ingests approved source pages into a reusable corpus, compares chunking strategies, and exposes semantic vector search with citations.

Key details:

- Live route: `/embeddings`
- API routes: `/api/embeddings/ingest`, `/api/embeddings/search`, and `/api/embeddings/chunking`
- The approved corpus is limited to official ARC Raiders site pages, official ARC Raiders updates, and one approved community item database source.
- Ingestion uses Firecrawl plus repo-owned normalization, chunking, embeddings, and Upstash Vector upserts instead of indexing raw HTML directly.
- Embeddings use `openai/text-embedding-3-small` through the wrapped AI SDK entrypoint in `lib/ai.ts`.
- The vector layer uses Upstash Vector namespace `arc-raiders-v1` and returns ranked chunks, metadata, and similarity scores from the search API.
- Scrape artifacts are cached as markdown-only records in Upstash Redis so repeated ingests reuse previously downloaded pages and remain compatible with Vercel's runtime model.
- The chunking lab compares fixed, overlapping, and semantic chunking on the approved long-form Metaforge item catalog source at `https://metaforge.app/arc-raiders/database/items/page/1`.
- After fixing stale batch-scrape cache mapping, the benchmark now produces a discriminative result: semantic chunking wins on the catalog benchmark with `recall@3` of `9/10`, ahead of overlapping at `8/10` and fixed at `7/10`.
- The ingest summary now exposes cache store, hit count, and miss count so refresh behavior is visible in the UI.

### Objective 6.1: Tool-Calling Single Agent

Description: A sports news assistant that uses a ReAct-style loop to search, reason, call tools, and produce a final answer.

Key details:

- Live route: `/agent`
- Uses `ToolLoopAgent` plus `createAgentUIStreamResponse` for streamed UI output.
- Tool set includes `web_search`, `get_current_date`, `calculate_stats`, `remember`, `recall`, and `list_memories`.
- Supports multi-step requests such as finding current standings and then calculating derived stats.
- Tool calls are rendered inline so the UI exposes what the agent searched or computed before answering.
- Important implementation note: the built-in `gateway.tools.perplexitySearch()` provider tool did not reliably complete the final assistant text step in this `ToolLoopAgent` flow, so the shipped agent uses a custom execute-based `web_search` tool instead.

### Objective 6.2: Long-Term Memory

Description: Persistent cross-session memory for the sports agent using Upstash Redis.

Key details:

- Memory keys are stored under a dedicated Redis prefix.
- Saved memories currently use a 30-day TTL.
- The agent can store user preferences or facts with `remember` and fetch them later with `recall`.
- `list_memories` exposes the currently saved keys when the agent needs to inspect what it already knows.

### Objective 7: Multi-Agent Trend Report

Description: A multi-agent workflow that researches a chosen topic on X, runs a verification checkpoint, and renders a structured report with citations.

Key details:

- Live route: `/multi-agent`
- Uses `ToolLoopAgent` for all four roles: planner/orchestrator, X research worker, verification worker, and report writer.
- The planner enforces a fixed flow of research, verification, and then report generation.
- The research worker uses xAI's Responses API with `x_search` and `web_search` tools to gather recent X posts and supporting context.
- The verification step is intentionally permissive in this MVP: it blocks obviously thin packets, but it does not perform live URL reachability checks.
- The final report includes an executive summary, theme breakdowns, supporting data, and source citations for UI rendering.
- Braintrust wraps the agent class here as well, so the multi-agent run is traced end to end when `BRAINTRUST_API_KEY` is configured.

### Objective 8: Failure Pattern Recognition

Description: A live comparison lab that runs the same refund-assistant case before and after remediation for six common agent failure patterns.

Key details:

- Live route: `/failure-patterns`
- API route: `/api/failure-patterns`
- Covers six selectable scenarios: context degradation, specification drift, sycophantic confirmation, tool-selection errors, cascading failure, and silent failure.
- Keeps one shared business domain across all scenarios: DaveCanCode Returns Desk for refunds, returns, replacements, and shipping exceptions.
- A single request runs both the broken variant and the remediated variant on the server, then returns the two results together for side-by-side rendering.
- The comparison route uses the wrapped AI stack in `lib/ai.ts`, with real model output rather than authored broken/fixed answer fixtures.
- Most scenarios run through a shared refund-assistant `ToolLoopAgent` plus deterministic local tools; the cascading-failure scenario uses a packet handoff plus verification/retry step so the failure chain is directly observable.
- The UI shows the assistant answer, evidence trace, and a deterministic evaluation verdict for each run.
- Evaluations are programmatic where possible: required fact checks, packet field checks, tool-order checks, intermediate verification checks, and arithmetic checks.

### Objective 10: Guardrails and Trust Design

Description: A protected email assistant demo that combines input and output guardrails with a human approval checkpoint before a simulated high-risk action.

Key details:

- Live route: `/guardrails`
- API route: `/api/guardrails`
- Packet-driven demo covers three outcomes: a safe pass path, an input-blocked path, and an output-blocked path.
- Input guardrails combine a binary model check for jailbreak or prompt-injection risk with deterministic secret and high-risk PII pattern detection.
- Output guardrails validate email draft structure and run a safety/appropriateness check, including a block on explicitly demeaning or humiliating requested tone.
- High-risk action is modeled as a `send_protected_email` tool call that requires explicit approval before execution.
- The send step is intentionally fake and never delivers a real email; execution returns a simulated result payload for the UI.
- The conversation renders guardrail result cards and approval UI so each stop or pass decision is visible during the run.

### Objective 11.1: Braintrust Tracing

Description: Tracing is wired into both prompt-based and agent-based AI flows.

Key details:

- `wrapAISDK()` is used for AI SDK function tracing.
- `wrapAgentClass()` is used so `ToolLoopAgent` runs are traced as agent executions.
- The prompt-pattern route and the sports-agent stack both send traces when `BRAINTRUST_API_KEY` is configured.
- This is the current observability foundation for later cost and quality instrumentation work.

### Objective 11.2: Cost Dashboard

Description: A server-rendered observability dashboard that reads Braintrust trace data through BTQL and turns it into a lightweight latency, cost, and token view inside the app.

Key details:

- Live route: `/observability`
- The page queries Braintrust directly on the server and does not modify the tracing wrapper in `lib/ai.ts`.
- The dashboard currently treats LLM spans as the billing unit and surfaces total estimated cost, average latency, total tokens, and average cost per query.
- Time windows are switchable between 1, 7, and 14 days.
- The main sections are daily cost trend, model breakdown, and recent traced queries.
- Cost by endpoint or feature is intentionally not included in this version because the existing traces do not guarantee a stable route-level metadata field.

### Objective 12: Token Economics

Description: A combined calculator and routing lab that makes model pricing visible and shows a cost-aware selection between a cheaper and a more capable model.

Key details:

- Live route: `/token-economics`
- The calculator uses a curated model set drawn from AI Gateway model metadata, with an authenticated package lookup when available and a public catalog fallback when it is not.
- Users can select multiple models, set separate input and output token counts, and compare scenario cost across the selected set.
- The top summary cards surface selected-model count, equal-weight blended cost, cheapest selected option, and most expensive selected option for the current token scenario.
- The model grid lays out provider, input price, output price, context window, max output tokens, and scenario total in a compact card format inspired by the AI Gateway models page.
- The routing lab uses canned prompts only and runs a visible two-step flow: router agent first, fulfillment agent second.
- The routing summary card shows the chosen model, complexity classification, estimated token counts, estimated routed cost, alternate-model cost, and the delta between them.
- The fulfillment pair is fixed on purpose for the demo: `openai/gpt-4o-mini` handles simple requests and `openai/gpt-5-mini` handles complex ones.

### Objective 14: MCP Integration

Description: A hosted HTTP MCP server wraps the Chuck Norris API, and a server-side agent route acts as the MCP client that discovers tools at runtime.

Key details:

- Live route: `/mcp`
- MCP server route: `/api/mcp`
- Discovery route: `/api/mcp-tools`
- Agent route: `/api/mcp-agent`
- The MCP server exposes `list_categories`, `get_random_joke`, and `search_jokes`.
- The agent does not hardcode those tools locally. It connects to the MCP server with `@ai-sdk/mcp`, fetches the tool list dynamically, and passes the discovered tools into `ToolLoopAgent` for the current request.
- The UI renders discovered tool names and tool call cards so the MCP layer is visible instead of hidden behind a generic wrapper.
- Request path: UI -> agent route -> ToolLoopAgent -> MCP client -> MCP server -> Chuck Norris API.
