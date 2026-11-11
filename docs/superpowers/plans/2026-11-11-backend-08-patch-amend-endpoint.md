# Backend: PATCH /trades/:id Endpoint (Amend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `PATCH /trades/:id` route handler that validates mutable fields, rejects immutable fields with `400`, rejects cancelled trades with `409`, updates the trade, and broadcasts `trade:amended`.

**Architecture:** `amendTrade` checks the raw request body for any key in `IMMUTABLE_FIELDS` before schema validation — if found, returns `400 { error: 'Invalid fields', fields: [...] }`. It then validates remaining fields with `AmendTradeSchema`, fetches the trade, checks it is not `CANCELLED`, calls `patchTrade`, and broadcasts the result. The route must be registered after the cancel route so Fastify matches `/trades/:id/cancel` first.

**Tech Stack:** Fastify, @tpicap/shared (AmendTradeSchema), Vitest, mongodb-memory-server

**Specs:**
- `docs/specs/amend-trade.md`

**Dependencies:**
- `2026-11-11-backend-07-post-trades-endpoint.md` (provides `registerTradeRoutes` to extend)
- `2026-11-11-backend-06-websocket-manager.md` (provides `wsManager` to mock)
- `2026-11-11-backend-03-trade-db-queries.md` (provides `findTradeById()`, `patchTrade()`)

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

**Item 2 — Amend with immutable field:** `{ symbol: "NVDA" }` sent to `PATCH /trades/:id` must return `400` with `fields: ["symbol"]`, not silently ignore or persist it. This task adds this as an integration test.

---

### Task 8: PATCH /trades/:id Endpoint (Amend)

**Files:**
- Create: `backend/src/handlers/amendTrade.ts`
- Modify: `backend/src/routes/trades.ts` (add PATCH route)
- Test: `backend/tests/handlers/amendTrade.test.ts`

**Interfaces:**
- Consumes: `AmendTradeSchema`, `type AmendTradeInput` from `@tpicap/shared`; `findTradeById()`, `patchTrade()` from `db/trades.ts`; `wsManager` from `websocket/manager.ts`
- Produces: `amendTrade(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void>`

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/handlers/amendTrade.test.ts
  vi.mock('../../src/websocket/manager', () => ({ wsManager: { broadcast: vi.fn() } }))
  import { wsManager } from '../../src/websocket/manager'

  beforeEach(async () => {
    await getTestDb().collection('trades').deleteMany({})
    await insertTrade(baseTrade) // baseTrade.id = 'TRD-100001', status: 'ACTIVE'
  })

  it('PATCH /trades/:id with valid fields returns 200 with updated trade', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 500 } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).quantity).toBe(500)
  })
  it('PATCH /trades/:id broadcasts trade:amended with updated trade', async () => {
    await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 500 } })
    expect(wsManager.broadcast).toHaveBeenCalledWith('trade:amended', expect.objectContaining({ quantity: 500 }))
  })
  it('PATCH /trades/:id returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-999999', payload: { quantity: 1 } })
    expect(res.statusCode).toBe(404)
  })
  it('PATCH /trades/:id returns 409 for cancelled trade', async () => {
    await getTestDb().collection('trades').updateOne({ id: 'TRD-100001' }, { $set: { status: 'CANCELLED' } })
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 500 } })
    expect(res.statusCode).toBe(409)
  })
  it('PATCH /trades/:id returns 400 with field list when immutable field present', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { symbol: 'NVDA' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid fields', fields: ['symbol'] })
  })
  it('PATCH /trades/:id returns 400 for quantity 0', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 0 } })
    expect(res.statusCode).toBe(400)
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/amendTrade.test.ts`
  Expected: FAIL — route not registered

- [ ] **Step 3: Implement `amendTrade` in `backend/src/handlers/amendTrade.ts`**

  `IMMUTABLE_FIELDS = ['id', 'symbol', 'side', 'tradeTimestamp', 'status']`. Check raw `request.body` for any immutable field key; if found, return `400 { error: 'Invalid fields', fields: [...] }`. Parse remaining body with `AmendTradeSchema.safeParse()`; on failure return `400`. Call `findTradeById(id)`; if null return `404`. If `trade.status === 'CANCELLED'` return `409`. Call `patchTrade(id, fields)`, call `wsManager.broadcast('trade:amended', updatedTrade)`, return `200` with updated trade.

- [ ] **Step 4: Register `PATCH /trades/:id` in `backend/src/routes/trades.ts`**

  Add `app.patch('/trades/:id', amendTrade)`.

- [ ] **Step 5: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/amendTrade.test.ts`
  Expected: PASS — all 6 tests

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/handlers/amendTrade.ts backend/src/routes/trades.ts backend/tests/handlers/amendTrade.test.ts
  git commit -m "feat: add PATCH /trades/:id amend endpoint with immutable field guard and broadcast"
  ```
