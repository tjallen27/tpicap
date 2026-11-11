# Backend: Price Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `startPriceService()` — the orchestrator that initialises the price simulator (optionally seeding it from Finnhub), runs a 3-second broadcast interval, and returns a cleanup function.

**Architecture:** `startPriceService` accepts a `broadcast` function and an optional `finnhubApiKey`. When a key is present it calls `fetchFinnhubPrices` to seed the simulator's initial prices; symbols missing from the Finnhub result keep their base price. It then starts a `setInterval` at 3000 ms: each tick calls `simulator.tick()`, maps prices to `PriceUpdate[]`, and calls `broadcast('price:updated', updates)`. The returned cleanup function calls `clearInterval`. Tests use fake timers to control the interval without real delays.

**Tech Stack:** Vitest (fake timers), @tpicap/shared (PriceUpdateEventSchema)

**Specs:**
- `docs/specs/data-fetching.md`
- `docs/specs/live-updates.md`

**Dependencies:**
- `2026-11-11-backend-10-price-simulator.md` (provides `PriceSimulator` and `BASE_PRICES`)
- `2026-11-11-backend-11-finnhub-client.md` (provides `fetchFinnhubPrices()`)

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

### Task 12: Price Service

**Files:**
- Create: `backend/src/prices/priceService.ts`
- Test: `backend/tests/prices/priceService.test.ts`

**Interfaces:**
- Consumes: `fetchFinnhubPrices()`, `PriceSimulator`, `BASE_PRICES`, `broadcast` (passed as parameter); `PriceUpdateEventSchema` from `@tpicap/shared`
- Produces:
  - `startPriceService(broadcast: BroadcastFn, options?: { finnhubApiKey?: string }): () => void` — starts the interval; returns a cleanup function that calls `clearInterval`

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/prices/priceService.test.ts
  it('starts simulator and does not call Finnhub when apiKey is undefined', async () => {
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    stop()
    // fetchFinnhubPrices should not have been called
    // (import spy or confirm no network attempt)
  })
  it('broadcasts price:updated with all 10 symbols on first tick', async () => {
    vi.useFakeTimers()
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    vi.advanceTimersByTime(3000)
    expect(mockBroadcast).toHaveBeenCalledWith('price:updated',
      expect.arrayContaining([expect.objectContaining({ symbol: 'AAPL' })]))
    const payload = mockBroadcast.mock.calls[0][1]
    expect(payload).toHaveLength(10)
    stop()
    vi.useRealTimers()
  })
  it('payload passes PriceUpdateEventSchema validation', async () => {
    vi.useFakeTimers()
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    vi.advanceTimersByTime(3000)
    expect(PriceUpdateEventSchema.safeParse(mockBroadcast.mock.calls[0][1]).success).toBe(true)
    stop()
    vi.useRealTimers()
  })
  it('stop function clears the interval', async () => {
    vi.useFakeTimers()
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    stop()
    vi.advanceTimersByTime(9000)
    expect(mockBroadcast).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/prices/priceService.test.ts`
  Expected: FAIL — `startPriceService is not defined`

- [ ] **Step 3: Implement `startPriceService` in `backend/src/prices/priceService.ts`**

  If `options.finnhubApiKey` is set: call `fetchFinnhubPrices(Object.keys(BASE_PRICES), apiKey)`. For each symbol returned, initialise the simulator's prices from Finnhub; for any symbol missing from the Finnhub result, keep the base price. If no key: start the simulator with `BASE_PRICES` directly.

  Start a `setInterval` at `3000` ms. On each tick: call `simulator.tick()`, get `simulator.getPrices()`, map to `PriceUpdate[]` with `timestamp: new Date().toISOString()`, call `broadcast('price:updated', updates)`.

  Return a cleanup function that calls `clearInterval`.

- [ ] **Step 4: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/prices/priceService.test.ts`
  Expected: PASS — all 4 tests

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/prices/priceService.ts backend/tests/prices/priceService.test.ts
  git commit -m "feat: add price service — Finnhub integration with simulator fallback, 3s broadcast interval"
  ```
