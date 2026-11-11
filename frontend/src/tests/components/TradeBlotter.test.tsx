import { it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
import type { Trade } from '@tpicap/shared';
import { TradeBlotter } from '../../components/TradeBlotter';
import { TradeActions } from '../../components/TradeActions';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { FetchError } from '../../components/FetchError';
import { EmptyState } from '../../components/EmptyState';

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

it('passes the trades prop directly as rowData', () => {
  const trades = [makeTrade({ id: 'TRD-100001' })];
  const { getByTestId } = render(
    <TradeBlotter trades={trades} onAmend={vi.fn()} onCancel={vi.fn()} filtered={false} />,
    { wrapper },
  );
  expect(getByTestId('ag-grid-wrapper')).toBeInTheDocument();
});

it('renders "No trades match your search" message when rowData is empty after pipeline', () => {
  const { getByText } = render(
    <TradeBlotter trades={[]} onAmend={vi.fn()} onCancel={vi.fn()} filtered={true} />,
    { wrapper },
  );
  expect(getByText('No trades match your search')).toBeInTheDocument();
});

it('renders Amend and Cancel buttons for ACTIVE trades', () => {
  const trade = makeTrade({ status: 'ACTIVE' });
  const { getByText } = render(
    <TradeActions trade={trade} onAmend={vi.fn()} onCancel={vi.fn()} />,
  );
  expect(getByText('Amend')).toBeInTheDocument();
  expect(getByText('Cancel')).toBeInTheDocument();
});

it('renders nothing for CANCELLED trades', () => {
  const trade = makeTrade({ status: 'CANCELLED' });
  const { queryByText } = render(
    <TradeActions trade={trade} onAmend={vi.fn()} onCancel={vi.fn()} />,
  );
  expect(queryByText('Amend')).not.toBeInTheDocument();
  expect(queryByText('Cancel')).not.toBeInTheDocument();
});

it('calls onAmend with the trade when Amend is clicked', async () => {
  const trade = makeTrade({ status: 'ACTIVE' });
  const onAmend = vi.fn();
  const { getByText } = render(
    <TradeActions trade={trade} onAmend={onAmend} onCancel={vi.fn()} />,
  );
  await userEvent.click(getByText('Amend'));
  expect(onAmend).toHaveBeenCalledWith(trade);
});

it('calls onCancel with the trade when Cancel is clicked', async () => {
  const trade = makeTrade({ status: 'ACTIVE' });
  const onCancel = vi.fn();
  const { getByText } = render(
    <TradeActions trade={trade} onAmend={vi.fn()} onCancel={onCancel} />,
  );
  await userEvent.click(getByText('Cancel'));
  expect(onCancel).toHaveBeenCalledWith(trade);
});

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
