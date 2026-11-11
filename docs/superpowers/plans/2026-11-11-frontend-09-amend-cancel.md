# Frontend: Amend Trade Form + Cancel Confirm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `AmendTradeForm` with a no-change guard and `CancelConfirm` with 409 cache reconciliation — completing all CRUD flows.

**Architecture:** `AmendTradeForm` pre-populates react-hook-form with the current trade values. It watches form values and disables Submit when nothing has changed. On 409 it notifies, calls `invalidateQueries(['trades'])`, and closes. On 5xx it notifies without closing, preserving form values. `CancelConfirm` renders a confirmation dialog with no optimistic update — the cache is only modified by the WebSocket `trade:cancelled` broadcast after a successful confirm. On 409 it notifies and calls `invalidateQueries(['trades'])` to reconcile any stale ACTIVE state.

**Tech Stack:** `react-hook-form`, `@hookform/resolvers/zod`, `zod`, `@tanstack/react-query`, `@tpicap/shared`

**Specs:**
- `docs/specs/amend-trade.md`
- `docs/specs/cancel-trade.md`

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

4. **Amend no-change guard** — submitting the form with values identical to the current trade must not dispatch any HTTP request. Task 9 adds a component test for this.
5. **Cancel 409 reconciliation** — a 409 from the cancel endpoint must trigger `invalidateQueries(['trades'])`, not leave the stale ACTIVE trade in the cache. Task 9 adds a component test for this.

---

### Task 9: Amend Trade Form + Cancel Confirm

**Files:**
- Create: `frontend/src/components/AmendTradeForm.tsx`
- Create: `frontend/src/components/CancelConfirm.tsx`
- Create: `frontend/src/tests/components/AmendTradeForm.test.tsx`
- Create: `frontend/src/tests/components/CancelConfirm.test.tsx`

**Interfaces:**
- Consumes: `AmendTradeSchema` from `@tpicap/shared`; `amendTrade`, `cancelTrade` from `api/trades`; `useQueryClient`, `useMutation` from TanStack Query; `Trade` from `@tpicap/shared`; `ApiError` from `api/trades`
- Produces:
  - `AmendTradeForm({ trade, onClose }: AmendTradeFormProps)` — pre-populated react-hook-form; no-change guard prevents submission when values are identical to `trade`; on 409: notify + invalidateQueries + onClose; on 5xx/network: notify with form values intact
  - `CancelConfirm({ trade, onClose }: CancelConfirmProps)` — confirmation prompt; on confirm: calls `cancelTrade`; on 409: notify + invalidateQueries; no optimistic update

- [ ] Step 1: Write the failing tests

  `src/tests/components/AmendTradeForm.test.tsx`:
  ```ts
  it('opens pre-populated with the trade current values', () => {
    const trade = makeTrade({ quantity: 100, price: 227, trader: 'Alice', book: 'BOOK1', counterparty: 'CPT1' });
    const { getByLabelText } = render(<AmendTradeForm trade={trade} onClose={vi.fn()} />, { wrapper });
    expect(getByLabelText('Quantity')).toHaveValue(100);
    expect(getByLabelText('Price')).toHaveValue(227);
    expect(getByLabelText('Trader')).toHaveValue('Alice');
    expect(getByLabelText('Book')).toHaveValue('BOOK1');
    expect(getByLabelText('Counterparty')).toHaveValue('CPT1');
  });

  it('Submit button is disabled when form values are identical to the current trade', () => {
    const trade = makeTrade({ quantity: 100, price: 227 });
    const { getByText } = render(<AmendTradeForm trade={trade} onClose={vi.fn()} />, { wrapper });
    expect(getByText('Submit')).toBeDisabled();
  });

  it('does not call amendTrade when submitted with no changes (no-change guard)', async () => {
    const trade = makeTrade({ quantity: 100, price: 227 });
    const { getByText } = render(<AmendTradeForm trade={trade} onClose={vi.fn()} />, { wrapper });
    // The submit button is disabled so click has no effect; verify amendTrade is not called
    await userEvent.click(getByText('Submit'));
    expect(amendTrade).not.toHaveBeenCalled();
  });

  it('enables Submit and calls amendTrade when at least one field is changed', async () => {
    vi.mocked(amendTrade).mockResolvedValue(makeTrade({ quantity: 200 }) as Trade);
    const trade = makeTrade({ id: 'TRD-100001', quantity: 100 });
    const { getByLabelText, getByText } = render(<AmendTradeForm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.clear(getByLabelText('Quantity'));
    await userEvent.type(getByLabelText('Quantity'), '200');
    expect(getByText('Submit')).not.toBeDisabled();
    await userEvent.click(getByText('Submit'));
    expect(amendTrade).toHaveBeenCalledWith('TRD-100001', expect.objectContaining({ quantity: 200 }));
  });

  it('shows inline error for quantity: 0', async () => {
    const trade = makeTrade({ quantity: 100 });
    const { getByLabelText, getByText } = render(<AmendTradeForm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.clear(getByLabelText('Quantity'));
    await userEvent.type(getByLabelText('Quantity'), '0');
    await userEvent.click(getByText('Submit'));
    expect(getByText(/must be a positive/i)).toBeInTheDocument();
    expect(amendTrade).not.toHaveBeenCalled();
  });

  it('shows error notification and closes form on 409 response', async () => {
    vi.mocked(amendTrade).mockRejectedValue(new ApiError(409, 'Cancelled trades cannot be amended'));
    const onClose = vi.fn();
    const queryClient = createTestQueryClient();
    const trade = makeTrade({ id: 'TRD-100001', quantity: 100 });
    const { getByLabelText, getByText } = render(
      <AmendTradeForm trade={trade} onClose={onClose} />,
      { wrapper: makeWrapper(queryClient) }
    );
    await userEvent.clear(getByLabelText('Quantity'));
    await userEvent.type(getByLabelText('Quantity'), '200');
    await userEvent.click(getByText('Submit'));
    await waitFor(() => {
      expect(getByText(/cannot be amended/i)).toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryState(['trades'])?.isInvalidated).toBe(true);
    });
  });

  it('calls invalidateQueries(["trades"]) on 409 response', async () => {
    vi.mocked(amendTrade).mockRejectedValue(new ApiError(409, 'Conflict'));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const trade = makeTrade({ quantity: 100 });
    const { getByLabelText, getByText } = render(<AmendTradeForm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.clear(getByLabelText('Quantity'));
    await userEvent.type(getByLabelText('Quantity'), '200');
    await userEvent.click(getByText('Submit'));
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trades'] })
    );
  });

  it('preserves form values on 500 / network failure', async () => {
    vi.mocked(amendTrade).mockRejectedValue(new ApiError(500, 'error'));
    const trade = makeTrade({ quantity: 100 });
    const { getByLabelText, getByText } = render(<AmendTradeForm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.clear(getByLabelText('Quantity'));
    await userEvent.type(getByLabelText('Quantity'), '200');
    await userEvent.click(getByText('Submit'));
    await waitFor(() => expect(getByText(/failed/i)).toBeInTheDocument());
    expect(getByLabelText('Quantity')).toHaveValue(200);
  });
  ```

  `src/tests/components/CancelConfirm.test.tsx`:
  ```ts
  it('renders confirmation prompt with trade id', () => {
    const trade = makeTrade({ id: 'TRD-100001' });
    const { getByText } = render(<CancelConfirm trade={trade} onClose={vi.fn()} />, { wrapper });
    expect(getByText(/TRD-100001/)).toBeInTheDocument();
    expect(getByText('Confirm')).toBeInTheDocument();
    expect(getByText('Cancel')).toBeInTheDocument();
  });

  it('does not call cancelTrade if confirmation is dismissed', async () => {
    const trade = makeTrade({ id: 'TRD-100001' });
    const onClose = vi.fn();
    const { getByText } = render(<CancelConfirm trade={trade} onClose={onClose} />, { wrapper });
    await userEvent.click(getByText('Cancel'));
    expect(cancelTrade).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls cancelTrade with trade id on confirmation', async () => {
    vi.mocked(cancelTrade).mockResolvedValue(makeTrade({ status: 'CANCELLED' }) as Trade);
    const trade = makeTrade({ id: 'TRD-100001' });
    const { getByText } = render(<CancelConfirm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.click(getByText('Confirm'));
    expect(cancelTrade).toHaveBeenCalledWith('TRD-100001');
  });

  it('calls onClose after successful cancellation', async () => {
    vi.mocked(cancelTrade).mockResolvedValue(makeTrade({ status: 'CANCELLED' }) as Trade);
    const onClose = vi.fn();
    const trade = makeTrade({ id: 'TRD-100001' });
    const { getByText } = render(<CancelConfirm trade={trade} onClose={onClose} />, { wrapper });
    await userEvent.click(getByText('Confirm'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows error notification on 409 response (already cancelled)', async () => {
    vi.mocked(cancelTrade).mockRejectedValue(new ApiError(409, 'Trade is already cancelled'));
    const trade = makeTrade({ id: 'TRD-100001' });
    const { getByText } = render(<CancelConfirm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.click(getByText('Confirm'));
    await waitFor(() => expect(getByText(/already been cancelled/i)).toBeInTheDocument());
  });

  it('calls invalidateQueries(["trades"]) on 409 to reconcile stale cache', async () => {
    vi.mocked(cancelTrade).mockRejectedValue(new ApiError(409, 'Trade is already cancelled'));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const trade = makeTrade({ id: 'TRD-100001', status: 'ACTIVE' });
    const { getByText } = render(<CancelConfirm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.click(getByText('Confirm'));
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trades'] })
    );
  });

  it('does not change trade status in the UI on 500 / network failure (no optimistic update)', async () => {
    vi.mocked(cancelTrade).mockRejectedValue(new ApiError(500, 'error'));
    const trade = makeTrade({ id: 'TRD-100001', status: 'ACTIVE' });
    queryClient.setQueryData(['trades'], [trade]);
    const { getByText } = render(<CancelConfirm trade={trade} onClose={vi.fn()} />, { wrapper });
    await userEvent.click(getByText('Confirm'));
    await waitFor(() => expect(getByText(/failed/i)).toBeInTheDocument());
    const trades = queryClient.getQueryData<Trade[]>(['trades']);
    expect(trades?.[0].status).toBe('ACTIVE');
  });
  ```

- [ ] Step 2: Run tests to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/components/AmendTradeForm.test.tsx src/tests/components/CancelConfirm.test.tsx`
  Expected: FAIL — components not found

- [ ] Step 3: Implement `src/components/AmendTradeForm.tsx` and `src/components/CancelConfirm.tsx`

  `AmendTradeForm.tsx` — `useForm<AmendTradeInput>({ resolver: zodResolver(AmendTradeSchema), defaultValues: { quantity: trade.quantity, price: trade.price, trader: trade.trader, book: trade.book, counterparty: trade.counterparty } })`. No-change guard: compare `watch()` values against the current trade; if all equal, set Submit button `disabled`. On mutation success: `onClose()`. On mutation error: if `error instanceof ApiError && error.status === 409`: set notification state ("This trade has been cancelled and cannot be amended"), call `queryClient.invalidateQueries({ queryKey: ['trades'] })`, call `onClose()`; for other errors: set notification state ("Failed to amend trade. Please try again.") without calling `onClose`.

  `CancelConfirm.tsx` — renders a confirmation dialog: "Are you sure you want to cancel trade TRD-XXXXXX?" with Confirm and Cancel buttons. The Cancel button calls `onClose()` without dispatching any request. The Confirm button calls `useMutation({ mutationFn: () => cancelTrade(trade.id) })`. On success: `onClose()`. On error: if `status === 409`: notify ("This trade has already been cancelled"), `invalidateQueries({ queryKey: ['trades'] })`; for other errors: notify ("Failed to cancel trade. Please try again."). No optimistic update is applied at any point — the trades cache is only modified when the mutation succeeds (via the WebSocket `trade:cancelled` event that the server broadcasts).

- [ ] Step 4: Run tests to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/components/AmendTradeForm.test.tsx src/tests/components/CancelConfirm.test.tsx`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/src/components/AmendTradeForm.tsx frontend/src/components/CancelConfirm.tsx frontend/src/tests/components/AmendTradeForm.test.tsx frontend/src/tests/components/CancelConfirm.test.tsx
  git commit -m "feat(frontend): add AmendTradeForm with no-change guard and CancelConfirm with 409 reconciliation"
  ```

---

## Full Test Run

After all 9 tasks are complete, run the full test suite to verify nothing is broken:

```
pnpm --filter frontend test
```

Expected: all tests PASS with no skipped tests.
