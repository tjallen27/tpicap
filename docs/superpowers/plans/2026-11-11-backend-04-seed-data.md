# Backend: Seed Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the seed data generator that produces exactly 100 realistic trades and an idempotent `seedIfEmpty()` function that inserts them only when the collection is empty.

**Architecture:** `generateSeedTrades()` creates 100 trades with sequential IDs from `TRD-100001` to `TRD-100100`, timestamps distributed across the last 8 hours, ~20% `CANCELLED` and ~80% `ACTIVE` status, and execution prices within ±4% of base price using the Global Constraints formula. `seedIfEmpty()` counts documents and calls `insertMany` only when the count is zero. A local copy of `BASE_PRICES` is defined in `seed.ts` for now; Task 10 will extract it and update the import.

**Tech Stack:** MongoDB Node.js driver, @tpicap/shared, Vitest, mongodb-memory-server

**Specs:**
- `docs/specs/data-model.md`

**Dependencies:**
- `2026-11-11-backend-03-trade-db-queries.md` (provides `getDb()` and the `insertTrade` function; test infrastructure already established)

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

### Task 4: Seed Data

**Files:**
- Create: `backend/src/seed/seed.ts`
- Create: `database/README.md` (brief note on seed strategy)
- Test: `backend/tests/seed/seed.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `Trade` from `@tpicap/shared`, `BASE_PRICES` (not yet built — define a local copy in `seed.ts` for now; Task 10 will extract it to `symbolPool.ts` and seed.ts will import from there)
- Produces:
  - `generateSeedTrades(): Trade[]` — returns exactly 100 trades
  - `seedIfEmpty(): Promise<void>` — inserts seed trades only when `trades` collection is empty

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/seed/seed.test.ts
  it('generateSeedTrades returns exactly 100 trades', () => {
    expect(generateSeedTrades()).toHaveLength(100)
  })
  it('all generated trades pass TradeSchema validation', () => {
    generateSeedTrades().forEach(t => expect(TradeSchema.safeParse(t).success).toBe(true))
  })
  it('each trade id is unique', () => {
    const ids = generateSeedTrades().map(t => t.id)
    expect(new Set(ids).size).toBe(100)
  })
  it('execution prices are within ±4% of base price', () => {
    const trades = generateSeedTrades()
    trades.forEach(t => {
      const base = BASE_PRICES[t.symbol]
      expect(t.price).toBeGreaterThanOrEqual(parseFloat((base * 0.96).toFixed(2)))
      expect(t.price).toBeLessThanOrEqual(parseFloat((base * 1.04).toFixed(2)))
    })
  })
  it('seedIfEmpty inserts 100 trades when collection is empty', async () => {
    await seedIfEmpty()
    const count = await getTestDb().collection('trades').countDocuments()
    expect(count).toBe(100)
  })
  it('seedIfEmpty does not insert if trades already exist', async () => {
    await seedIfEmpty(); await seedIfEmpty()
    const count = await getTestDb().collection('trades').countDocuments()
    expect(count).toBe(100)
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/seed/seed.test.ts`
  Expected: FAIL — `generateSeedTrades is not defined`

- [ ] **Step 3: Implement `generateSeedTrades()` in `backend/src/seed/seed.ts`**

  Define local `BASE_PRICES` (same 10 symbols as spec). Pools: traders `['JSMITH','ABROWN','MJONES','KDAVIS','LWILSON']`, books `['EQUITIES_UK','EQUITIES_US','TECH_GROWTH','FIXED_INCOME','FX_DESK']`, counterparties `['Goldman Sachs','JP Morgan','Morgan Stanley','Barclays','Deutsche Bank']`. Generate 100 trades: IDs `TRD-100001` through `TRD-100100`; timestamps distributed across the last 8 hours; ~20% `CANCELLED`, ~80% `ACTIVE`; execution price using the Global Constraints formula.

- [ ] **Step 4: Implement `seedIfEmpty()` in `backend/src/seed/seed.ts`**

  Count documents in `trades` collection; if 0, call `generateSeedTrades()` and `insertMany`.

- [ ] **Step 5: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/seed/seed.test.ts`
  Expected: PASS — all 6 tests

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/seed/ backend/tests/seed/ database/
  git commit -m "feat: add seed data generator — 100 realistic trades seeded on first run"
  ```
