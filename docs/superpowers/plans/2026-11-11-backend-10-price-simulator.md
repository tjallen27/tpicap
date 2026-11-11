# Backend: Price Simulator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `BASE_PRICES` into `symbolPool.ts` and implement the `PriceSimulator` class with a zero-floor guard that prevents prices from reaching or going below zero.

**Architecture:** `symbolPool.ts` exports `BASE_PRICES` as a constant record. `PriceSimulator` stores prices in a mutable `Record<string, number>`, initialised from the constructor argument. `tick()` applies the drift formula from Global Constraints to each symbol; if the computed result would be ≤ 0, the update for that symbol is skipped and the previous price is kept. `seed.ts` is updated to import `BASE_PRICES` from `symbolPool.ts` instead of defining it locally.

**Tech Stack:** Vitest

**Specs:**
- `docs/specs/data-fetching.md`

**Dependencies:**
- `2026-11-11-backend-04-seed-data.md` (defines the local `BASE_PRICES` in `seed.ts` that this task replaces with an import)

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

**Item 4 — Simulator zero-floor guard:** 10,000 consecutive ticks of pure downward drift must never produce a price ≤ 0. This task seeds the simulator with `{ TEST: 0.01 }` (a near-zero price), runs 10,000 ticks with a mocked `Math.random` returning `0` (maximum negative drift each time), and asserts the price remains `0.01`.

---

### Task 10: Price Simulator

**Files:**
- Create: `backend/src/prices/symbolPool.ts`
- Create: `backend/src/prices/simulator.ts`
- Modify: `backend/src/seed/seed.ts` — replace local `BASE_PRICES` with import from `symbolPool.ts`
- Test: `backend/tests/prices/simulator.test.ts`

**Interfaces:**
- Produces:
  - `BASE_PRICES: Record<string, number>` — `{ AAPL: 227, MSFT: 534, TSLA: 342, GOOGL: 198, AMZN: 225, NVDA: 875, META: 605, JPM: 248, GS: 582, MS: 134 }`
  - `class PriceSimulator { constructor(basePrices: Record<string, number>); tick(): void; getPrices(): Record<string, number>; getPrice(symbol: string): number }`

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/prices/simulator.test.ts
  it('initialises prices to base prices', () => {
    const sim = new PriceSimulator({ AAPL: 227 })
    expect(sim.getPrice('AAPL')).toBe(227)
  })
  it('tick changes price by at most ±0.5%', () => {
    const sim = new PriceSimulator({ AAPL: 100 })
    sim.tick()
    expect(sim.getPrice('AAPL')).toBeGreaterThanOrEqual(99.50)
    expect(sim.getPrice('AAPL')).toBeLessThanOrEqual(100.50)
  })
  it('price never reaches 0 or below after 10,000 ticks of maximum negative drift', () => {
    // Review Focus #4
    vi.spyOn(Math, 'random').mockReturnValue(0) // 0 → drift = price * (0 * 0.01 - 0.005) = -0.5%
    const sim = new PriceSimulator({ TEST: 0.01 })
    for (let i = 0; i < 10000; i++) sim.tick()
    expect(sim.getPrice('TEST')).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })
  it('getPrices returns all tracked symbols', () => {
    const sim = new PriceSimulator({ AAPL: 227, MSFT: 534 })
    expect(Object.keys(sim.getPrices())).toEqual(expect.arrayContaining(['AAPL', 'MSFT']))
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/prices/simulator.test.ts`
  Expected: FAIL — `PriceSimulator is not defined`

- [ ] **Step 3: Implement `symbolPool.ts` and `simulator.ts`**

  `symbolPool.ts`: export `BASE_PRICES` as a `const` object with the 10 symbols and values from Global Constraints.

  `PriceSimulator`: stores prices in a `Record<string, number>` initialised from `basePrices`. `tick()` applies the drift formula from Global Constraints to each symbol; if the result would be ≤ 0, skip the update for that symbol. `getPrices()` returns a shallow copy. `getPrice(symbol)` returns the price for that symbol.

- [ ] **Step 4: Update `seed.ts`** — replace local `BASE_PRICES` definition with `import { BASE_PRICES } from '../prices/symbolPool'`.

- [ ] **Step 5: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/prices/simulator.test.ts`
  Expected: PASS — all 4 tests

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/prices/symbolPool.ts backend/src/prices/simulator.ts backend/src/seed/seed.ts backend/tests/prices/simulator.test.ts
  git commit -m "feat: add PriceSimulator with zero-floor guard and extract BASE_PRICES to symbolPool"
  ```
