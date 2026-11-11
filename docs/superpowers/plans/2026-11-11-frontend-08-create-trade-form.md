# Frontend: Create Trade Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `CreateTradeForm` component with react-hook-form + Zod validation, mutation error handling, and form value preservation on failure.

**Architecture:** `CreateTradeForm` uses `useForm` with `zodResolver(CreateTradeSchema)` and `useMutation` with `mutationFn: createTrade`. On success it calls `onClose`. On mutation error it sets a local `errorMessage` state without calling `onClose`, preserving form values. The component is wrapped in an `ErrorBoundary`. The symbol field stores its value as uppercase. The form sends only `CreateTradeSchema` fields — no `id`, `status`, or `tradeTimestamp`.

**Tech Stack:** `react-hook-form`, `@hookform/resolvers/zod`, `zod`, `@tanstack/react-query`, `@tpicap/shared`

**Specs:**
- `docs/specs/create-trade.md`

**Dependencies:** `2026-11-11-frontend-02-api-layer.md`, `2026-11-11-frontend-01-scaffold.md`

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

### Task 8: Create Trade Form

**Files:**
- Create: `frontend/src/components/CreateTradeForm.tsx`
- Create: `frontend/src/tests/components/CreateTradeForm.test.tsx`

**Interfaces:**
- Consumes: `CreateTradeSchema` from `@tpicap/shared`; `createTrade` from `api/trades`; `useQueryClient` from TanStack Query; `useMutation` from TanStack Query
- Produces:
  - `CreateTradeForm({ onClose }: CreateTradeFormProps)` — react-hook-form + zodResolver(CreateTradeSchema); calls `createTrade` via `useMutation`; on success: calls `onClose`; on 5xx/network error: shows notification with form values intact

- [ ] Step 1: Write the failing tests

  `src/tests/components/CreateTradeForm.test.tsx`:
  ```ts
  it('renders all 7 required fields', () => {
    const { getByLabelText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
    expect(getByLabelText('Symbol')).toBeInTheDocument();
    expect(getByLabelText('Side')).toBeInTheDocument();
    expect(getByLabelText('Quantity')).toBeInTheDocument();
    expect(getByLabelText('Price')).toBeInTheDocument();
    expect(getByLabelText('Trader')).toBeInTheDocument();
    expect(getByLabelText('Book')).toBeInTheDocument();
    expect(getByLabelText('Counterparty')).toBeInTheDocument();
  });

  it('shows validation errors when form is submitted empty', async () => {
    const { getByText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
    await userEvent.click(getByText('Submit'));
    expect(getByText(/symbol is required/i)).toBeInTheDocument();
  });

  it('shows validation error for quantity: 0', async () => {
    const { getByLabelText, getByText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
    await userEvent.type(getByLabelText('Quantity'), '0');
    await userEvent.click(getByText('Submit'));
    expect(getByText(/must be a positive/i)).toBeInTheDocument();
  });

  it('shows validation error for negative price', async () => {
    const { getByLabelText, getByText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
    await userEvent.type(getByLabelText('Price'), '-1');
    await userEvent.click(getByText('Submit'));
    expect(getByText(/must be a positive/i)).toBeInTheDocument();
  });

  it('calls createTrade with correctly shaped data on valid submission', async () => {
    vi.mocked(createTrade).mockResolvedValue(makeTrade() as Trade);
    const { getByLabelText, getByText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
    await userEvent.type(getByLabelText('Symbol'), 'AAPL');
    await userEvent.selectOptions(getByLabelText('Side'), 'BUY');
    await userEvent.type(getByLabelText('Quantity'), '100');
    await userEvent.type(getByLabelText('Price'), '227');
    await userEvent.type(getByLabelText('Trader'), 'Alice');
    await userEvent.type(getByLabelText('Book'), 'BOOK1');
    await userEvent.type(getByLabelText('Counterparty'), 'CPT1');
    await userEvent.click(getByText('Submit'));
    expect(createTrade).toHaveBeenCalledWith({
      symbol: 'AAPL', side: 'BUY', quantity: 100, price: 227,
      trader: 'Alice', book: 'BOOK1', counterparty: 'CPT1',
    });
  });

  it('calls onClose after a successful submission', async () => {
    vi.mocked(createTrade).mockResolvedValue(makeTrade() as Trade);
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(<CreateTradeForm onClose={onClose} />, { wrapper });
    // fill valid form then submit
    await fillValidCreateForm(getByLabelText, getByText);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('does not call onClose and shows error notification on 500 response', async () => {
    vi.mocked(createTrade).mockRejectedValue(new ApiError(500, 'Internal Server Error'));
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(<CreateTradeForm onClose={onClose} />, { wrapper });
    await fillValidCreateForm(getByLabelText, getByText);
    await waitFor(() => expect(getByText(/failed to create trade/i)).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('preserves form values after a failed submission', async () => {
    vi.mocked(createTrade).mockRejectedValue(new ApiError(500, 'error'));
    const { getByLabelText, getByText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
    await userEvent.type(getByLabelText('Symbol'), 'AAPL');
    await userEvent.click(getByText('Submit'));
    await waitFor(() => expect(getByText(/failed/i)).toBeInTheDocument());
    expect(getByLabelText('Symbol')).toHaveValue('AAPL');
  });

  it('does not send id or status in the request payload', async () => {
    vi.mocked(createTrade).mockResolvedValue(makeTrade() as Trade);
    const { getByLabelText, getByText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
    await fillValidCreateForm(getByLabelText, getByText);
    await waitFor(() => expect(createTrade).toHaveBeenCalled());
    const payload = vi.mocked(createTrade).mock.calls[0][0];
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('tradeTimestamp');
  });
  ```

- [ ] Step 2: Run tests to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/components/CreateTradeForm.test.tsx`
  Expected: FAIL — `CreateTradeForm` not found

- [ ] Step 3: Implement `src/components/CreateTradeForm.tsx`

  Use `useForm<CreateTradeInput>({ resolver: zodResolver(CreateTradeSchema) })`. Use `useMutation({ mutationFn: createTrade, onSuccess: onClose })`. On mutation error: set local `errorMessage` state to "Failed to create trade. Please try again." — displayed as an error notification above the form. The form is wrapped in `<ErrorBoundary>` per the create-trade spec. The symbol field stores its value as uppercase (via `onChange` transform or `setValueAs`).

- [ ] Step 4: Run tests to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/components/CreateTradeForm.test.tsx`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/src/components/CreateTradeForm.tsx frontend/src/tests/components/CreateTradeForm.test.tsx
  git commit -m "feat(frontend): add CreateTradeForm with react-hook-form, Zod validation, and mutation error handling"
  ```
