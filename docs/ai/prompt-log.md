# Prompt Log

A representative sample of significant prompts used during development and their outcomes.

> Not exhaustive — enough to show how AI contributed to the work.

---

## Setting up CLAUDE.md and the documentation structure

**Prompt (via Wispr Flow):**

> "Let's write the CLAUDE.md file. Start with a summary of the project and how the assessment is graded, taken directly from the assessment file. Then a brief stating the assessment is the source of truth for features and decisions. Then document layout: specs with one file per feature in isolation, decisions as ADRs, and an AI directory with an AI usage report and a prompt log. For the AI usage report, note that I'm currently using Wispr Flow to narrate directly into Claude Code."

**Outcome:**
Claude produced `CLAUDE.md` covering the project summary, assessment grading breakdown (engineering quality 30%, TypeScript 20%, full-stack design 20%, UX 10%, testing 10%, communication 10%), documentation layout (`docs/specs/`, `docs/decisions/`, `docs/ai/`), and the stub AI docs. The spec-first workflow and dependency validation rules were added in a later prompt (see below).

---

## Writing the ADRs

**Prompt (via Wispr Flow):**

> "The first decision document: we're using Vite instead of Next.js. Even though Next.js is the recommended default React framework, none of this application is going to be server-rendered — it's all client-side. Rather than having to mark everything as a client component, we'll use Vite."

**Outcome:** ADR 001 written — Vite over Next.js.

**Prompt (via Wispr Flow):**

> "Next decision: we're using MongoDB, but instead of Mongoose for validation we're using Zod. We have a shared directory where all schemas and types live so they work across the backend and frontend. Because Vite doesn't have API routes like Next.js does, we'll have a separate backend service."

**Outcome:** ADR 002 written — MongoDB with Zod schemas over Mongoose, shared package approach.

**Prompt (via Wispr Flow):**

> "Next decision is on data fetching. We're using TanStack Query with WebSockets. When a WebSocket event arrives, the blotter should reflect the change. We can either invalidate the query to trigger a fresh GET, or update the cache directly with setQueryData."

**Outcome:** ADR 003 written — TanStack Query + WebSockets, with `setQueryData` chosen over `invalidateQueries` for real-time cache updates to avoid unnecessary round-trips.

---

## Writing the CRUD and data model specs

**Prompt (via Wispr Flow):**

> "Write a spec for the data model. The assessment file has the schema. Then write specs for the three mutation requests: creating a trade, cancelling a trade, and amending a trade. For each, cover how the request is made, where error boundaries come in, how we handle those errors, and what the tests will include."

**Outcome:** Four specs produced — `data-model.md`, `create-trade.md`, `cancel-trade.md`, `amend-trade.md` — each covering requirements, request/response shape, validation, error handling (including 409 conflict), and testing requirements.

---

## Adding the workflow section to CLAUDE.md

**Prompt (via Wispr Flow):**

> "Add a workflow section to CLAUDE.md. This project is spec-first: for any feature, write a detailed spec covering requirements, functionality, acceptance criteria, testing, expected outcomes, and any dependencies and blockers. Then plan using the Claude Code superpowers. Never weaken tests to make them pass, and validate all dependencies before introducing them — name the dependency, the package, and the reason. Add a Commands section for how the project is run."

**Outcome:** Workflow section and Commands stub added to `CLAUDE.md`. The "never weaken a test" rule and dependency validation table format were written verbatim and later enforced during TDD implementation.

---

## Writing the live updates spec

**Prompt (via Wispr Flow):**

> "Write a feature spec for live updates: making the WebSocket requests, watching for events, sending error messages. Make sure there's a fallback rendered if no data has come through from the API."

**Outcome:** `live-updates.md` written — covering WebSocket connection lifecycle, event types (`trade:created`, `trade:amended`, `trade:cancelled`, `price:updated`), exponential backoff reconnect strategy, connection status indicator states, and fallback UI for loading, error, and empty states.

---

## Writing the blotter table spec

**Prompt (via Wispr Flow):**

> "Now we have the CRUD, live updates, and data model specs. Write a spec for the actual table: the headers, the calls to action in the table, filtering, and sorting as per the assessment. I want a generic quick search at the top. Sorting on columns — numeric columns ascending and descending, string columns alphabetically and reverse alphabetically."

**Outcome:** `trade-blotter-table.md` written — 12 columns defined with types and sort behaviour, row visual treatment (BUY/SELL colour coding, CANCELLED opacity, P&L colour), Actions column visibility rules, quick search across key string fields, and a data-fetching spec for the P&L column extracted into a separate `data-fetching.md` file.

---

## Validating specs against the assessment

**Prompt (via Wispr Flow):**

> "Loop through the specs and validate against the assessment. See if there is anything missing that is required for the application."

**Outcome:** Claude cross-referenced all seven specs against the assessment requirements and confirmed full coverage. No gaps were found. The review also confirmed that the `data-fetching.md` spec correctly captured the P&L calculation requirement from the assessment (live price feed from an external source).

**Prompt (via Wispr Flow):**

> "Is there anything you are unsure about for that plan?"

**Outcome:** Claude flagged one ambiguity — the assessment mentions Docker as optional but doesn't specify whether a Finnhub API key would be provided during assessment review. This was resolved by implementing a price simulator as a fallback, documented in ADR 004.
