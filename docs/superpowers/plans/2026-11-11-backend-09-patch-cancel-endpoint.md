# Backend: PATCH /trades/:id/cancel Endpoint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `PATCH /trades/:id/cancel` route handler that atomically transitions a trade to `CANCELLED`, broadcasts the event, and returns correct status codes for not-found and already-cancelled cases.

**Architecture:** `cancelTrade` calls `setTradeCancelled(id)` which uses a MongoDB `findOneAndUpdate` with `{ id, status: 'ACTIVE' }` as the filter — making the status check and update atomic. If the result is non-null the trade was just cancelled; broadcast and return `200`. If null, check `findTradeById(id)`: not found → `404`, found → `409` (already cancelled). The cancel route must be registered before `PATCH /trades/:id` so Fastify matches the more specific path first.

**Tech Stack:** Fastify, Vitest, mongodb-memory-server

**Specs:**
- `docs/specs/cancel-trade.md`

**Dependencies:**
- `2026-11-11-backend-08-patch-amend-endpoint.md` (provides the current state of `registerTradeRoutes` to extend; establishes route registration order requirement)
- `2026-11-11-backend-06-websocket-manager.md` (provides `wsManager` to mock)
- `2026-11-11-backend-03-trade-db-queries.md` (provides `findTradeById()`, `setTradeCancelled()`)

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

**Item 1 — Concurrent cancel:** Two clients cancel the same active trade simultaneously; the second must get `409`, not a corrupt document. `setTradeCancelled` uses `findOneAndUpdate` with `{ id, status: 'ACTIVE' }` as the filter, making the status check and update atomic. This task adds a test that calls `setTradeCancelled` twice in parallel and asserts one resolves to a trade and one resolves to `null`.

---

### Task 9: PATCH /trades/:id/cancel Endpoint

**Files:**
- Create: `backend/src/handlers/cancelTrade.ts`
- Modify: `backend/src/routes/trades.ts` (add cancel route)
- Test: `backend/tests/handlers/cancelTrade.test.ts`

**Interfaces:**
- Consumes: `findTradeById()`, `setTradeCancelled()` from `db/trades.ts`; `wsManager` from `websocket/manager.ts`
- Produces: `cancelTrade(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void>`

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/handlers/cancelTrade.test.ts
  vi.mock('../../src/websocket/manager', () => ({ wsManager: { broadcast: vi.fn() } }))
  import { wsManager } from '../../src/websocket/manager'

  it('PATCH /trades/:id/cancel returns 200 with cancelled trade', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('CANCELLED')
  })
  it('PATCH /trades/:id/cancel broadcasts trade:cancelled', async () => {
    await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' })
    expect(wsManager.broadcast).toHaveBeenCalledWith('trade:cancelled', expect.objectContaining({ status: 'CANCELLED' }))
  })
  it('PATCH /trades/:id/cancel returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-999999/cancel' })
    expect(res.statusCode).toBe(404)
  })
  it('PATCH /trades/:id/cancel returns 409 for already-cancelled trade', async () => {
    await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' }) // first cancel
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' }) // second
    expect(res.statusCode).toBe(409)
  })
  it('concurrent cancels — only one succeeds, second returns 409', async () => {
    // Review Focus #1: test atomic behaviour of setTradeCancelled
    const [r1, r2] = await Promise.all([
      setTradeCancelled('TRD-100001'),
      setTradeCancelled('TRD-100001'),
    ])
    const results = [r1, r2]
    expect(results.filter(r => r !== null)).toHaveLength(1)
    expect(results.filter(r => r === null)).toHaveLength(1)
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/cancelTrade.test.ts`
  Expected: FAIL — route not registered

- [ ] **Step 3: Implement `cancelTrade` in `backend/src/handlers/cancelTrade.ts`**

  Call `setTradeCancelled(id)`. If result is not null: call `wsManager.broadcast('trade:cancelled', result)`, return `200`. If null: call `findTradeById(id)`; if null return `404`, else return `409` (trade exists but was already cancelled).

- [ ] **Step 4: Register `PATCH /trades/:id/cancel` in `backend/src/routes/trades.ts`**

  Add `app.patch('/trades/:id/cancel', cancelTrade)`. This route must be registered **before** `PATCH /trades/:id` so Fastify matches the more specific path first.

- [ ] **Step 5: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/handlers/cancelTrade.test.ts`
  Expected: PASS — all 5 tests

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/handlers/cancelTrade.ts backend/src/routes/trades.ts backend/tests/handlers/cancelTrade.test.ts
  git commit -m "feat: add PATCH /trades/:id/cancel endpoint with atomic status transition and broadcast"
  ```
