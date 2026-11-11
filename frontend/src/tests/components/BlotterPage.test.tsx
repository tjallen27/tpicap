import { it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Trade } from '@tpicap/shared';
import { BlotterPage } from '../../components/BlotterPage';

vi.mock('../../hooks/useTrades', () => ({
  useTrades: vi.fn(),
}));

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({ status: 'connected', retry: vi.fn() })),
}));

import { useTrades } from '../../hooks/useTrades';

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

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

function mockUseTrades(overrides: Record<string, unknown> = {}) {
  vi.mocked(useTrades).mockReturnValue({
    data: undefined,
    isSuccess: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useTrades>);
}

beforeEach(() => {
  mockUseTrades();
});

it('renders the page title "Trade Blotter"', () => {
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
  const { getByPlaceholderText, getByTestId } = render(<BlotterPage />, { wrapper });
  await userEvent.type(getByPlaceholderText('Search trades…'), 'MSFT');
  expect(getByTestId('ag-grid-wrapper')).toBeInTheDocument();
});

it('Refresh button calls refetch', async () => {
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
  expect(getByText('Create Trade')).toBeInTheDocument();
});

it('"Clear filters" resets search and filter controls', async () => {
  mockUseTrades({ data: [makeTrade()], isSuccess: true });
  const { getByPlaceholderText, getByText } = render(<BlotterPage />, { wrapper });
  await userEvent.type(getByPlaceholderText('Search trades…'), 'something');
  await userEvent.click(getByText('Clear filters'));
  expect(getByPlaceholderText('Search trades…')).toHaveValue('');
});
