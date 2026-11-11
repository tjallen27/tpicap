# Backend: POST /trades Endpoint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `POST /trades` route handler that validates the request body with `CreateTradeSchema`, persists the new trade, broadcasts `trade:created`, and returns `201` with the created trade.

**Architecture:** `createTrade` parses the body with `CreateTradeSchema.safeParse()`. On failure it returns `400` with `{ error, issues }`. On success it generates a trade ID, sets `status: 'ACTIVE'`, inserts the trade, broadcasts it, and returns `201`. The `wsManager` is mocked in tests to isolate the handler from the WebSocket layer.

**Tech Stack:** Fastify, @tpicap/shared (CreateTradeSchema), Vitest, mongodb-memory-server

**Specs:**
- `docs/specs/create-trade.md`

**Dependencies:**
- `2026-11-11-backend-05-get-trades-endpoint.md` (provides `registerTradeRoutes` to extend, and `buildTestApp()` wired with routes)
- `2026-11-11-backend-06-websocket-manager.md` (provides `wsManager` to mock)
- `2026-11-11-backend-03-trade-db-queries.md` (provides `insertTrade()`)

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

### Task 7: POST /trades Endpoint

**Files:**
- Create: `backend/src/handlers/createTrade.ts`
- Modify: `backend/src/routes/trades.ts` (add POST route)
- Test: `backend/tests/handlers/createTrade.test.ts`

**Interfaces:**
- Consumes: `CreateTradeSchema`, `type CreateTradeInput`, `type Trade` from `@tpicap/shared`; `insertTrade()` from `db/trades.ts`; `wsManager` from `websocket/manager.ts`
- Produces: `createTrade(request: FastifyRequest, reply: FastifyReply): Promise<void>`

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/handlers/createTrade.test.ts
  vi.mock('../../src/websocket/manager', () => ({ wsManager: { broadcast: vi.fn() } }))
  import { wsManager } from '../../src/websocket/manager'

  const validBody = {
    symbol: 'AAPL', side: 'BUY', quantity: 100, price: 227.45,
    trader: 'JSMITH', book: 'EQUITIES_UK', counterparty: 'Goldman Sachs',
    tradeTimestamp: '2026-11-11T09:00:00.000Z',
  }

  it('POST /trades with valid body returns 201 with the created trade', async () => {
    const res = await app.inject({ method: 'POST', url: '/trades', payload: validBody })
    expect(res.statusCode).toBe(201)
    const trade = JSON.parse(res.body)
    expect(trade.id).toMatch(/^TRD-\d{6}$/)
    expect(trade.status).toBe('ACTIVE')
    expect(trade.symbol).toBe('AAPL')
  })
  it('POST /trades persists the trade to MongoDB', async () => {
    await app.inject({ method: 'POST', url: '/trades', payload: validBody })
    expect(await getTestDb().collection('trades').countDocuments()).toBe(1)
  })
  it('POST /trades broadcasts trade:created with the full trade', async () => {
    await app.inject({ method: 'POST', url: '/trades', payload: validBody })
    expect(wsManager.broadcast).toHaveBeenCalledWith('trade:created', expect.objectContaining({ status: 'ACTIVE' }))
  })
  it('POST /trades with missing field returns 400 with issues array', async () => {
    const res = await app.inject({ method: 'POST', url: '/trades', payload: { ...validBody, symbol: undefined } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).issues).toBeDefined()
  })
  it('POST /trades with quantity 0 returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/trades', payload: { ...validBody, quantity: 0 } })
    expect(res.statusCode).toBe(400)
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/createTrade.test.ts`
  Expected: FAIL — `POST /trades` returns 404

- [ ] **Step 3: Implement `createTrade` in `backend/src/handlers/createTrade.ts`**

  Parse body with `CreateTradeSchema.safeParse()`. On failure, return `reply.status(400).send({ error: 'Validation failed', issues: result.error.issues })`. On success, construct the full `Trade`: `id = generateTradeId()`, `tradeTimestamp` from body, `status = 'ACTIVE'`. Call `insertTrade(trade)`, then `wsManager.broadcast('trade:created', trade)`, then `reply.status(201).send(trade)`.

  `generateTradeId(): string` — defined locally in this file: `return \`TRD-${Math.floor(100000 + Math.random() * 900000)}\``.

- [ ] **Step 4: Register `POST /trades` in `backend/src/routes/trades.ts`**

  Add `app.post('/trades', createTrade)`.

- [ ] **Step 5: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/createTrade.test.ts`
  Expected: PASS — all 5 tests

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/handlers/createTrade.ts backend/src/routes/trades.ts backend/tests/handlers/createTrade.test.ts
  git commit -m "feat: add POST /trades endpoint with Zod validation and WebSocket broadcast"
  ```
