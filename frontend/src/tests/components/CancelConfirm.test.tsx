import { it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Trade } from '@tpicap/shared';
import { ApiError } from '../../api/trades';
import { CancelConfirm } from '../../components/CancelConfirm';

vi.mock('../../api/trades', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/trades')>();
  return { ...actual, cancelTrade: vi.fn() };
});

import { cancelTrade } from '../../api/trades';

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

const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

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
  vi.mocked(cancelTrade).mockResolvedValue(makeTrade({ status: 'CANCELLED' }));
  const trade = makeTrade({ id: 'TRD-100001' });
  const { getByText } = render(<CancelConfirm trade={trade} onClose={vi.fn()} />, { wrapper });
  await userEvent.click(getByText('Confirm'));
  expect(cancelTrade).toHaveBeenCalledWith('TRD-100001');
});

it('calls onClose after successful cancellation', async () => {
  vi.mocked(cancelTrade).mockResolvedValue(makeTrade({ status: 'CANCELLED' }));
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trades'] }),
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
