import { vi, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTrades } from '../../hooks/useTrades';
import { fetchTrades } from '../../api/trades';
import type { Trade } from '@tpicap/shared';

vi.mock('../../api/trades', () => ({ fetchTrades: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children);
}

it('useTrades returns trades from fetchTrades', async () => {
  const trades = [{ id: 'TRD-100001' }];
  vi.mocked(fetchTrades).mockResolvedValue(trades as Trade[]);
  const { result } = renderHook(() => useTrades(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(trades);
});
