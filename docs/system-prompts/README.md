# System Prompt Library

Versioned system prompts for Objective 1: Specification Precision.

- Current version set: `v1`
- Live demo route: `/specification-precision`
- Each prompt file documents the role, constraints, output schema, edge cases, and escalation rules for a prompt in this library.
- The app's machine-literal runtime system prompts are currently sourced from the `systemPrompt` entries in `apps/web/lib/specification/catalog.ts`; the markdown files in this directory are linked reference documents via `libraryPath`.

Included prompts:

- `mcp-tool-selection-referee`
- `memory-distiller`
- `context-pack-assembler`
- `retrieval-query-architect`
- `prompt-injection-screener`
- `cost-aware-model-router`