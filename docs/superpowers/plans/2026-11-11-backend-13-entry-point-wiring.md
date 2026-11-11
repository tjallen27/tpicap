# Backend: Entry Point Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all modules into `backend/src/index.ts` — the production entry point that initialises config, connects to MongoDB, registers plugins and routes, seeds the database, starts the price service, and begins listening.

**Architecture:** `index.ts` is a single `main()` async function that orchestrates startup in a fixed order: config → DB → app → WebSocket plugin → trade routes → ready → seed → price service → listen. Any startup error is caught, logged, and exits with code 1. `backend/.env.example` documents the required and optional environment variables.

**Tech Stack:** All modules from Tasks 1–12

**Specs:**
- `docs/specs/data-model.md`
- `docs/specs/data-fetching.md`
- `docs/specs/create-trade.md`
- `docs/specs/amend-trade.md`
- `docs/specs/cancel-trade.md`
- `docs/specs/live-updates.md`

**Dependencies:**
- All preceding tasks (1–12) must be complete before wiring.

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

### Task 13: Entry Point Wiring

**Files:**
- Create: `backend/src/index.ts`
- Create: `backend/.env.example`

**Interfaces:**
- Consumes: all modules created in Tasks 1–12
- Produces: a running server bound to `config.port`

- [ ] **Step 1: Implement `backend/src/index.ts`**

  ```typescript
  // Order matters:
  // 1. parseConfig()
  // 2. await connectDb(config.mongodbUri)
  // 3. const app = createApp()
  // 4. registerWsPlugin(app)
  // 5. registerTradeRoutes(app)
  // 6. await app.ready()
  // 7. await seedIfEmpty()
  // 8. startPriceService(broadcast, { finnhubApiKey: config.finnhubApiKey })
  // 9. await app.listen({ port: config.port, host: '0.0.0.0' })
  ```

  Wrap in a `main()` async function. Catch and log any startup errors, then `process.exit(1)`.

- [ ] **Step 2: Create `backend/.env.example`**

  ```bash
  MONGODB_URI=mongodb://localhost:27017/tpicap-blotter
  PORT=3000
  FINNHUB_API_KEY=   # optional — price simulator runs if unset
  ```

- [ ] **Step 3: Run the full test suite**

  Run: `pnpm --filter @tpicap/shared test && pnpm --filter @tpicap/backend test`
  Expected: PASS — all tests across both packages

- [ ] **Step 4: Start the server manually and verify**

  Run: `pnpm --filter @tpicap/backend dev`
  Expected:
  - Server starts and logs port
  - `GET http://localhost:3000/trades` returns `{ trades: [...] }` with 100 seed trades
  - WebSocket connection to `ws://localhost:3000/ws` is accepted
  - `price:updated` messages arrive every ~3 seconds

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/index.ts backend/.env.example
  git commit -m "feat: wire backend entry point — DB, routes, WebSocket, seed, and price service"
  ```
