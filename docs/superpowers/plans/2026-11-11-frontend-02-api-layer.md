# Frontend: API Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the typed REST API client functions and the `useTrades` TanStack Query hook that the rest of the frontend depends on.

**Architecture:** `api/trades.ts` wraps `fetch` for all four trade endpoints. Non-ok responses throw an `ApiError` class carrying `.status` and `.body` so callers can branch on 409 vs 5xx. `hooks/useTrades.ts` is a thin wrapper around `useQuery` with query key `['trades']`.

**Tech Stack:** `@tanstack/react-query`, `@tpicap/shared` (for `Trade`, `CreateTradeSchema`, `AmendTradeSchema` types)

**Specs:**
- `docs/specs/data-fetching.md`
- `docs/specs/create-trade.md`
- `docs/specs/amend-trade.md`
- `docs/specs/cancel-trade.md`

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

No unexercised failure modes identified for this task.

---

### Task 2: API Layer

**Files:**
- Create: `frontend/src/api/trades.ts`
- Create: `frontend/src/hooks/useTrades.ts`
- Create: `frontend/src/tests/api/trades.test.ts`
- Create: `frontend/src/tests/hooks/useTrades.test.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_API_URL`; `Trade`, `CreateTradeSchema`, `AmendTradeSchema` from `@tpicap/shared`
- Produces:
  - `fetchTrades(): Promise<Trade[]>`
  - `createTrade(data: CreateTradeInput): Promise<Trade>`
  - `amendTrade(id: string, data: AmendTradeInput): Promise<Trade>`
  - `cancelTrade(id: string): Promise<Trade>`
  - `useTrades(): UseQueryResult<Trade[]>` — query key `['trades']`

- [ ] Step 1: Write the failing tests

  `src/tests/api/trades.test.ts`:
  ```ts
  it('fetchTrades calls GET /trades and returns Trade[]', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trades: [{ id: 'TRD-100001', symbol: 'AAPL' }] }),
    });
    const result = await fetchTrades();
    expect(fetch).toHaveBeenCalledWith(`${import.meta.env.VITE_API_URL}/trades`);
    expect(result[0].id).toBe('TRD-100001');
  });

  it('createTrade calls POST /trades with the payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'TRD-100002', symbol: 'MSFT' }),
    });
    const payload = { symbol: 'MSFT', side: 'BUY', quantity: 100, price: 534, trader: 'Alice', book: 'BOOK1', counterparty: 'CPT1' };
    await createTrade(payload);
    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_URL}/trades`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('amendTrade calls PATCH /trades/:id', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await amendTrade('TRD-100001', { quantity: 200 });
    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_URL}/trades/TRD-100001`,
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('cancelTrade calls PATCH /trades/:id/cancel', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await cancelTrade('TRD-100001');
    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_URL}/trades/TRD-100001/cancel`,
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('fetchTrades throws an ApiError with status when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchTrades()).rejects.toMatchObject({ status: 500 });
  });
  ```

  `src/tests/hooks/useTrades.test.ts`:
  ```ts
  it('useTrades returns trades from fetchTrades', async () => {
    const trades = [{ id: 'TRD-100001' }];
    vi.mocked(fetchTrades).mockResolvedValue(trades as Trade[]);
    const { result } = renderHook(() => useTrades(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(trades);
  });
  ```

- [ ] Step 2: Run test to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/api/trades.test.ts src/tests/hooks/useTrades.test.ts`
  Expected: FAIL — `fetchTrades` not found

- [ ] Step 3: Implement `src/api/trades.ts` and `src/hooks/useTrades.ts`

  `api/trades.ts` — each function calls `fetch` against `import.meta.env.VITE_API_URL`. On non-ok responses, throw an `ApiError` class that carries `.status: number` and `.body: unknown` (parsed from the response JSON). This allows callers to branch on 409 vs 5xx.

  `hooks/useTrades.ts`:
  ```ts
  export function useTrades() {
    return useQuery({ queryKey: ['trades'], queryFn: fetchTrades });
  }
  ```

- [ ] Step 4: Run test to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/api/trades.test.ts src/tests/hooks/useTrades.test.ts`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/src/api/ frontend/src/hooks/useTrades.ts frontend/src/tests/api/ frontend/src/tests/hooks/useTrades.test.ts
  git commit -m "feat(frontend): add API layer and useTrades query hook"
  ```
