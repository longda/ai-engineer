# ai-engineer

`ai-engineer` is a working portfolio repo about building AI products with specifications, schema validation, retrieval pipelines, tool use, guardrails, observability, and cost controls.

If you are technical, this repo is a TypeScript and Next.js skills lab that demonstrates how I think about LLM systems as software systems. 

If you are not technical, the short version is this: each demo is designed to show that I can make AI features more reliable, measurable, and easier to ship in a real product.

## What The Project Covers

AI engineering spans multiple disciplines. This repo is organized to show how those disciplines fit together in one product stack.

| Capability | Technical focus | Why it matters |
| --- | --- | --- |
| Specification precision | Prompt contracts, constraints, schemas, and typed outputs | Makes model behavior easier to validate and integrate into software. |
| Prompt patterns | Zero-shot, few-shot, and chain-of-thought comparisons | Shows how prompt strategy changes answer quality and failure modes. |
| Retrieval and vector search | Chunking, embeddings, metadata, and semantic search | Grounds outputs in source material instead of unsupported guesses. |
| Agents | Tool use, memory, planning, and verification | Enables multi-step task execution with traceable control flow. |
| Guardrails | Input screening, output validation, and approval flows | Reduces safety, trust, and operational risk. |
| Observability and token economics | Tracing, latency, usage, and model routing | Makes runtime quality and cost measurable. |
| MCP | Tool discovery and integration | Standardizes how agents connect to external tools. |

The repo is broad by design. The demos follow the AI development lifecycle: specify behavior, compare prompting strategies, build retrieval, add agents, harden them, measure them, and package the system clearly.

## Objective Scope

| Objective | Area | Scope |
| --- | --- | --- |
| 1 | Specification precision | System prompt library, schema-driven structured output, and a dedicated demo route for typed model responses. |
| 2 | Prompt engineering patterns | Side-by-side comparison of zero-shot, few-shot, and chain-of-thought prompting on the same task. |
| 3 | Embeddings and vector search | ARC Raiders ingest, normalization, chunking, embedding, indexing, chunking evaluation, and semantic search with citations. |
| 4 | RAG pipeline | Streamed answer generation over the ARC Raiders corpus, starting with vector retrieval and expanding to hybrid search and reranking. |
| 5 | Evaluation | Golden dataset, retrieval metrics, LLM-as-a-judge scoring, and Braintrust experiment tracking for the RAG stack. |
| 6 | Single agent | A ReAct-style sports agent with tools, multi-step execution, and long-term memory. |
| 7 | Multi-agent | Planner, research, verification, and report-writing agents operating as a coordinated workflow. |
| 8 | Failure patterns | Six common agent failure modes paired with remediations and side-by-side demonstrations. |
| 9 | Context architecture | Multi-source retrieval with source-aware metadata filters, entity and date filtering, and context-packing controls. |
| 10 | Guardrails | Input screening, output validation, and human approval for higher-risk actions. |
| 11 | Observability | Braintrust tracing plus a dashboard for latency, token usage, and estimated cost. |
| 12 | Token economics | Model cost calculator and cost-aware routing between cheaper and more capable models. |
| 13 | Fine-tuning | A focused GPT-4o-mini fine-tuning experiment for patch-note change extraction, evaluated against base and retrieval-assisted baselines. |
| 14 | MCP | Hosted HTTP MCP server and an agent client that discovers tools dynamically at runtime. |
| 15 | Deploy and ship | Portfolio packaging, demo polish, public deployment, and the broader project narrative. |

Objectives 3, 4, 5, 9, and 13 are designed as one continuous retrieval program. Objective 3 establishes the data and indexing layer, Objective 4 adds answer generation, Objective 5 adds measurement, Objective 9 expands the retrieval model across source types, and Objective 13 reuses the same corpus for a narrow fine-tuning experiment.

## Retrieval Track

The ARC Raiders retrieval work is the clearest example of how the repo is structured.

Objective 3 establishes the retrieval foundation for Objectives 4, 5, 9, and 13. Its scope includes approved source selection, Firecrawl ingest, normalization rules, chunk metadata, artifact caching in Redis, semantic search over Upstash Vector, and a benchmark for chunking strategy. The same document and chunk schema is intended to carry forward into the RAG app, eval harness, and context-architecture work.

On the approved Metaforge item catalog benchmark, semantic chunking produced the strongest result: `recall@3` of `9/10`, compared with `8/10` for overlapping chunking and `7/10` for fixed chunking. That result established semantic chunking as the default strategy for the current retrieval stack.

## Who This Repo Is For

- Hiring managers and recruiters who want a fast way to understand what kind of AI engineering work I can do.
- Engineering leads who care about implementation quality, tradeoff awareness, and production-minded design.
- Other AI engineers who want to see how the demos are wired and how the repo is organized.
- Curious non-specialists who want a more concrete picture of what the role actually involves beyond prompt writing.

## Quick Start

This is a pnpm + Turborepo monorepo. The main app lives in `apps/web`.

Requirements:

- Node 22+
- pnpm 9+

Run it locally:

```bash
pnpm install
cp apps/web/.sample.env apps/web/.env.local
pnpm dev
```

Useful follow-up commands:

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web check-types
pnpm --filter web lint
```

## Repo Map

| Path | What it is |
| --- | --- |
| `apps/web` | The main interactive Next.js app with the live demos. |
| `apps/docs` | A secondary docs app scaffold reserved for future docs-specific work. |
| `docs` | Working plans, reports, and longer write-ups that explain design decisions. |
| `packages/ui` | Shared UI components used across the monorepo. |
| `packages/eslint-config` | Shared lint configuration. |
| `packages/typescript-config` | Shared TypeScript configuration. |

## Read This Next

 [apps/web/README.md](apps/web/README.md) for the app-specific guide, live route inventory, environment variables, and implementation notes.


## Current Development Priorities

The repository already covers prompt design, retrieval basics, agents, guardrails, MCP, tracing, and cost-aware runtime decisions. The next major delivery is the retrieval-to-RAG-to-evaluation sequence, built on top of the existing ARC Raiders retrieval foundation.

The remaining work is focused on completing that connected stack and extending it into context architecture and a narrow fine-tuning comparison.