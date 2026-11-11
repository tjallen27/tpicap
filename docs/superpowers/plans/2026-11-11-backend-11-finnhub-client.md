# Backend: Finnhub Client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `fetchFinnhubPrices()` — a function that fetches current prices for a list of symbols from the Finnhub API, isolating per-symbol failures so a partial outage does not block the full result.

**Architecture:** The Finnhub `DefaultApi` is instantiated with the API key. Each symbol's `quote` callback is wrapped in a `Promise`. All symbols are fetched concurrently with `Promise.allSettled` — fulfilled results are merged into the output map; rejected results are silently skipped. Tests mock the `finnhub` module to control which symbols succeed or fail.

**Tech Stack:** finnhub npm package, Vitest

**Specs:**
- `docs/specs/data-fetching.md`

**Dependencies:**
- `2026-11-11-backend-02-backend-scaffold.md` (backend package must exist for this file to be created within it)

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

**Item 3 — Finnhub partial failure:** Finnhub returns valid prices for 8 symbols and throws for 2; the 2 failed symbols must default to their base price without blocking the interval. This task adds a test with a mock that throws for selected symbols.

---

### Task 11: Finnhub Client

**Files:**
- Create: `backend/src/prices/finnhub.ts`
- Test: `backend/tests/prices/finnhub.test.ts`

**Interfaces:**
- Consumes: `finnhub` npm package
- Produces:
  - `fetchFinnhubPrices(symbols: string[], apiKey: string): Promise<Record<string, number>>` — returns a map of symbol → current price; if a symbol's quote fails, that symbol is omitted from the result (caller handles missing symbols)

- [ ] **Step 1: Write failing tests**

  ```typescript
  // backend/tests/prices/finnhub.test.ts
  // The finnhub package uses new DefaultApi(apiKey) — no ApiClient.instance setup needed
  vi.mock('finnhub', () => ({
    default: {
      DefaultApi: vi.fn().mockImplementation(() => ({
        quote: vi.fn((symbol, cb) => {
          if (symbol === 'FAIL') return cb(new Error('not found'), null)
          cb(null, { c: 227.45 }) // c = current price field
        })
      }))
    }
  }))

  it('returns prices for all symbols that succeed', async () => {
    const prices = await fetchFinnhubPrices(['AAPL', 'MSFT'], 'test-key')
    expect(prices['AAPL']).toBe(227.45)
    expect(prices['MSFT']).toBe(227.45)
  })
  it('omits symbols that fail and resolves for the rest', async () => {
    // Review Focus #3
    const prices = await fetchFinnhubPrices(['AAPL', 'FAIL'], 'test-key')
    expect(prices['AAPL']).toBe(227.45)
    expect(prices['FAIL']).toBeUndefined()
  })
  it('resolves to empty object when all symbols fail', async () => {
    const prices = await fetchFinnhubPrices(['FAIL'], 'test-key')
    expect(prices).toEqual({})
  })
  ```

- [ ] **Step 2: Run tests to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/prices/finnhub.test.ts`
  Expected: FAIL — `fetchFinnhubPrices is not defined`

- [ ] **Step 3: Implement `fetchFinnhubPrices` in `backend/src/prices/finnhub.ts`**

  Initialise the client: `const client = new finnhub.DefaultApi(apiKey)`. For each symbol, wrap `client.quote(symbol, (error, data) => { ... })` in a `Promise` that resolves to `data.c` on success and rejects on error. Use `Promise.allSettled` to fetch all symbols concurrently. For each fulfilled result, add the symbol and its price to the output map. Skip any rejected results.

- [ ] **Step 4: Run tests to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/prices/finnhub.test.ts`
  Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/prices/finnhub.ts backend/tests/prices/finnhub.test.ts
  git commit -m "feat: add Finnhub client with per-symbol error isolation"
  ```
