# Backend: Trade DB Queries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all MongoDB query functions for the trades collection: find all, find by ID, insert, patch, and atomic cancel.

**Architecture:** All five functions in `backend/src/db/trades.ts` call `getDb().collection<Trade>('trades')`. All reads use `projection: { _id: 0 }` to strip the MongoDB document ID from results. `setTradeCancelled` uses `findOneAndUpdate` with a compound filter `{ id, status: 'ACTIVE' }` to make the status check and update atomic. Tests run against `mongodb-memory-server` via the shared setup in `backend/tests/setup.ts`.

**Tech Stack:** MongoDB Node.js driver, Vitest, mongodb-memory-server, @tpicap/shared

**Specs:**
- `docs/specs/data-model.md`
- `docs/specs/cancel-trade.md`
- `docs/specs/amend-trade.md`

**Dependencies:**
- `2026-11-11-backend-02-backend-scaffold.md` (provides `getDb()`, `connectDb()`, and test setup infrastructure)

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

### Task 3: Trade DB Queries

**Files:**
- Create: `backend/src/db/trades.ts`
- Test: `backend/tests/db/trades.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `db/client.ts`; `Trade`, `AmendTradeInput` from `@tpicap/shared`
- Produces:
  - `findAllTrades(): Promise<Trade[]>` — sorted by `tradeTimestamp` descending
  - `findTradeById(id: string): Promise<Trade | null>`
  - `insertTrade(trade: Trade): Promise<void>`
  - `patchTrade(id: string, fields: AmendTradeInput): Promise<Trade | null>`
  - `setTradeCancelled(id: string): Promise<Trade | null>` — atomic; filters on `{ id, status: 'ACTIVE' }`; returns `null` if no document matched

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/db/trades.test.ts
  const t1: Trade = { id: 'TRD-100001', symbol: 'AAPL', side: 'BUY', quantity: 100,
    price: 227.45, trader: 'JSMITH', book: 'EQUITIES_UK', counterparty: 'Goldman Sachs',
    tradeTimestamp: '2026-11-10T09:00:00.000Z', status: 'ACTIVE' }
  const t2: Trade = { ...t1, id: 'TRD-100002', tradeTimestamp: '2026-11-10T10:00:00.000Z' }

  beforeEach(async () => { await getTestDb().collection('trades').deleteMany({}) })

  it('findAllTrades returns empty array when collection is empty', async () => {
    expect(await findAllTrades()).toEqual([])
  })
  it('findAllTrades returns trades sorted by tradeTimestamp descending', async () => {
    await insertTrade(t1); await insertTrade(t2)
    const result = await findAllTrades()
    expect(result[0].id).toBe('TRD-100002')
    expect(result[1].id).toBe('TRD-100001')
  })
  it('findTradeById returns null for unknown id', async () => {
    expect(await findTradeById('TRD-999999')).toBeNull()
  })
  it('findTradeById returns the trade by id', async () => {
    await insertTrade(t1)
    const result = await findTradeById('TRD-100001')
    expect(result?.id).toBe('TRD-100001')
    expect(result).not.toHaveProperty('_id')
  })
  it('patchTrade updates specified fields and returns updated trade', async () => {
    await insertTrade(t1)
    const result = await patchTrade('TRD-100001', { quantity: 500 })
    expect(result?.quantity).toBe(500)
    expect(result?.price).toBe(227.45) // unchanged
  })
  it('patchTrade returns null for unknown id', async () => {
    expect(await patchTrade('TRD-999999', { quantity: 1 })).toBeNull()
  })
  it('setTradeCancelled sets status to CANCELLED and returns updated trade', async () => {
    await insertTrade(t1)
    const result = await setTradeCancelled('TRD-100001')
    expect(result?.status).toBe('CANCELLED')
  })
  it('setTradeCancelled returns null if trade is already CANCELLED', async () => {
    await insertTrade({ ...t1, status: 'CANCELLED' })
    expect(await setTradeCancelled('TRD-100001')).toBeNull()
  })
  it('setTradeCancelled returns null for unknown id', async () => {
    expect(await setTradeCancelled('TRD-999999')).toBeNull()
  })
  it('findAllTrades result documents do not contain _id', async () => {
    await insertTrade(t1)
    const result = await findAllTrades()
    expect(result[0]).not.toHaveProperty('_id')
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/db/trades.test.ts`
  Expected: FAIL — `findAllTrades is not defined`

- [ ] **Step 3: Implement `backend/src/db/trades.ts`**

  All functions call `getDb().collection<Trade>('trades')`. Use `projection: { _id: 0 }` on all reads. `findAllTrades` uses `.find({}, { projection: { _id: 0 } }).sort({ tradeTimestamp: -1 }).toArray()`. `setTradeCancelled` uses `findOneAndUpdate({ id, status: 'ACTIVE' }, { $set: { status: 'CANCELLED' } }, { returnDocument: 'after', projection: { _id: 0 } })`.

- [ ] **Step 4: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/db/trades.test.ts`
  Expected: PASS — all 10 tests

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/db/trades.ts backend/tests/db/trades.test.ts
  git commit -m "feat: add trade DB query functions with mongodb-memory-server tests"
  ```
