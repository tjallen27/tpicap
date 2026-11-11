# Backend: WebSocket Manager — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the WebSocket client manager (add/remove/broadcast) and the Fastify plugin that mounts the `/ws` route and wires clients to the manager singleton.

**Architecture:** `createWsManager()` is a factory that returns a fresh manager backed by its own `Set<WebSocket>`. The module-level `wsManager` singleton is created with this factory. `broadcast` iterates clients and sends only to those with `readyState === 1` (OPEN). `registerWsPlugin` registers `@fastify/websocket` and a `GET /ws` route that calls `addClient` on connection and `removeClient` on the `close` event. Tests use `createWsManager()` directly — no singleton access needed in unit tests.

**Tech Stack:** Fastify, @fastify/websocket, Vitest

**Specs:**
- `docs/specs/live-updates.md`

**Dependencies:**
- `2026-11-11-backend-02-backend-scaffold.md` (provides `createApp()`)

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

**Item 5 — Broadcast with no clients:** `broadcast()` called when the client `Set` is empty must not throw. This task adds a test that calls `broadcast('trade:created', {})` on a freshly created manager (zero clients) and asserts no exception is thrown.

---

### Task 6: WebSocket Manager

**Files:**
- Create: `backend/src/websocket/manager.ts`
- Create: `backend/src/websocket/plugin.ts`
- Test: `backend/tests/websocket/manager.test.ts`

**Interfaces:**
- Consumes: `@fastify/websocket`
- Produces:
  - `type WsManager = { addClient(ws: WebSocket): void; removeClient(ws: WebSocket): void; broadcast(event: string, payload: unknown): void }`
  - `createWsManager(): WsManager` — factory; each call returns an independent manager with its own client Set
  - `wsManager` — module-level singleton: `export const wsManager = createWsManager()`
  - `registerWsPlugin(app: FastifyInstance): void` — registers `@fastify/websocket` and the `/ws` route

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/websocket/manager.test.ts
  // Each test creates its own manager instance — no shared state, no test-only exports
  it('broadcast does not throw when no clients are connected', () => {
    const { broadcast } = createWsManager()
    expect(() => broadcast('trade:created', {})).not.toThrow()
  })
  it('broadcast sends JSON message to all open clients', () => {
    const { addClient, broadcast } = createWsManager()
    const mockWs = { readyState: 1, send: vi.fn() } as unknown as WebSocket
    addClient(mockWs)
    broadcast('trade:created', { id: 'TRD-100001' })
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ event: 'trade:created', payload: { id: 'TRD-100001' } }))
  })
  it('broadcast skips clients that are not in OPEN state', () => {
    const { addClient, broadcast } = createWsManager()
    const closedWs = { readyState: 3, send: vi.fn() } as unknown as WebSocket
    addClient(closedWs)
    broadcast('trade:created', {})
    expect(closedWs.send).not.toHaveBeenCalled()
  })
  it('removeClient stops the client from receiving broadcasts', () => {
    const { addClient, removeClient, broadcast } = createWsManager()
    const mockWs = { readyState: 1, send: vi.fn() } as unknown as WebSocket
    addClient(mockWs); removeClient(mockWs)
    broadcast('trade:created', {})
    expect(mockWs.send).not.toHaveBeenCalled()
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/websocket/manager.test.ts`
  Expected: FAIL — `createWsManager is not defined`

- [ ] **Step 3: Implement `backend/src/websocket/manager.ts`**

  `createWsManager()` creates a local `const clients = new Set<WebSocket>()` and returns `{ addClient, removeClient, broadcast }`. `addClient` adds to the set. `removeClient` deletes from the set. `broadcast` iterates the set and calls `ws.send(JSON.stringify({ event, payload }))` only when `ws.readyState === 1` (`WebSocket.OPEN`). Export `export const wsManager = createWsManager()` as the production singleton.

- [ ] **Step 4: Implement `backend/src/websocket/plugin.ts`**

  Registers `@fastify/websocket` on the app. Adds a `GET /ws` route with `{ websocket: true }`. Since `@fastify/websocket` v10 the handler receives `(socket, req)` directly — not `connection.socket`. Call `wsManager.addClient(socket)` on connection and `wsManager.removeClient(socket)` on the `'close'` event.

- [ ] **Step 5: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/websocket/manager.test.ts`
  Expected: PASS — all 4 tests

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/websocket/ backend/tests/websocket/
  git commit -m "feat: add WebSocket client manager and /ws plugin"
  ```
