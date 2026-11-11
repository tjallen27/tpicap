import { it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Trade } from '@tpicap/shared';
import { ApiError } from '../../api/trades';
import { AmendTradeForm } from '../../components/AmendTradeForm';

vi.mock('../../api/trades', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/trades')>();
  return { ...actual, amendTrade: vi.fn() };
});

import { amendTrade } from '../../api/trades';

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
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

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  qc.setQueryData(['trades'], []);
  return function WrapperComponent({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const queryClient = createTestQueryClient();
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

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
  await userEvent.click(getByText('Submit'));
  expect(amendTrade).not.toHaveBeenCalled();
});

it('enables Submit and calls amendTrade when at least one field is changed', async () => {
  vi.mocked(amendTrade).mockResolvedValue(makeTrade({ quantity: 200 }));
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
  const testQueryClient = createTestQueryClient();
  const trade = makeTrade({ id: 'TRD-100001', quantity: 100 });
  const { getByLabelText, getByText } = render(
    <AmendTradeForm trade={trade} onClose={onClose} />,
    { wrapper: makeWrapper(testQueryClient) },
  );
  await userEvent.clear(getByLabelText('Quantity'));
  await userEvent.type(getByLabelText('Quantity'), '200');
  await userEvent.click(getByText('Submit'));
  await waitFor(() => {
    expect(getByText(/cannot be amended/i)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(testQueryClient.getQueryState(['trades'])?.isInvalidated).toBe(true);
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trades'] }),
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
