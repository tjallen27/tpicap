# Frontend: Blotter Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `filterTrades` pure function that applies quick search, side filter, and status filter in composition.

**Architecture:** A single pure function in `lib/blotterPipeline.ts`. Pipeline order: apply side filter → apply status filter → apply search. Empty filter arrays mean "no filter applied for that dimension" (pass-through). Search lowercases the term and checks `.toLowerCase().includes(term)` against `id`, `symbol`, `trader`, `book`, `counterparty` only — not quantity or price.

**Tech Stack:** `@tpicap/shared` (for `Trade`)

**Specs:**
- `docs/specs/trade-blotter-table.md`

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

3. **Filter + search + sort composition** — all three active simultaneously produces the correct subset. Task 5 adds a composed pipeline test.

---

### Task 5: Blotter Pipeline

**Files:**
- Create: `frontend/src/lib/blotterPipeline.ts`
- Create: `frontend/src/tests/lib/blotterPipeline.test.ts`

**Interfaces:**
- Consumes: `Trade` from `@tpicap/shared`
- Produces:
  - `filterTrades(trades: Trade[], search: string, sides: string[], statuses: string[]): Trade[]`

- [ ] Step 1: Write the failing tests

  `src/tests/lib/blotterPipeline.test.ts`:
  ```ts
  const makeTrade = (overrides: Partial<Trade>): Trade => ({
    id: 'TRD-100001',
    symbol: 'AAPL',
    side: 'BUY',
    quantity: 100,
    price: 227,
    trader: 'Alice',
    book: 'BOOK1',
    counterparty: 'CPT1',
    tradeTimestamp: '2026-11-11T10:00:00.000Z',
    status: 'ACTIVE',
    ...overrides,
  });

  // --- Quick search ---
  it('returns all trades when search is empty string', () => {
    const trades = [makeTrade({ id: 'TRD-100001' }), makeTrade({ id: 'TRD-100002' })];
    expect(filterTrades(trades, '', [], [])).toHaveLength(2);
  });

  it('filters by id (case-insensitive)', () => {
    const trades = [makeTrade({ id: 'TRD-100001' }), makeTrade({ id: 'TRD-200001' })];
    expect(filterTrades(trades, 'trd-1', [], [])).toEqual([trades[0]]);
  });

  it('filters by symbol (case-insensitive)', () => {
    const trades = [makeTrade({ symbol: 'AAPL' }), makeTrade({ symbol: 'MSFT' })];
    expect(filterTrades(trades, 'msft', [], [])).toEqual([trades[1]]);
  });

  it('filters by trader (case-insensitive)', () => {
    const trades = [makeTrade({ trader: 'Alice' }), makeTrade({ trader: 'Bob' })];
    expect(filterTrades(trades, 'alice', [], [])).toEqual([trades[0]]);
  });

  it('filters by book (case-insensitive)', () => {
    const trades = [makeTrade({ book: 'BOOK1' }), makeTrade({ book: 'BOOK2' })];
    expect(filterTrades(trades, 'book2', [], [])).toEqual([trades[1]]);
  });

  it('filters by counterparty (case-insensitive)', () => {
    const trades = [makeTrade({ counterparty: 'CPT1' }), makeTrade({ counterparty: 'CPT2' })];
    expect(filterTrades(trades, 'cpt1', [], [])).toEqual([trades[0]]);
  });

  it('returns empty array when search matches no trade', () => {
    const trades = [makeTrade({ symbol: 'AAPL' })];
    expect(filterTrades(trades, 'ZZZZZ', [], [])).toHaveLength(0);
  });

  it('does not search quantity or price fields', () => {
    const trades = [makeTrade({ quantity: 12345, price: 100 })];
    expect(filterTrades(trades, '12345', [], [])).toHaveLength(0);
  });

  // --- Side filter ---
  it('filters to only BUY trades when sides is ["BUY"]', () => {
    const trades = [makeTrade({ side: 'BUY' }), makeTrade({ side: 'SELL' })];
    expect(filterTrades(trades, '', ['BUY'], [])).toEqual([trades[0]]);
  });

  it('filters to only SELL trades when sides is ["SELL"]', () => {
    const trades = [makeTrade({ side: 'BUY' }), makeTrade({ side: 'SELL' })];
    expect(filterTrades(trades, '', ['SELL'], [])).toEqual([trades[1]]);
  });

  it('returns all trades when sides is empty (no filter)', () => {
    const trades = [makeTrade({ side: 'BUY' }), makeTrade({ side: 'SELL' })];
    expect(filterTrades(trades, '', [], [])).toHaveLength(2);
  });

  // --- Status filter ---
  it('filters to only ACTIVE trades when statuses is ["ACTIVE"]', () => {
    const trades = [makeTrade({ status: 'ACTIVE' }), makeTrade({ status: 'CANCELLED' })];
    expect(filterTrades(trades, '', [], ['ACTIVE'])).toEqual([trades[0]]);
  });

  it('filters to only CANCELLED trades when statuses is ["CANCELLED"]', () => {
    const trades = [makeTrade({ status: 'ACTIVE' }), makeTrade({ status: 'CANCELLED' })];
    expect(filterTrades(trades, '', [], ['CANCELLED'])).toEqual([trades[1]]);
  });

  // --- Combined (AND) ---
  it('applies search AND side filter together', () => {
    const trades = [
      makeTrade({ symbol: 'AAPL', side: 'BUY' }),
      makeTrade({ symbol: 'AAPL', side: 'SELL' }),
      makeTrade({ symbol: 'MSFT', side: 'BUY' }),
    ];
    // search "AAPL" AND side "BUY" => only first
    expect(filterTrades(trades, 'AAPL', ['BUY'], [])).toEqual([trades[0]]);
  });

  it('applies search AND status filter together', () => {
    const trades = [
      makeTrade({ symbol: 'AAPL', status: 'ACTIVE' }),
      makeTrade({ symbol: 'AAPL', status: 'CANCELLED' }),
    ];
    expect(filterTrades(trades, 'AAPL', [], ['ACTIVE'])).toEqual([trades[0]]);
  });

  it('applies search AND side AND status filters together — composed pipeline produces correct subset', () => {
    const trades = [
      makeTrade({ id: 'TRD-A', symbol: 'AAPL', side: 'BUY',  status: 'ACTIVE'    }),
      makeTrade({ id: 'TRD-B', symbol: 'AAPL', side: 'SELL', status: 'ACTIVE'    }),
      makeTrade({ id: 'TRD-C', symbol: 'AAPL', side: 'BUY',  status: 'CANCELLED' }),
      makeTrade({ id: 'TRD-D', symbol: 'MSFT', side: 'BUY',  status: 'ACTIVE'    }),
    ];
    // search "AAPL", side "BUY", status "ACTIVE" => only TRD-A
    const result = filterTrades(trades, 'AAPL', ['BUY'], ['ACTIVE']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('TRD-A');
  });
  ```

- [ ] Step 2: Run test to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/lib/blotterPipeline.test.ts`
  Expected: FAIL — `filterTrades` not found

- [ ] Step 3: Implement `src/lib/blotterPipeline.ts`

  Pure function. Pipeline order: apply side filter → apply status filter → apply search. Empty filter arrays mean "no filter applied for that dimension" (pass-through). Search lowercases the term and checks `.toLowerCase().includes(term)` against each of `id`, `symbol`, `trader`, `book`, `counterparty`.

- [ ] Step 4: Run test to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/lib/blotterPipeline.test.ts`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/src/lib/blotterPipeline.ts frontend/src/tests/lib/blotterPipeline.test.ts
  git commit -m "feat(frontend): add blotter pipeline — filterTrades pure function with composed filter+search"
  ```
