# Backend: GET /trades Endpoint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `GET /trades` route handler and the `registerTradeRoutes` function, returning all trades sorted by `tradeTimestamp` descending wrapped in `{ trades: Trade[] }`.

**Architecture:** `getTrades` calls `findAllTrades()` and sends the result under the `trades` key. `registerTradeRoutes(app)` attaches all trade routes to the Fastify instance; this task adds only `GET /trades` — subsequent tasks (7–9) will expand it. `buildTestApp()` in the test helper is updated to call `registerTradeRoutes` before returning the instance.

**Tech Stack:** Fastify, @tpicap/shared, Vitest, mongodb-memory-server

**Specs:**
- `docs/specs/data-model.md`
- `docs/specs/data-fetching.md`

**Dependencies:**
- `2026-11-11-backend-03-trade-db-queries.md` (provides `findAllTrades()`)
- `2026-11-11-backend-02-backend-scaffold.md` (provides `createApp()` and `buildTestApp()`)

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

### Task 5: GET /trades Endpoint

**Files:**
- Create: `backend/src/handlers/getTrades.ts`
- Create: `backend/src/routes/trades.ts`
- Test: `backend/tests/handlers/getTrades.test.ts`

**Interfaces:**
- Consumes: `findAllTrades()` from `db/trades.ts`; `createApp()` from `server.ts`; `buildTestApp()` from `tests/helpers.ts`
- Produces:
  - `getTrades(request: FastifyRequest, reply: FastifyReply): Promise<void>`
  - `registerTradeRoutes(app: FastifyInstance): void` — registers `GET /trades` for now; expanded in Tasks 7–9

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/handlers/getTrades.test.ts
  let app: FastifyInstance
  beforeAll(async () => { app = await buildTestApp() })
  beforeEach(async () => { await getTestDb().collection('trades').deleteMany({}) })

  it('GET /trades returns 200 with empty trades array', async () => {
    const res = await app.inject({ method: 'GET', url: '/trades' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ trades: [] })
  })
  it('GET /trades returns all trades sorted by tradeTimestamp descending', async () => {
    await insertTrade({ ...baseTrade, id: 'TRD-100001', tradeTimestamp: '2026-11-10T09:00:00.000Z' })
    await insertTrade({ ...baseTrade, id: 'TRD-100002', tradeTimestamp: '2026-11-10T10:00:00.000Z' })
    const res = await app.inject({ method: 'GET', url: '/trades' })
    const { trades } = JSON.parse(res.body)
    expect(trades[0].id).toBe('TRD-100002')
    expect(trades[1].id).toBe('TRD-100001')
  })
  it('each trade in response passes TradeSchema', async () => {
    await insertTrade(baseTrade)
    const { trades } = JSON.parse((await app.inject({ method: 'GET', url: '/trades' })).body)
    trades.forEach((t: unknown) => expect(TradeSchema.safeParse(t).success).toBe(true))
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/getTrades.test.ts`
  Expected: FAIL — route not registered

- [ ] **Step 3: Implement `getTrades` in `backend/src/handlers/getTrades.ts`**

  Calls `findAllTrades()`, returns `reply.send({ trades })`.

- [ ] **Step 4: Implement `registerTradeRoutes(app)` in `backend/src/routes/trades.ts`**

  Registers `app.get('/trades', getTrades)`. (Additional routes added in Tasks 7–9.)

- [ ] **Step 5: Update `buildTestApp()` in `backend/tests/helpers.ts`**

  Call `registerTradeRoutes(app)` and `await app.ready()` before returning.

- [ ] **Step 6: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/getTrades.test.ts`
  Expected: PASS — all 3 tests

- [ ] **Step 7: Commit**

  ```bash
  git add backend/src/handlers/getTrades.ts backend/src/routes/trades.ts backend/tests/handlers/getTrades.test.ts backend/tests/helpers.ts
  git commit -m "feat: add GET /trades endpoint returning all trades sorted by timestamp"
  ```
