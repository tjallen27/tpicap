# CLAUDE.md — tpicap-blotter

## Project Summary

This is a full-stack trade blotter application built as a take-home engineering assessment. It allows users to view and manage equity trades in real time, simulating a simplified broker-side blotter used by traders and sales teams throughout the trading day.

The application consists of:

- A **React + TypeScript** frontend
- A **TypeScript** backend API
- A **database** for trade persistence
- **Real-time updates** pushed to all connected clients
- Local execution via Docker or simple setup instructions
- **Finnhub** as the external data source for fetching trade/market data

## Assessment Grading

| Category | Weight | Focus Areas |
|---|---|---|
| Engineering Quality | 30% | Code quality, project structure, maintainability |
| TypeScript Usage | 20% | Type safety, domain modelling, API contracts |
| Full Stack Design | 20% | Frontend/backend interaction, database design, API design |
| User Experience | 10% | Usability, responsiveness, error handling |
| Testing | 10% | Unit and integration testing, sensible coverage |
| Communication | 10% | README quality, AI usage report, explanation of decisions |

---

## Brief

**The assessment document is the source of truth** for all features and implementation decisions in this project.

See: [`docs/assessment/assessment.md`](docs/assessment/assessment.md)

Any feature built, any technology chosen, and any trade-off accepted should be traceable back to the requirements or explicitly justified in a decision record. When the assessment is silent on an implementation detail, use good engineering judgement and document the rationale in a decision record.

---

## Documentation Layout

```
docs/
├── assessment/
│   └── assessment.md          # The original brief — source of truth
├── specs/
│   └── <feature>.md           # One file per feature, written in isolation
├── decisions/
│   └── <slug>.md              # Architecture Decision Records (ADRs)
└── ai/
    ├── ai-usage-report.md     # How AI was used throughout the project
    └── prompt-log.md          # Representative sample of significant prompts
```

### `docs/specs/`

Each feature has its own spec file. Features are described in isolation — no grouping. A spec covers the user-facing behaviour, acceptance criteria, edge cases, and any constraints relevant to that feature alone.

### `docs/decisions/`

Architecture Decision Records. Each file captures a single decision: the context, the options considered, the choice made, and the reasoning. Use these to explain *why* a technology or approach was chosen over alternatives.

### `docs/ai/`

Two files required by the assessment:

- **`ai-usage-report.md`** — a summary of which AI tools were used, how they were used, and where AI suggestions were accepted or rejected.
- **`prompt-log.md`** — a representative sample of significant prompts and their outcomes. Not exhaustive; enough to show how AI contributed to the work.

> **Current AI tooling:** Wispr Flow is being used to narrate instructions directly into Claude Code. This will be elaborated on in `ai-usage-report.md` as the project progresses.

---

## Workflow

This project follows a **spec-first** approach. No feature is planned or built until its spec exists and is complete.

### 1. Write the Spec

Before any planning or implementation begins, create a spec in `docs/specs/<feature>.md`. Every spec must cover:

- **Requirements** — what the feature must do, stated precisely
- **Functionality** — how the feature behaves from the user's perspective
- **Acceptance Criteria** — explicit, testable conditions that define done
- **Testing** — what needs to be tested and at what level (unit, integration, e2e)
- **Expected Outcomes** — what a successful implementation looks like
- **Dependencies and Blockers** — any other features, services, or decisions this spec depends on or is blocked by

### 2. Plan

Once the spec is complete, use the Claude Code `superpowers:writing-plans` skill to produce an implementation plan. The plan is derived from the spec — not from assumptions or prior work.

### 3. Implement

Execute the plan. During implementation:

- **Never weaken a test to make it pass.** If a test is failing, fix the code. Adjusting assertions, skipping tests, or reducing coverage to achieve a green build is not acceptable.
- **All features must be tested.** Every piece of functionality defined in a spec must have corresponding tests. Untested features are incomplete features.
- **Validate dependencies before introducing them.** Before adding any package, confirm it is the right tool for the job. Document it as follows:

  | Field | Detail |
  |---|---|
  | Name | The dependency name as it will appear in `package.json` |
  | Package | The exact npm package identifier |
  | Reason | Why this package was chosen over alternatives |

  If a dependency requires an ADR (e.g. a significant infrastructure choice), create one in `docs/decisions/`.

---

## Commands

> To be populated once the project structure is established.

| Command | Description |
|---|---|
| — | — |
