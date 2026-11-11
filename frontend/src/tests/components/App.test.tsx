import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../../App';

vi.mock('../../hooks/useTrades', () => ({
  useTrades: vi.fn(() => ({ data: [], isSuccess: true, isError: false, isFetching: false, isRefetching: false, refetch: vi.fn() })),
}));

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({ status: 'connected', retry: vi.fn() })),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

it('renders without crashing', () => {
  render(<App />, { wrapper });
  expect(document.body).toBeInTheDocument();
});
