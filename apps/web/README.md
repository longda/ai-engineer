# AI Engineer Web App

This app is the main interactive surface for the `ai-engineer` repo. The root README gives the high-level portfolio story. This file is the operator's guide: what runs here, which demos are live, how the stack is wired, and what someone technical should look at first.

In practice, this app is a compact AI engineering lab built with Next.js, React, TypeScript, and the Vercel AI SDK. It is deliberately broader than a single chatbot. The shipped demos cover prompt contracts, structured outputs, semantic retrieval, tool use, memory, multi-agent orchestration, failure analysis, guardrails, observability, cost controls, and MCP integration.

## What This App Demonstrates

If you are technical, the app is meant to show production-oriented patterns: typed outputs, retrieval pipelines, vector metadata, tool orchestration, verification checkpoints, and traceable runtime behavior.

If you are less technical, the short version is simpler: each page demonstrates one part of making AI features reliable enough to ship instead of just impressive enough to demo once.

## Route Inventory

### Live routes

| Route | Objective | What it demonstrates |
| --- | --- | --- |
| `/` | Landing page | A skills-lab index that maps the project to 15 AI engineering objectives. |
| `/specification-precision` | 1 | Structured output with prompt catalogs and schema-constrained results. |
| `/prompt-patterns` | 2 | Zero-shot, few-shot, and chain-of-thought prompt comparisons on the same task. |
| `/embeddings` | 3 | ARC Raiders ingestion, chunking comparison, embeddings, and semantic search. |
| `/rag` | 4 | Vector-only, hybrid, and reranked RAG comparisons with streamed answers, retrieval evidence, and citations. |
| `/evaluation` | 5 | A RAG evaluation harness with side-by-side variant comparison, retrieval metrics, LLM judge scores, and Braintrust experiment logging. |
| `/agent` | 6 | A tool-using ReAct-style assistant with long-term memory. |
| `/multi-agent` | 7 | Planner, research, verification, and report-writing agents working as a system. |
| `/failure-patterns` | 8 | Before-and-after demos for six common agent failure modes. |
| `/guardrails` | 10 | Input screening, output validation, and human approval before a protected action. |
| `/observability` | 11 | Braintrust-powered trace, token, latency, and cost visibility. |
| `/token-economics` | 12 | Model pricing comparison plus cost-aware model routing. |
| `/mcp` | 14 | A real HTTP MCP server and a client agent that discovers tools at runtime. |

### Planned next routes

| Objective | Planned area | Current status |
| --- | --- | --- |
| 9 | Context architecture | Planned as the multi-source extension of the retrieval stack. |
| 13 | Fine-tuning | Planned as a narrow experiment, not the default runtime path. |
| 15 | Deploy and ship | Repo narrative, demo polish, and public packaging are still in progress. |

## Architecture At A Glance

| Layer | Current choice | Why it is here |
| --- | --- | --- |
| App framework | Next.js 16 + React 19 | Fast iteration, server routes, streaming UI, and deployability. |
| AI runtime | Vercel AI SDK v6 | Shared model calls, streaming helpers, typed outputs, and agent flows. |
| Model access | Vercel AI Gateway | Centralized model routing and easier provider management. |
| Vector store | Upstash Vector | Simple hosted vector index for retrieval demos. |
| Cache and memory | Upstash Redis | Artifact caching for scraping and long-term agent memory. |
| Scraping | Firecrawl | Controlled ingest of approved ARC Raiders sources. |
| Tracing | Braintrust | Trace history, tokens, latency, and cost inspection. |
| Research worker | xAI Responses API | Tool-enabled research flow for the multi-agent demo. |
| Tool interoperability | MCP over HTTP | Demonstrates dynamic tool discovery instead of hardcoded local tools. |

One repo convention matters across almost every route: model access is centralized through `lib/ai.ts` so demos share the same runtime surface for tracing, gateway usage, and AI SDK behavior.

## Local Setup

Run the app from the repository root:

```bash
pnpm install
cp apps/web/.sample.env apps/web/.env.local
pnpm dev
```

Use Node 22 or newer. This workspace declares `node >=22`, and the Firecrawl SDK also expects that baseline.

Open [http://localhost:3000](http://localhost:3000) after the dev server starts.

Useful follow-up commands:

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web check-types
pnpm --filter web lint
```

`pnpm dev` runs the workspace through Turborepo. If you only want this app, use `pnpm --filter web dev`.

## Environment Variables

Use `.env.local` in this app instead of a committed `.env` file:

```bash
# from the repo root
cp apps/web/.sample.env apps/web/.env.local

# or from apps/web
cp .sample.env .env.local
```

The current sample file includes these variables:

| Variable | Required for local use | What it powers |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Yes for most interactive demos | Authenticates model calls sent through the Vercel AI Gateway. Needed for specification precision, prompt patterns, the sports agent, token economics routing, and the planner, report, and verification agent steps. |
| `BRAINTRUST_API_KEY` | Optional but recommended | Enables tracing for AI SDK calls and agent runs. |
| `BRAINTRUST_PROJECT_NAME` | Optional if `BRAINTRUST_PROJECT_ID` is set | Lets the observability dashboard resolve the Braintrust project by name. |
| `BRAINTRUST_PROJECT_ID` | Optional | Direct project lookup override for the observability dashboard. |
| `FIRECRAWL_API_KEY` | Required for embeddings ingest and chunking evaluation | Authenticates Firecrawl fetches for the ARC Raiders retrieval lab. |
| `UPSTASH_REDIS_REST_URL` | Required for memory or scrape caching | Redis endpoint used for long-term memory and cached markdown scrape artifacts. |
| `UPSTASH_REDIS_REST_TOKEN` | Required with the Redis URL above | Authenticates Redis REST requests. |
| `UPSTASH_VECTOR_REST_URL` | Required for embeddings search and ingest | Upstash Vector endpoint for chunk upserts and semantic search. |
| `UPSTASH_VECTOR_REST_TOKEN` | Required with the Vector URL above | Authenticates Vector REST requests. |
| `EMBEDDINGS_INGEST_API_KEY` | Optional | Protects remote or production calls to `/api/embeddings/ingest`. Local development does not require it. |
| `XAI_API_KEY` | Required for the multi-agent research worker | Authenticates direct xAI Responses API calls for `x_search` and `web_search`. |

Notes:

- Do not commit real credentials into source control.
- If you want trace visibility while developing, set `BRAINTRUST_API_KEY`.
- If you want the multi-agent demo to work end to end, set both `AI_GATEWAY_API_KEY` and `XAI_API_KEY`.
- If you want the embeddings lab to ingest or search real data, you need Firecrawl, Upstash Redis, and Upstash Vector configured together.

## Live Demo Notes

### Objective 1: Specification Precision

Description: A structured-output lab for system prompts and schema-constrained results.

Key details:

- Live route: `/specification-precision`
- API route: `/api/specification-precision`
- The page lets you switch across prompt definitions and run sample inputs through a typed response flow.
- The output is rendered as structured data rather than free-form prose so the contract is obvious.
- This is the cleanest example in the repo of "make the model behave like a component, not a guesser."

### Objective 2: Prompt Engineering Patterns

Description: A side-by-side prompt lab that runs the same question through zero-shot, few-shot, and chain-of-thought variants.

Key details:

- Live route: `/prompt-patterns`
- API route: `/api/prompt-patterns`
- One question fans out into three parallel AI SDK runs.
- Prompt templates are defined server-side in `app/api/prompt-patterns/prompts.ts`.
- The chain-of-thought lane separates visible reasoning steps from the final answer in the UI.
- Braintrust wraps the route so prompt runs are traceable.

### Objective 3: Embeddings and Vector Search

Description: An ARC Raiders embeddings lab that ingests approved source pages into a reusable corpus, compares chunking strategies, and exposes semantic vector search with citations.

Key details:

- Live route: `/embeddings`
- API routes: `/api/embeddings/ingest`, `/api/embeddings/search`, and `/api/embeddings/chunking`
- The approved corpus is limited to official ARC Raiders site pages, official ARC Raiders updates, and one approved community item database source.
- Ingestion uses Firecrawl plus repo-owned normalization, chunking, embeddings, and Upstash Vector upserts instead of indexing raw HTML directly.
- Embeddings use `openai/text-embedding-3-small` through `lib/ai.ts`.
- The vector layer uses Upstash Vector namespace `arc-raiders-v1` and returns ranked chunks, metadata, and similarity scores.
- Scrape artifacts are cached as markdown-only records in Upstash Redis so repeated ingests can reuse prior downloads.
- The chunking lab compares fixed, overlapping, and semantic chunking on the approved Metaforge catalog benchmark source at `https://metaforge.app/arc-raiders/database/items/page/1`.
- After fixing stale batch-scrape cache mapping, semantic chunking now wins the benchmark with `recall@3` of `9/10`, ahead of overlapping at `8/10` and fixed at `7/10`.
- The ingest summary exposes cache store, hit count, and miss count so refresh behavior is visible in the UI.

### Objective 4: RAG Pipeline

Description: A first-pass ARC Raiders RAG experience built directly on the Objective 3 retrieval stack.

Key details:

- Live route: `/rag`
- API route: `/api/rag`
- The route reuses the Objective 3 semantic search path, persists the same chunk corpus for BM25, and adds a selectable hybrid retrieval path.
- Hybrid retrieval uses `wink-bm25-text-search` plus reciprocal rank fusion over the same Objective 3 chunks.
- The reranked mode uses Cohere reranking through the Vercel AI Gateway before answer generation.
- The UI shows the streamed answer alongside retrieved chunks, scores, per-stage rank signals, source links, and a same-query comparison panel.
- The current scope is intentionally narrow: gear, ammo, material, and inventory lookup with visible citation backing.
- The measurement endpoint compares vector-only, hybrid, and hybrid-plus-rerank retrieval on the same built-in query set.

### Objective 5: Evaluation and Quality Judgment

Description: A measurement layer for the ARC Raiders RAG stack that runs a labeled evaluation dataset through each retrieval variant and scores both retrieval quality and answer quality.

Key details:

- Live route: `/evaluation`
- API route: `/api/evaluation`
- Uses a repo-owned ARC Raiders v1 evaluation dataset instead of ad hoc manual testing.
- Runs the same three retrieval variants as the RAG demo: vector-only, hybrid, and hybrid-plus-rerank.
- Splits scoring into deterministic retrieval metrics and LLM-judged generation metrics.
- Retrieval scoring currently includes recall, mean reciprocal rank, source-type coverage, and entity coverage over the expected evidence targets.
- Generation scoring includes a source-line compliance check plus judge-based correctness, relevance, and hallucination-risk scores.
- Each run is logged to Braintrust as an experiment with variant metadata so the results are traceable outside the UI.
- The page includes a summary comparison table, per-variant scorecards, and weakest-case review panels for quick analysis.

### Objective 6: Single Agent and Long-Term Memory

Description: A sports news assistant that uses a ReAct-style loop to search, reason, call tools, and remember user facts across sessions.

Key details:

- Live route: `/agent`
- API route: `/api/agent`
- Uses `ToolLoopAgent` plus streamed UI output.
- Tool set includes `web_search`, `get_current_date`, `calculate_stats`, `remember`, `recall`, and `list_memories`.
- Supports multi-step tasks such as finding current standings and then calculating derived stats.
- Tool calls are rendered inline so the user can see what the agent actually did before it answers.
- Long-term memory is stored in Upstash Redis with a 30-day TTL.
- One notable implementation choice: the built-in `gateway.tools.perplexitySearch()` path was not reliable enough for the final assistant-text step in this SDK version, so the shipped agent uses a custom execute-based `web_search` tool instead.

### Objective 7: Multi-Agent Orchestration

Description: A multi-agent workflow that researches a chosen topic on X, runs a verification checkpoint, and renders a structured report with citations.

Key details:

- Live route: `/multi-agent`
- API route: `/api/multi-agent`
- Uses `ToolLoopAgent` for all four roles: planner, research worker, verification worker, and report writer.
- The planner enforces a fixed flow of research, verification, and then report generation.
- The research worker uses xAI's Responses API with `x_search` and `web_search` tools to gather recent posts and supporting context.
- The verification step is intentionally lightweight in this MVP: it blocks thin packets, but it does not yet perform full link reachability checks.
- The final report includes an executive summary, theme breakdowns, supporting data, and citations for UI rendering.

### Objective 8: Failure Pattern Recognition

Description: A live comparison lab that runs the same refund-assistant scenario before and after remediation for six common agent failure patterns.

Key details:

- Live route: `/failure-patterns`
- API route: `/api/failure-patterns`
- Covers six selectable scenarios: context degradation, specification drift, sycophantic confirmation, tool-selection errors, cascading failure, and silent failure.
- Keeps one shared business domain across all scenarios: DaveCanCode Returns Desk for refunds, returns, replacements, and shipping exceptions.
- One request runs both the broken and remediated variants so the user can compare the outputs side by side.
- Most scenarios use a shared refund-assistant `ToolLoopAgent` plus deterministic local tools.
- The cascading-failure scenario uses packet handoff plus verification and retry logic so the failure chain is directly inspectable.
- The UI shows assistant output, evidence trace, and a deterministic evaluation verdict for each run.

### Objective 10: Guardrails and Trust Design

Description: A protected email assistant demo that combines input and output guardrails with a human approval checkpoint before a simulated high-risk action.

Key details:

- Live route: `/guardrails`
- API route: `/api/guardrails`
- The packet-driven demo covers three outcomes: safe pass, input blocked, and output blocked.
- Input guardrails combine a binary model check for jailbreak or prompt-injection risk with deterministic secret and high-risk PII pattern detection.
- Output guardrails validate email draft structure and run a safety and appropriateness check, including a block on explicitly demeaning or humiliating tone requests.
- The high-risk action is modeled as a `send_protected_email` tool call that requires explicit approval before execution.
- The send step is simulated only and never delivers a real email.

### Objective 11: Observability and Tracing

Description: Braintrust tracing plus a lightweight cost dashboard.

Key details:

- Live route: `/observability`
- `wrapAISDK()` is used for AI SDK traces.
- `wrapAgentClass()` is used so `ToolLoopAgent` flows show up as traced agent executions.
- The page queries Braintrust on the server and surfaces total estimated cost, average latency, total tokens, and average cost per query.
- Time windows are switchable between 1, 7, and 14 days.
- The main sections are daily cost trend, model breakdown, and recent traced queries.

### Objective 12: Token Economics

Description: A calculator and routing lab that makes model pricing visible and shows cost-aware model selection.

Key details:

- Live route: `/token-economics`
- API route: `/api/token-economics`
- Users can select multiple models, estimate scenario cost, and compare pricing across providers.
- The routing lab runs a visible two-step flow: router agent first, fulfillment agent second.
- The current fulfillment pair is intentionally fixed for the demo: `openai/gpt-4o-mini` for simpler work and `openai/gpt-5-mini` for more complex work.
- The summary card shows the chosen model, complexity classification, estimated token counts, estimated routed cost, alternate-model cost, and the delta.

### Objective 14: MCP Integration

Description: A hosted HTTP MCP server wraps the Chuck Norris API, and a server-side agent route acts as the MCP client that discovers tools at runtime.

Key details:

- Live route: `/mcp`
- MCP server route: `/api/mcp`
- Discovery route: `/api/mcp-tools`
- Agent route: `/api/mcp-agent`
- The MCP server exposes `list_categories`, `get_random_joke`, and `search_jokes`.
- The agent does not hardcode local equivalents. It connects to the MCP server with `@ai-sdk/mcp`, fetches the tool list dynamically, and passes the discovered tools into `ToolLoopAgent` for the current request.
- The UI renders discovered tool names and tool call cards so the MCP layer stays visible instead of disappearing behind a generic wrapper.
- Request path: UI -> agent route -> MCP client -> MCP server -> Chuck Norris API.

## Planned Work After The Current Slice

The next major sequence is intentionally connected rather than random feature work:

- Objective 4 builds the full RAG pipeline on top of the current ARC Raiders retrieval substrate.
- Objective 9 generalizes the same retrieval system into a multi-source context architecture.
- Objective 13 tests whether fine-tuning helps a narrow change-extraction task more than prompt or retrieval tuning alone.

That continuity matters. The retrieval, schema, chunking, and evaluation work is being built so each later objective can reuse earlier infrastructure instead of resetting the stack every time.

## Good Files To Read Next

- `lib/ai.ts` for the shared AI runtime wrapper.
- `lib/demo-items.ts` for the objective-to-route map used on the landing page.
- `lib/embeddings/` for ingestion, normalization, chunking, and semantic search.
- `app/api/` for the actual route surfaces behind each demo.
- `../../docs/arc-raiders-embeddings-vector-search-report.md` for the detailed write-up behind the embeddings benchmark.