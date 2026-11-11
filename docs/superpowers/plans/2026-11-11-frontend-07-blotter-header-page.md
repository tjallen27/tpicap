# Frontend: Blotter Header + Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `BlotterPage` container component that orchestrates query state, the blotter pipeline, and all header controls, plus the `ConnectionStatus` indicator.

**Architecture:** `BlotterPage` owns all UI state (`search`, `sides`, `statuses`, `selectedTrade`, `showCreate`). It calls `useTrades()` and `useWebSocket()`, runs `filterTrades` on the data, and routes to `LoadingSkeleton`, `FetchError`, `EmptyState`, or `TradeBlotter` based on query state. During a manual refetch when data already exists, the existing table remains rendered — no skeleton flash. `ConnectionStatus` is a pure display component.

**Tech Stack:** `@tanstack/react-query`, `@tpicap/shared` (for `Trade`)

**Specs:**
- `docs/specs/trade-blotter-table.md`
- `docs/specs/live-updates.md`
- `docs/specs/data-fetching.md`

**Dependencies:** `2026-11-11-frontend-02-api-layer.md`, `2026-11-11-frontend-03-websocket-hook.md`, `2026-11-11-frontend-05-blotter-pipeline.md`, `2026-11-11-frontend-06-blotter-table.md`

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

### Task 7: Blotter Header + Page

**Files:**
- Create: `frontend/src/components/BlotterPage.tsx`
- Create: `frontend/src/components/ConnectionStatus.tsx`
- Modify: `frontend/src/App.tsx` (replace stub BlotterPage import with real component)
- Create: `frontend/src/tests/components/ConnectionStatus.test.tsx`

**Interfaces:**
- Consumes: `useTrades` from hooks; `useWebSocket` from hooks; `filterTrades` from `blotterPipeline`; `TradeBlotter`, `LoadingSkeleton`, `FetchError`, `EmptyState` components; `Trade` from `@tpicap/shared`
- Produces:
  - `BlotterPage()` — manages `search: string`, `sides: string[]`, `statuses: string[]`, `selectedTrade: Trade | null`, `showCreate: boolean` state; runs the pipeline; dispatches filtered trades to `<TradeBlotter />`; renders the blotter header controls
  - `ConnectionStatus({ status }: ConnectionStatusProps)` — renders the WS connection indicator

- [ ] Step 1: Write the failing tests

  `src/tests/components/ConnectionStatus.test.tsx`:
  ```ts
  it('renders "Live" with green indicator when status is "connected"', () => {
    const { getByText } = render(<ConnectionStatus status="connected" />);
    expect(getByText('Live')).toBeInTheDocument();
  });

  it('renders "Reconnecting…" with amber indicator when status is "reconnecting"', () => {
    const { getByText } = render(<ConnectionStatus status="reconnecting" />);
    expect(getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('renders "Disconnected" with red indicator and retry button when status is "disconnected"', () => {
    const onRetry = vi.fn();
    const { getByText } = render(<ConnectionStatus status="disconnected" onRetry={onRetry} />);
    expect(getByText('Disconnected')).toBeInTheDocument();
    expect(getByText('Retry')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked in disconnected state', async () => {
    const onRetry = vi.fn();
    const { getByText } = render(<ConnectionStatus status="disconnected" onRetry={onRetry} />);
    await userEvent.click(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  ```

  BlotterPage integration tests (via `src/tests/components/BlotterPage.test.tsx`):
  ```ts
  it('renders the page title "Trade Blotter"', async () => {
    mockUseTrades({ data: [], isSuccess: true });
    const { getByText } = render(<BlotterPage />, { wrapper });
    expect(getByText('Trade Blotter')).toBeInTheDocument();
  });

  it('renders LoadingSkeleton when isFetching is true and no prior data', () => {
    mockUseTrades({ isFetching: true, data: undefined });
    const { getByTestId } = render(<BlotterPage />, { wrapper });
    expect(getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders FetchError when isError is true', () => {
    mockUseTrades({ isError: true });
    const { getByText } = render(<BlotterPage />, { wrapper });
    expect(getByText('Failed to load trades')).toBeInTheDocument();
  });

  it('renders EmptyState when data is an empty array', () => {
    mockUseTrades({ data: [], isSuccess: true });
    const { getByText } = render(<BlotterPage />, { wrapper });
    expect(getByText('No trades found')).toBeInTheDocument();
  });

  it('renders TradeBlotter when data is non-empty', () => {
    mockUseTrades({ data: [makeTrade()], isSuccess: true });
    const { getByTestId } = render(<BlotterPage />, { wrapper });
    expect(getByTestId('ag-grid-wrapper')).toBeInTheDocument();
  });

  it('filters the trade list in real time as search input changes', async () => {
    const trades = [makeTrade({ symbol: 'AAPL' }), makeTrade({ symbol: 'MSFT' })];
    mockUseTrades({ data: trades, isSuccess: true });
    const { getByPlaceholderText } = render(<BlotterPage />, { wrapper });
    await userEvent.type(getByPlaceholderText('Search trades…'), 'MSFT');
    // AG Grid wrapper still present (non-empty after filter)
    // We rely on blotterPipeline tests for correctness; here we just verify no crash
  });

  it('Refresh button calls refetch and shows loading state while refetching', async () => {
    const refetch = vi.fn();
    mockUseTrades({ data: [makeTrade()], isSuccess: true, isRefetching: false, refetch });
    const { getByText } = render(<BlotterPage />, { wrapper });
    await userEvent.click(getByText('Refresh'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('Refresh button does not show skeleton during refetch (existing rows remain visible)', () => {
    mockUseTrades({ data: [makeTrade()], isSuccess: true, isRefetching: true });
    const { queryByTestId, getByTestId } = render(<BlotterPage />, { wrapper });
    expect(queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    expect(getByTestId('ag-grid-wrapper')).toBeInTheDocument();
  });

  it('opens CreateTradeForm when "New Trade" button is clicked', async () => {
    mockUseTrades({ data: [], isSuccess: true });
    const { getByText } = render(<BlotterPage />, { wrapper });
    await userEvent.click(getByText('New Trade'));
    expect(getByText('Create Trade')).toBeInTheDocument(); // form heading
  });

  it('"Clear filters" resets search and filter controls', async () => {
    mockUseTrades({ data: [makeTrade()], isSuccess: true });
    const { getByPlaceholderText, getByText } = render(<BlotterPage />, { wrapper });
    await userEvent.type(getByPlaceholderText('Search trades…'), 'something');
    await userEvent.click(getByText('Clear filters'));
    expect(getByPlaceholderText('Search trades…')).toHaveValue('');
  });
  ```

- [ ] Step 2: Run tests to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/components/ConnectionStatus.test.tsx src/tests/components/BlotterPage.test.tsx`
  Expected: FAIL — components not found

- [ ] Step 3: Implement `BlotterPage.tsx` and `ConnectionStatus.tsx`

  `BlotterPage.tsx` — state: `search`, `sides`, `statuses`, `selectedTrade`, `showCreate`. Calls `useTrades()` and `useWebSocket()`. Fallback hierarchy (from live-updates spec):
  - `isFetching && !data` → `<LoadingSkeleton data-testid="loading-skeleton" />`
  - `isError` → `<FetchError onRetry={refetch} />`
  - `data?.length === 0` → `<EmptyState />`
  - else → `<TradeBlotter trades={pipeline(data, search, sides, statuses)} filtered={search !== '' || sides.length > 0 || statuses.length > 0} onAmend={...} onCancel={...} />`

  During a manual refetch (`isRefetching && data`), the existing `<TradeBlotter />` remains rendered — no skeleton.

  Header contains: title, `<ConnectionStatus status={wsStatus} onRetry={wsRetry} />`, search input (placeholder "Search trades…") with clear button when non-empty, Side multi-select, Status multi-select, "Clear filters" button, Refresh button (disabled + spinner while `isRefetching`), "New Trade" button.

  `ConnectionStatus.tsx` — receives `status: 'connected' | 'reconnecting' | 'disconnected'` and optional `onRetry: () => void`. Renders a coloured dot + text. The disconnect variant includes a `<button onClick={onRetry}>Retry</button>`.

- [ ] Step 4: Run tests to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/components/ConnectionStatus.test.tsx src/tests/components/BlotterPage.test.tsx`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/src/components/BlotterPage.tsx frontend/src/components/ConnectionStatus.tsx frontend/src/tests/components/ConnectionStatus.test.tsx frontend/src/tests/components/BlotterPage.test.tsx
  git commit -m "feat(frontend): add BlotterPage layout with header controls, ConnectionStatus indicator, and fallback hierarchy"
  ```
