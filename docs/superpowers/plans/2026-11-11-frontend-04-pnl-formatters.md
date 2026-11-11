# Frontend: P&L + Formatters + usePrices — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the P&L calculation function, all display formatters, and the `usePrices` hook that reads live prices from the query cache.

**Architecture:** `lib/pnl.ts` is a pure function. `lib/formatters.ts` uses `Intl.NumberFormat` and `Intl.DateTimeFormat` for locale-aware output. `hooks/usePrices.ts` is a one-liner that reads `['prices']` from the QueryClient cache. The `currentPrice ?? trade.price` fallback pattern is baked into the P&L tests to guarantee zero P&L (not NaN) before the first `price:updated` event.

**Tech Stack:** `@tanstack/react-query`, `@tpicap/shared` (for `Trade`)

**Specs:**
- `docs/specs/trade-blotter-table.md`
- `docs/specs/live-updates.md`

**Dependencies:** `2026-11-11-frontend-01-scaffold.md`

## Global Constraints

- Env vars: `VITE_API_URL` (backend base URL, e.g. `http://localhost:3000`) and `VITE_WS_URL` (WebSocket URL, e.g. `ws://localhost:3000`) — read via `import.meta.env`
- WebSocket endpoint: `${VITE_WS_URL}/ws`
- Query keys: `['trades']` for the trade list; `['prices']` for the symbol → currentPrice map
- P&L formula: `(currentPrice - price) × quantity × (side === 'BUY' ? 1 : -1)`
- P&L display: formatted currency with sign (`+$12,450.00` / `-$3,200.00`); positive=green, negative=red, zero=neutral
- Reconnect backoff delays: attempt 1=1000ms, attempt 2=2000ms, attempt 3=4000ms, attempt 4+=8000ms
- WebSocket event names: `trade:created`, `trade:amended`, `trade:cancelled`, `price:updated`
- WS message shape: `{ event: string, payload: unknown }` — JSON.parse on `message.data`
- Timestamp display format: `DD MMM YYYY HH:mm:ss`
- Default sort on load: `tradeTimestamp` descending
- Quick search fields: `id`, `symbol`, `trader`, `book`, `counterparty` (case-insensitive)
- Side filter options: `BUY`, `SELL`; Status filter options: `ACTIVE`, `CANCELLED`
- `CANCELLED` rows render at reduced opacity; `BUY` in green; `SELL` in red
- No optimistic updates on cancel — UI reflects only confirmed server state
- `tradeTimestamp` is not collected from the user — the backend sets it; the form sends only `CreateTradeSchema` fields
- Amend does not submit if form values are identical to current trade values
- 409 on cancel or amend: show notification + call `queryClient.invalidateQueries(['trades'])`

## Review Focus

1. **P&L shows $0.00 before first price:updated** — `currentPrice ?? trade.price` fallback must produce zero P&L, not NaN. Task 4 adds: `it('returns 0 when currentPrice equals price', ...)` in `pnl.test.ts`.

---

### Task 4: P&L + Formatters + usePrices

**Files:**
- Create: `frontend/src/lib/pnl.ts`
- Create: `frontend/src/lib/formatters.ts`
- Create: `frontend/src/hooks/usePrices.ts`
- Create: `frontend/src/tests/lib/pnl.test.ts`
- Create: `frontend/src/tests/lib/formatters.test.ts`

**Interfaces:**
- Consumes: `Trade` from `@tpicap/shared`; `['prices']` cache via `useQueryClient()`
- Produces:
  - `calculatePnl(trade: Trade, currentPrice: number): number`
  - `formatCurrency(n: number): string` — e.g. `"+$12,450.00"`, `"-$3,200.00"`, `"$0.00"` (used for P&L — includes sign)
  - `formatPrice(n: number): string` — e.g. `"$227.45"` (used for execution price — no sign prefix)
  - `formatTimestamp(isoString: string): string` — e.g. `"11 Nov 2026 14:30:00"`
  - `formatQuantity(n: number): string` — e.g. `"1,000"`
  - `usePrices(): Record<string, number>` — reads `['prices']` from QueryClient cache

- [ ] Step 1: Write the failing tests

  `src/tests/lib/pnl.test.ts`:
  ```ts
  it('returns positive P&L for a BUY trade when currentPrice > price', () => {
    const trade = { price: 100, quantity: 100, side: 'BUY' } as Trade;
    expect(calculatePnl(trade, 110)).toBe(1000);
  });

  it('returns negative P&L for a BUY trade when currentPrice < price', () => {
    const trade = { price: 100, quantity: 100, side: 'BUY' } as Trade;
    expect(calculatePnl(trade, 90)).toBe(-1000);
  });

  it('returns positive P&L for a SELL trade when currentPrice < price', () => {
    const trade = { price: 100, quantity: 100, side: 'SELL' } as Trade;
    expect(calculatePnl(trade, 90)).toBe(1000);
  });

  it('returns negative P&L for a SELL trade when currentPrice > price', () => {
    const trade = { price: 100, quantity: 100, side: 'SELL' } as Trade;
    expect(calculatePnl(trade, 110)).toBe(-1000);
  });

  it('returns 0 when currentPrice equals price', () => {
    const trade = { price: 100, quantity: 100, side: 'BUY' } as Trade;
    expect(calculatePnl(trade, 100)).toBe(0);
  });

  it('returns 0 when currentPrice equals trade.price (the fallback case)', () => {
    // This mirrors the frontend fallback: currentPrice ?? trade.price
    const trade = { price: 227, quantity: 500, side: 'BUY' } as Trade;
    expect(calculatePnl(trade, trade.price)).toBe(0);
  });
  ```

  `src/tests/lib/formatters.test.ts`:
  ```ts
  it('formatCurrency formats positive number with + prefix', () => {
    expect(formatCurrency(12450)).toBe('+$12,450.00');
  });

  it('formatCurrency formats negative number with - prefix', () => {
    expect(formatCurrency(-3200)).toBe('-$3,200.00');
  });

  it('formatCurrency formats zero without sign prefix', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formatCurrency formats decimal values to 2dp', () => {
    expect(formatCurrency(1234.567)).toBe('+$1,234.57');
  });

  it('formatPrice formats positive number as plain currency with no sign', () => {
    expect(formatPrice(227.45)).toBe('$227.45');
  });

  it('formatPrice formats integer with two decimal places', () => {
    expect(formatPrice(227)).toBe('$227.00');
  });

  it('formatTimestamp formats ISO string to DD MMM YYYY HH:mm:ss', () => {
    expect(formatTimestamp('2026-11-11T14:30:00.000Z')).toBe('11 Nov 2026 14:30:00');
  });

  it('formatQuantity formats integer with thousands separator', () => {
    expect(formatQuantity(1000)).toBe('1,000');
    expect(formatQuantity(1000000)).toBe('1,000,000');
    expect(formatQuantity(500)).toBe('500');
  });
  ```

- [ ] Step 2: Run test to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/lib/pnl.test.ts src/tests/lib/formatters.test.ts`
  Expected: FAIL — `calculatePnl`, `formatCurrency`, `formatTimestamp`, `formatQuantity` not found

- [ ] Step 3: Implement `src/lib/pnl.ts`, `src/lib/formatters.ts`, `src/hooks/usePrices.ts`

  `lib/pnl.ts`:
  ```ts
  export function calculatePnl(trade: Trade, currentPrice: number): number {
    return (currentPrice - trade.price) * trade.quantity * (trade.side === 'BUY' ? 1 : -1);
  }
  ```

  `lib/formatters.ts` — `formatCurrency` uses `Intl.NumberFormat` with `style: 'currency', currency: 'USD'`; prepend `+` for positive, `-` for negative (native format), no prefix for zero. `formatTimestamp` uses `Intl.DateTimeFormat` with explicit `day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC'` to produce `DD MMM YYYY HH:mm:ss`. `formatQuantity` uses `Intl.NumberFormat`.

  `hooks/usePrices.ts`:
  ```ts
  export function usePrices(): Record<string, number> {
    return useQueryClient().getQueryData<Record<string, number>>(['prices']) ?? {};
  }
  ```

- [ ] Step 4: Run test to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/lib/pnl.test.ts src/tests/lib/formatters.test.ts`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/src/lib/ frontend/src/hooks/usePrices.ts frontend/src/tests/lib/
  git commit -m "feat(frontend): add P&L calculation, formatters, and usePrices hook"
  ```
