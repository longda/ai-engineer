# AI Engineer Web App

This app is the interactive Next.js surface for the ai-engineer portfolio repo. It currently ships the live demos for prompt-pattern comparison and a tool-using sports agent with persistent memory.

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
| `AI_GATEWAY_API_KEY` | Authenticates model calls sent through the Vercel AI Gateway. Required for the prompt-pattern demo, the sports agent, and the multi-agent planner/report/verification steps. | Create an API key in the Vercel AI Gateway dashboard.
| `BRAINTRUST_API_KEY` | Enables Braintrust tracing for AI SDK calls and agent runs. | Create an API key in the Braintrust dashboard.
| `UPSTASH_REDIS_REST_URL` | Points the agent memory layer at your Upstash Redis REST endpoint. | Create an Upstash Redis database and copy the REST URL from its details page.
| `UPSTASH_REDIS_REST_TOKEN` | Authenticates requests to the Upstash Redis REST API. | Copy the REST token from the same Upstash Redis database settings page.
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

### Objective 11.1: Braintrust Tracing

Description: Tracing is wired into both prompt-based and agent-based AI flows.

Key details:

- `wrapAISDK()` is used for AI SDK function tracing.
- `wrapAgentClass()` is used so `ToolLoopAgent` runs are traced as agent executions.
- The prompt-pattern route and the sports-agent stack both send traces when `BRAINTRUST_API_KEY` is configured.
- This is the current observability foundation for later cost and quality instrumentation work.

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
