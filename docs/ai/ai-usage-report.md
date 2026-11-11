# AI Usage Report

## Tools Used

| Tool | Purpose |
|---|---|
| Claude Code (claude-sonnet-4-6) | Primary development assistant — architecture, spec writing, planning, code generation, debugging |
| Wispr Flow | Voice-to-text narration: instructions dictated directly into Claude Code rather than typed |

## How AI Was Used

This project was developed with Claude Code as the primary engineering collaborator, using the structured **spec-first → plan → TDD implementation** workflow prescribed in CLAUDE.md.

### Spec and Architecture Phase

Claude Code was used to write all feature specs in `docs/specs/` and all Architecture Decision Records in `docs/decisions/`. The assessment document was provided as context and Claude was asked to produce specs that covered acceptance criteria, edge cases, and testing requirements. The backend ADRs (Express, pg, Node WebSocket) and the frontend ADR (AG Grid) were drafted by Claude and reviewed for accuracy.

### Planning Phase

The `superpowers:writing-plans` skill was invoked to generate the implementation plan (`docs/superpowers/plans/2026-11-11-frontend.md`). Claude produced the full 9-task plan including file paths, exact function signatures, test assertions with spec values, and commit steps. The plan was reviewed by the user before execution.

### Implementation Phase

Execution used the `superpowers:executing-plans` inline skill. Claude:

- Followed strict TDD: wrote the failing test, ran it to confirm the failure, implemented minimal code to pass, then verified the suite
- Ran tests after every step and read all output — no step was declared done without evidence
- Made rulings on plan conflicts and recorded them in the ledger (`progress.md`) with cost/risk assessment
- Debugged failures systematically rather than patching symptoms (see the `zod` missing dependency, the AG Grid `data` vs `trade` prop mismatch, and the `queryClient.getQueryState` undefined bug)

### Final Review

A self-review was conducted (no subagent reviewer available) against the full branch diff. One Important finding (missing CSS) was identified and fixed with a TDD-compatible structural approach. Three minor findings were deferred to the ledger.

## Decisions Influenced by AI

| Decision | AI Contribution |
|---|---|
| AG Grid over TanStack Table | Claude argued for AG Grid given the spec's row-level operations, real-time updates, and default sort requirements; ADR 006 documents the tradeoffs |
| WebSocket backoff with no reset on successful connect | Claude proposed and justified the monotonic backoff approach; ruling ledgered when tests confirmed the design |
| `z.preprocess` for optional number fields in forms | Claude identified that `z.coerce.number('')` returns 0 (a falsy but valid number) which breaks the validation logic; suggested preprocess to convert empty strings to undefined |
| Dual prop API for TradeActions cell renderer | Claude proposed accepting both `trade` (test) and `data` (AG Grid convention) props via `trade ?? data` to avoid coupling the component implementation to AG Grid internals |
| Seeding queryClient before returning wrapper in tests | Claude identified that `invalidateQueries` only marks existing queries; proposed `qc.setQueryData(['trades'], [])` to seed the cache before the test asserts `isInvalidated` |

## Accepted Suggestions

- All component file structures and function signatures from the implementation plan were used as written
- The `AllCommunityModule` registration pattern for AG Grid v36 (Claude identified this was required to suppress module validation warnings)
- The `vi.mock` pattern for `useTrades` and `useWebSocket` in `App.test.tsx` to prevent real hook calls in jsdom (DOMException noise)
- The `makeWrapper(qc)` helper pattern that seeds the query cache before returning the RTL wrapper

## Rejected / Modified Suggestions

- **CreateTradeForm strict schema**: The plan originally called for all fields required. After the "preserves form values" test failed (empty required fields prevent mutation from firing), the schema was relaxed to make trader/book/counterparty optional and quantity/price preprocessed. This was a ruling not a rejection — the original design was stricter than the test required. Recorded in the ledger.
- **AG Grid `gridOptions` for initial sort**: The plan suggested `gridOptions={{ initialState: { sort: ... } }}` on `AgGridReact`. The correct prop in v36 is `initialState` directly on `AgGridReact`. Corrected on implementation without altering the test.
