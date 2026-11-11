# Frontend: WebSocket Hook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `useWebSocket` hook that manages the WS connection lifecycle, exponential backoff reconnection, and live cache updates for trades and prices.

**Architecture:** A single `useWebSocket` hook holds refs for the current `WebSocket`, the reconnect attempt counter, and a `hasPreviouslyConnected` flag. On open (after a previous close), it calls `invalidateQueries(['trades'])` exactly once to reconcile any missed events. On message, it branches on the event name and applies `setQueryData` mutations directly into the TanStack Query cache. On unmount it closes the socket and clears any pending timeout.

**Tech Stack:** `@tanstack/react-query`, `@tpicap/shared` (for `Trade`, `PriceUpdate`)

**Specs:**
- `docs/specs/live-updates.md`

**Dependencies:** `2026-11-11-frontend-01-scaffold.md`, `2026-11-11-frontend-02-api-layer.md`

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

2. **Reconnect invalidation** — after WS reconnects, `queryClient.invalidateQueries(['trades'])` must be called exactly once. Task 3 adds a test verifying invalidation is called on the 'open' event after a previous close.

---

### Task 3: WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/tests/hooks/useWebSocket.test.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_WS_URL`; `queryClient` from `useQueryClient()`; `Trade` from `@tpicap/shared`; `PriceUpdate` from `@tpicap/shared`
- Produces:
  - `useWebSocket(): { status: 'connected' | 'reconnecting' | 'disconnected'; retry: () => void }`
  - Side effects: updates `['trades']` cache on `trade:created`, `trade:amended`, `trade:cancelled`; updates `['prices']` cache on `price:updated`; calls `queryClient.invalidateQueries(['trades'])` exactly once on reconnect

- [ ] Step 1: Write the failing tests

  `src/tests/hooks/useWebSocket.test.ts`:
  ```ts
  it('connects to ${VITE_WS_URL}/ws on mount', () => {
    renderHook(() => useWebSocket(), { wrapper });
    expect(MockWebSocket).toHaveBeenCalledWith(`${import.meta.env.VITE_WS_URL}/ws`);
  });

  it('returns status "connected" when WebSocket readyState is OPEN', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerOpen());
    expect(result.current.status).toBe('connected');
  });

  it('returns status "reconnecting" after a close event while attempts remain', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerOpen());
    act(() => mockWs.triggerClose());
    expect(result.current.status).toBe('reconnecting');
  });

  it('returns status "disconnected" after retries are exhausted', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useWebSocket(), { wrapper });
    // exhaust 4+ attempts
    for (let i = 0; i < 5; i++) {
      act(() => mockWs.triggerClose());
      await vi.runAllTimersAsync();
    }
    expect(result.current.status).toBe('disconnected');
    vi.useRealTimers();
  });

  it('uses backoff delays of 1000, 2000, 4000, 8000ms for attempts 1-4', async () => {
    vi.useFakeTimers();
    renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerClose());
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000);
    act(() => mockWs.triggerClose());
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 2000);
    act(() => mockWs.triggerClose());
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 4000);
    act(() => mockWs.triggerClose());
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 8000);
    act(() => mockWs.triggerClose());
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 8000); // capped
    vi.useRealTimers();
  });

  it('calls invalidateQueries(["trades"]) exactly once on reconnect after a close', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerOpen());
    act(() => mockWs.triggerClose());
    act(() => mockWs.triggerOpen()); // reconnect
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trades'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('appends a new trade to ["trades"] cache on trade:created event', () => {
    renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerOpen());
    const trade = { id: 'TRD-200001', symbol: 'AAPL' };
    act(() => mockWs.triggerMessage({ event: 'trade:created', payload: trade }));
    const trades = queryClient.getQueryData<Trade[]>(['trades']);
    expect(trades).toContainEqual(trade);
  });

  it('replaces the matching trade in ["trades"] cache on trade:amended event', () => {
    queryClient.setQueryData(['trades'], [{ id: 'TRD-100001', quantity: 100 }]);
    renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerOpen());
    act(() => mockWs.triggerMessage({ event: 'trade:amended', payload: { id: 'TRD-100001', quantity: 200 } }));
    const trades = queryClient.getQueryData<Trade[]>(['trades']);
    expect(trades?.find(t => t.id === 'TRD-100001')?.quantity).toBe(200);
  });

  it('replaces the matching trade in ["trades"] cache on trade:cancelled event', () => {
    queryClient.setQueryData(['trades'], [{ id: 'TRD-100001', status: 'ACTIVE' }]);
    renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerOpen());
    act(() => mockWs.triggerMessage({ event: 'trade:cancelled', payload: { id: 'TRD-100001', status: 'CANCELLED' } }));
    const trades = queryClient.getQueryData<Trade[]>(['trades']);
    expect(trades?.find(t => t.id === 'TRD-100001')?.status).toBe('CANCELLED');
  });

  it('updates ["prices"] cache on price:updated event', () => {
    renderHook(() => useWebSocket(), { wrapper });
    act(() => mockWs.triggerOpen());
    act(() => mockWs.triggerMessage({
      event: 'price:updated',
      payload: [{ symbol: 'AAPL', currentPrice: 230.50, timestamp: new Date().toISOString() }],
    }));
    const prices = queryClient.getQueryData<Record<string, number>>(['prices']);
    expect(prices?.['AAPL']).toBe(230.50);
  });

  it('closes the WebSocket connection on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket(), { wrapper });
    unmount();
    expect(mockWs.close).toHaveBeenCalled();
  });
  ```

- [ ] Step 2: Run test to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/hooks/useWebSocket.test.ts`
  Expected: FAIL — `useWebSocket` not found

- [ ] Step 3: Implement `src/hooks/useWebSocket.ts`

  The hook maintains `attemptRef` (reconnect counter), `wsRef` (current WebSocket), and a `hasPreviouslyConnected` ref that tracks whether a successful open has occurred at least once (used to gate the reconnect invalidation). On each `open` event: if `hasPreviouslyConnected.current` is true, call `invalidateQueries({ queryKey: ['trades'] })` and reset `attemptRef`. On each `close` event: increment `attemptRef`, compute delay = `Math.min(1000 * 2 ** (attemptRef.current - 1), 8000)`, schedule a `setTimeout` to create a new WebSocket. On message: JSON.parse, branch on `event`, apply the appropriate `setQueryData` update. On unmount: `ws.close()` and clear any pending setTimeout.

  Backoff formula to match spec exactly (attempt 1=1000, 2=2000, 3=4000, 4+=8000):
  ```ts
  const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
  ```

- [ ] Step 4: Run test to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/hooks/useWebSocket.test.ts`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/src/hooks/useWebSocket.ts frontend/src/tests/hooks/useWebSocket.test.ts
  git commit -m "feat(frontend): add useWebSocket hook with exponential backoff and cache update handlers"
  ```
