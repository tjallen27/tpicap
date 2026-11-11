import { it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Trade } from '@tpicap/shared';
import { ApiError } from '../../api/trades';
import { CreateTradeForm } from '../../components/CreateTradeForm';

vi.mock('../../api/trades', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/trades')>();
  return { ...actual, createTrade: vi.fn() };
});

import { createTrade } from '../../api/trades';

const makeTrade = (): Trade => ({
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
});

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

async function fillValidCreateForm(
  getByLabelText: (text: string) => HTMLElement,
  getByText: (text: string) => HTMLElement,
) {
  await userEvent.type(getByLabelText('Symbol'), 'AAPL');
  await userEvent.selectOptions(getByLabelText('Side'), 'BUY');
  await userEvent.type(getByLabelText('Quantity'), '100');
  await userEvent.type(getByLabelText('Price'), '227');
  await userEvent.type(getByLabelText('Trader'), 'Alice');
  await userEvent.type(getByLabelText('Book'), 'BOOK1');
  await userEvent.type(getByLabelText('Counterparty'), 'CPT1');
  await userEvent.click(getByText('Submit'));
}

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
  vi.mocked(createTrade).mockResolvedValue(makeTrade());
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
    tradeTimestamp: expect.any(String),
  });
});

it('calls onClose after a successful submission', async () => {
  vi.mocked(createTrade).mockResolvedValue(makeTrade());
  const onClose = vi.fn();
  const { getByLabelText, getByText } = render(<CreateTradeForm onClose={onClose} />, { wrapper });
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
  vi.mocked(createTrade).mockResolvedValue(makeTrade());
  const { getByLabelText, getByText } = render(<CreateTradeForm onClose={vi.fn()} />, { wrapper });
  await fillValidCreateForm(getByLabelText, getByText);
  await waitFor(() => expect(createTrade).toHaveBeenCalled());
  const payload = vi.mocked(createTrade).mock.calls[0][0];
  expect(payload).not.toHaveProperty('id');
  expect(payload).not.toHaveProperty('status');
});
