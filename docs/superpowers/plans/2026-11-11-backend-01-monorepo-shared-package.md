# Backend: Monorepo + Shared Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the pnpm workspace monorepo and create the `@tpicap/shared` package containing all Zod schemas and inferred TypeScript types used by both backend and frontend.

**Architecture:** A `pnpm-workspace.yaml` at the repo root declares three packages: `shared`, `backend`, and `frontend`. The `shared` package exports `TradeSchema`, `CreateTradeSchema`, `AmendTradeSchema`, `PriceUpdateSchema`, and `PriceUpdateEventSchema` from a single `index.ts` entry point. All schemas are defined with Zod and all types are inferred with `z.infer<>`.

**Tech Stack:** pnpm workspaces, Zod, TypeScript, Vitest

**Specs:**
- `docs/specs/data-model.md`
- `docs/specs/data-fetching.md`

**Dependencies:** None — this is the first task.

## Global Constraints

- Trade ID format: `TRD-` followed by 6 digits (e.g. `TRD-100001`); seed trades are sequential from `TRD-100001`; user-created trades use `TRD-${Math.floor(100000 + Math.random() * 900000)}`
- `tradeTimestamp` is always UTC ISO 8601 (e.g. `2026-11-11T09:15:23.000Z`)
- `quantity` must be a positive integer; `price` must be a positive number; `symbol` is 1–10 chars
- Seed dataset: exactly 100 trades across the 10 symbols in `BASE_PRICES`
- Seed execution price formula: `parseFloat((basePrice * (1 + (Math.random() * 0.08 - 0.04))).toFixed(2))`
- Simulator drift formula per tick: `parseFloat((currentPrice + currentPrice * (Math.random() * 0.01 - 0.005)).toFixed(2))`; if result ≤ 0, discard drift and keep current price unchanged
- Price update interval: `3000` ms
- Immutable fields rejected on `PATCH /trades/:id`: `id`, `symbol`, `side`, `tradeTimestamp`, `status`
- `GET /trades` returns `{ trades: Trade[] }` sorted by `tradeTimestamp` descending
- `POST /trades` returns `201`; all `PATCH` endpoints return `200`
- Cancel: `404` if trade not found, `409` if already `CANCELLED`
- Amend: `404` if trade not found, `409` if trade is `CANCELLED`, `400` if immutable field present
- Validation errors return `{ error: "Validation failed", issues: ZodIssue[] }`
- Immutable field errors return `{ error: "Invalid fields", fields: string[] }`
- `FINNHUB_API_KEY` env var is optional; if absent, skip Finnhub and start simulator directly

## Review Focus

No unexercised failure modes identified for this task.

---

### Task 1: Monorepo + Shared Package

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root — workspaces field only, no scripts)
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/schemas/trade.ts`
- Create: `shared/src/schemas/price.ts`
- Create: `shared/src/index.ts`
- Test: `shared/tests/trade.test.ts`
- Test: `shared/tests/price.test.ts`

**Interfaces:**
- Produces:
  - `TradeSchema`, `CreateTradeSchema`, `AmendTradeSchema` — Zod schemas
  - `type Trade`, `type CreateTradeInput`, `type AmendTradeInput`
  - `PriceUpdateSchema`, `PriceUpdateEventSchema`
  - `type PriceUpdate`

- [ ] **Step 1: Scaffold pnpm workspace**

  Create `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'shared'
    - 'backend'
    - 'frontend'
  ```
  Create root `package.json` with `"private": true` and no scripts. Create `shared/package.json` with `name: "@tpicap/shared"`, `main: "src/index.ts"`, dependencies `zod`, devDependencies `typescript`, `vitest`. Create `shared/tsconfig.json` with `moduleResolution: bundler`, `target: ES2022`, `strict: true`.

- [ ] **Step 2: Write failing tests for TradeSchema**

  ```typescript
  // shared/tests/trade.test.ts
  const valid = {
    id: 'TRD-100001', symbol: 'AAPL', side: 'BUY', quantity: 100,
    price: 227.45, trader: 'JSMITH', book: 'EQUITIES_UK',
    counterparty: 'Goldman Sachs',
    tradeTimestamp: '2026-11-11T09:15:23.000Z', status: 'ACTIVE',
  }

  it('accepts a valid trade', () => expect(TradeSchema.safeParse(valid).success).toBe(true))
  it('rejects quantity 0', () => expect(TradeSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false))
  it('rejects negative price', () => expect(TradeSchema.safeParse({ ...valid, price: -1 }).success).toBe(false))
  it('rejects invalid side', () => expect(TradeSchema.safeParse({ ...valid, side: 'HOLD' }).success).toBe(false))
  it('rejects invalid status', () => expect(TradeSchema.safeParse({ ...valid, status: 'PENDING' }).success).toBe(false))
  it('rejects non-ISO timestamp', () => expect(TradeSchema.safeParse({ ...valid, tradeTimestamp: '2026-11-11' }).success).toBe(false))
  it('rejects empty symbol', () => expect(TradeSchema.safeParse({ ...valid, symbol: '' }).success).toBe(false))

  // CreateTradeSchema
  const { id, status, ...createInput } = valid
  it('accepts valid create input', () => expect(CreateTradeSchema.safeParse(createInput).success).toBe(true))
  it('rejects create with quantity 0', () => expect(CreateTradeSchema.safeParse({ ...createInput, quantity: 0 }).success).toBe(false))

  // AmendTradeSchema
  it('accepts empty object', () => expect(AmendTradeSchema.safeParse({}).success).toBe(true))
  it('accepts partial fields', () => expect(AmendTradeSchema.safeParse({ quantity: 500 }).success).toBe(true))
  it('rejects quantity 0', () => expect(AmendTradeSchema.safeParse({ quantity: 0 }).success).toBe(false))
  ```

- [ ] **Step 3: Run test to confirm failure**

  Run: `pnpm --filter @tpicap/shared test`
  Expected: FAIL — `TradeSchema is not defined`

- [ ] **Step 4: Implement `TradeSchema`, `CreateTradeSchema`, `AmendTradeSchema` in `shared/src/schemas/trade.ts`**

  `TradeSchema` is a `z.object` with fields per Global Constraints. `CreateTradeSchema = TradeSchema.omit({ id: true, status: true })`. `AmendTradeSchema = TradeSchema.pick({ quantity: true, price: true, trader: true, book: true, counterparty: true }).partial()`.

- [ ] **Step 5: Run test to confirm pass**

  Run: `pnpm --filter @tpicap/shared test`
  Expected: PASS all TradeSchema/CreateTradeSchema/AmendTradeSchema tests

- [ ] **Step 6: Write failing tests for PriceUpdateSchema**

  ```typescript
  // shared/tests/price.test.ts
  const valid = { symbol: 'AAPL', currentPrice: 227.45, timestamp: '2026-11-11T09:15:23.000Z' }
  it('accepts valid price update', () => expect(PriceUpdateSchema.safeParse(valid).success).toBe(true))
  it('rejects negative currentPrice', () => expect(PriceUpdateSchema.safeParse({ ...valid, currentPrice: -1 }).success).toBe(false))
  it('rejects zero currentPrice', () => expect(PriceUpdateSchema.safeParse({ ...valid, currentPrice: 0 }).success).toBe(false))
  it('accepts array of price updates', () => expect(PriceUpdateEventSchema.safeParse([valid, { ...valid, symbol: 'MSFT' }]).success).toBe(true))
  ```

- [ ] **Step 7: Run test to confirm failure**

  Run: `pnpm --filter @tpicap/shared test`
  Expected: FAIL — `PriceUpdateSchema is not defined`

- [ ] **Step 8: Implement `PriceUpdateSchema` and `PriceUpdateEventSchema` in `shared/src/schemas/price.ts`**

  `PriceUpdateSchema = z.object({ symbol: z.string(), currentPrice: z.number().positive(), timestamp: z.string().datetime() })`. `PriceUpdateEventSchema = z.array(PriceUpdateSchema)`.

- [ ] **Step 9: Export all from `shared/src/index.ts`**

  Re-export everything from `./schemas/trade` and `./schemas/price`.

- [ ] **Step 10: Run all shared tests**

  Run: `pnpm --filter @tpicap/shared test`
  Expected: PASS — all 15 tests

- [ ] **Step 11: Commit**

  ```bash
  git add shared/
  pnpm-workspace.yaml package.json
  git commit -m "feat: add shared package with trade and price Zod schemas"
  ```
