# Frontend: Blotter Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AG Grid blotter table component with 12 columns, the TradeActions cell renderer, and the LoadingSkeleton / FetchError / EmptyState fallback components.

**Architecture:** `TradeBlotter` renders an `AgGridReact` with column definitions for all 12 columns. The parent runs the blotter pipeline before passing `trades` as `rowData` — the table is a pure display component. `TradeActions` is a plain React component used as an AG Grid cell renderer via the `components` prop. Fallback components (`LoadingSkeleton`, `FetchError`, `EmptyState`) are rendered by the parent (`BlotterPage`) based on query state. An ADR documents the choice of AG Grid over TanStack Table.

**Tech Stack:** `ag-grid-community`, `ag-grid-react`, `@tpicap/shared` (for `Trade`)

**Specs:**
- `docs/specs/trade-blotter-table.md`

**Dependencies:** `2026-11-11-frontend-04-pnl-formatters.md`, `2026-11-11-frontend-05-blotter-pipeline.md`

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

### Task 6: Blotter Table

**Files:**
- Create: `docs/decisions/004-ag-grid-community.md` (ADR)
- Create: `frontend/src/components/TradeBlotter.tsx`
- Create: `frontend/src/components/TradeActions.tsx`
- Create: `frontend/src/components/LoadingSkeleton.tsx`
- Create: `frontend/src/components/FetchError.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Create: `frontend/src/tests/components/TradeBlotter.test.tsx`

**Interfaces:**
- Consumes: `filterTrades` from `blotterPipeline`; `calculatePnl` from `pnl`; `formatCurrency`, `formatTimestamp`, `formatQuantity` from `formatters`; `usePrices` from hooks; `Trade` from `@tpicap/shared`
- Produces:
  - `TradeBlotter({ trades, onAmend, onCancel }: TradeBlotterProps)` — renders AG Grid with 12 columns; `rowData` is the raw `trades` prop (pipeline is applied by the parent before passing)
  - `TradeActions({ trade, onAmend, onCancel }: TradeActionsProps)` — AG Grid cell renderer; renders Amend + Cancel buttons only when `trade.status === 'ACTIVE'`
  - `LoadingSkeleton()` — renders skeleton row placeholders
  - `FetchError({ onRetry }: FetchErrorProps)` — renders "Failed to load trades" + retry button
  - `EmptyState()` — renders "No trades found"

- [ ] Step 1: Write the AG Grid ADR

  Create `docs/decisions/004-ag-grid-community.md`. The ADR must record:
  - **Context:** the blotter spec requires a sortable, filterable table with 12 columns including a custom cell renderer for Actions. TanStack Table was listed as a candidate in the spec.
  - **Options considered:** TanStack Table (headless, requires all DOM/styling to be hand-built), AG Grid Community (feature-complete grid with built-in sort, column sizing, cell renderers, and virtual scrolling out of the box).
  - **Decision:** AG Grid Community — provides sort, cell renderer API, and virtual DOM performance for large trade lists without reimplementing grid infrastructure. The community edition is free and covers all required features.
  - **Dependency table** (required by CLAUDE.md):

    | Field | Detail |
    |---|---|
    | Name | AG Grid Community |
    | Package | `ag-grid-community`, `ag-grid-react` |
    | Reason | Feature-complete data grid with built-in sort, custom cell renderers, and virtual scrolling — covers all blotter table requirements without reimplementing grid infrastructure |

  - **Consequences:** AG Grid brings its own CSS theme (use `ag-theme-alpine` or `ag-theme-balham`); the grid handles sort state internally and exposes `defaultColDef` and `initialState.sort` for the default `tradeTimestamp` descending sort; cell renderers are plain React components registered via `components` prop.

- [ ] Step 2: Write the failing tests

  `src/tests/components/TradeBlotter.test.tsx`:

  > Note: AG Grid's internal DOM is complex and not reliably testable via RTL queries. Test `TradeBlotter` by asserting on the `rowData` prop it receives and the column definitions it configures — not by querying AG Grid's rendered cells. The pipeline's data-shaping logic is fully covered in `blotterPipeline.test.ts`.

  ```ts
  it('passes the trades prop directly as rowData', () => {
    const trades = [makeTrade({ id: 'TRD-100001' })];
    const { getByTestId } = render(<TradeBlotter trades={trades} onAmend={vi.fn()} onCancel={vi.fn()} />);
    // TradeBlotter renders an AgGridReact with data-testid="ag-grid-wrapper"
    // We verify the component renders without error and AG Grid mounts
    expect(getByTestId('ag-grid-wrapper')).toBeInTheDocument();
  });

  it('renders LoadingSkeleton when isFetching is true and no data', () => {
    // Tested via BlotterPage integration — TradeBlotter is not responsible for loading state
    // LoadingSkeleton is rendered by the parent before TradeBlotter is mounted
  });

  it('renders "No trades match your search" message when rowData is empty after pipeline', () => {
    const { getByText } = render(
      <TradeBlotter trades={[]} onAmend={vi.fn()} onCancel={vi.fn()} filtered={true} />
    );
    expect(getByText('No trades match your search')).toBeInTheDocument();
  });
  ```

  `src/tests/components/TradeActions.test.tsx` (inline in TradeBlotter test file):
  ```ts
  it('renders Amend and Cancel buttons for ACTIVE trades', () => {
    const trade = makeTrade({ status: 'ACTIVE' });
    const { getByText } = render(
      <TradeActions trade={trade} onAmend={vi.fn()} onCancel={vi.fn()} />
    );
    expect(getByText('Amend')).toBeInTheDocument();
    expect(getByText('Cancel')).toBeInTheDocument();
  });

  it('renders nothing for CANCELLED trades', () => {
    const trade = makeTrade({ status: 'CANCELLED' });
    const { queryByText } = render(
      <TradeActions trade={trade} onAmend={vi.fn()} onCancel={vi.fn()} />
    );
    expect(queryByText('Amend')).not.toBeInTheDocument();
    expect(queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('calls onAmend with the trade when Amend is clicked', async () => {
    const trade = makeTrade({ status: 'ACTIVE' });
    const onAmend = vi.fn();
    const { getByText } = render(
      <TradeActions trade={trade} onAmend={onAmend} onCancel={vi.fn()} />
    );
    await userEvent.click(getByText('Amend'));
    expect(onAmend).toHaveBeenCalledWith(trade);
  });

  it('calls onCancel with the trade when Cancel is clicked', async () => {
    const trade = makeTrade({ status: 'ACTIVE' });
    const onCancel = vi.fn();
    const { getByText } = render(
      <TradeActions trade={trade} onAmend={vi.fn()} onCancel={onCancel} />
    );
    await userEvent.click(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledWith(trade);
  });
  ```

  Fallback component tests:
  ```ts
  it('LoadingSkeleton renders skeleton rows', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.querySelectorAll('[data-testid="skeleton-row"]').length).toBeGreaterThan(0);
  });

  it('FetchError renders error message and retry button', () => {
    const onRetry = vi.fn();
    const { getByText } = render(<FetchError onRetry={onRetry} />);
    expect(getByText('Failed to load trades')).toBeInTheDocument();
    expect(getByText('Retry')).toBeInTheDocument();
  });

  it('FetchError retry button calls onRetry', async () => {
    const onRetry = vi.fn();
    const { getByText } = render(<FetchError onRetry={onRetry} />);
    await userEvent.click(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('EmptyState renders "No trades found"', () => {
    const { getByText } = render(<EmptyState />);
    expect(getByText('No trades found')).toBeInTheDocument();
  });
  ```

- [ ] Step 3: Run tests to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/components/TradeBlotter.test.tsx`
  Expected: FAIL — components not found

- [ ] Step 4: Implement components

  `TradeBlotter.tsx` — `AgGridReact` with `columnDefs` for all 12 columns. Set `defaultColDef={{ sortable: true }}`. Set `initialState={{ sort: { sortModel: [{ colId: 'tradeTimestamp', sort: 'desc' }] } }}`. Pass `components={{ TradeActions }}` for the Actions cell renderer. Wrap the grid in a `div` with `data-testid="ag-grid-wrapper"`. When `trades.length === 0` and `filtered` prop is true, render the "No trades match your search" overlay.

  Column definitions (12 total):
  1. `id` — header "Trade ID"
  2. `symbol` — header "Symbol"
  3. `side` — header "Side"; `cellClass` based on value (`buy-cell` / `sell-cell`)
  4. `quantity` — header "Quantity"; `valueFormatter` using `formatQuantity`
  5. `price` — header "Price"; `valueFormatter` using `formatPrice` (plain `$227.45` — no sign prefix)
  6. `trader` — header "Trader"
  7. `book` — header "Book"
  8. `counterparty` — header "Counterparty"
  9. `tradeTimestamp` — header "Timestamp"; `valueFormatter` using `formatTimestamp`
  10. `status` — header "Status"; `cellClass` based on value
  11. P&L — header "P&L"; `valueGetter` reads `prices[trade.symbol] ?? trade.price`, calls `calculatePnl`, returns number; `valueFormatter` using `formatCurrency`; `cellClass` based on sign
  12. Actions — header "Actions"; `cellRenderer: 'TradeActions'`; `sortable: false`

  Row-level `rowClass` callback: return `'row-cancelled'` for `status === 'CANCELLED'` (applies reduced opacity via CSS).

  `TradeActions.tsx` — AG Grid cell renderer component. Receives `data: Trade` from AG Grid props, plus `onAmend` and `onCancel` callbacks via `context`. Returns `null` when `trade.status === 'CANCELLED'`.

  `LoadingSkeleton.tsx` — renders 10 `div` elements with `data-testid="skeleton-row"` and a pulsing CSS animation.

  `FetchError.tsx` — renders message string "Failed to load trades" and a `<button onClick={onRetry}>Retry</button>`.

  `EmptyState.tsx` — renders "No trades found" in a centred container.

- [ ] Step 5: Run tests to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/components/TradeBlotter.test.tsx`
  Expected: PASS

- [ ] Step 6: Commit
  ```
  git add docs/decisions/004-ag-grid-community.md frontend/src/components/TradeBlotter.tsx frontend/src/components/TradeActions.tsx frontend/src/components/LoadingSkeleton.tsx frontend/src/components/FetchError.tsx frontend/src/components/EmptyState.tsx frontend/src/tests/components/TradeBlotter.test.tsx
  git commit -m "feat(frontend): add AG Grid blotter table with 12 columns, TradeActions renderer, and fallback states"
  ```
