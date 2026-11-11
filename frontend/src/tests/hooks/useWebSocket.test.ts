import { vi, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { Trade } from '@tpicap/shared';

// Class-based mock so each `new WebSocket(url)` creates a trackable instance
let lastWs: MockWsInstance;

class MockWsInstance {
  static lastUrl = '';
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    MockWsInstance.lastUrl = url;
    lastWs = this;
  }

  triggerOpen() { this.onopen?.(new Event('open')); }
  triggerClose() { this.onclose?.(new CloseEvent('close')); }
  triggerMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

vi.stubGlobal('WebSocket', MockWsInstance);

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(queryClient, 'invalidateQueries');
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('connects to ${VITE_WS_URL}/ws on mount', () => {
  renderHook(() => useWebSocket(), { wrapper });
  expect(MockWsInstance.lastUrl).toBe(`${import.meta.env.VITE_WS_URL}/ws`);
});

it('returns status "connected" when WebSocket readyState is OPEN', () => {
  const { result } = renderHook(() => useWebSocket(), { wrapper });
  act(() => lastWs.triggerOpen());
  expect(result.current.status).toBe('connected');
});

it('returns status "reconnecting" after a close event while attempts remain', () => {
  const { result } = renderHook(() => useWebSocket(), { wrapper });
  act(() => lastWs.triggerOpen());
  act(() => lastWs.triggerClose());
  expect(result.current.status).toBe('reconnecting');
});

it('returns status "disconnected" after retries are exhausted', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useWebSocket(), { wrapper });
  for (let i = 0; i < 5; i++) {
    act(() => lastWs.triggerClose());
    await vi.runAllTimersAsync();
  }
  expect(result.current.status).toBe('disconnected');
  vi.useRealTimers();
});

it('uses backoff delays of 1000, 2000, 4000, 8000ms for attempts 1-4', () => {
  vi.useFakeTimers();
  const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
  renderHook(() => useWebSocket(), { wrapper });
  act(() => { lastWs.triggerOpen(); lastWs.triggerClose(); });
  expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 1000);
  act(() => { lastWs.triggerOpen(); lastWs.triggerClose(); });
  expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 2000);
  act(() => { lastWs.triggerOpen(); lastWs.triggerClose(); });
  expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 4000);
  act(() => { lastWs.triggerOpen(); lastWs.triggerClose(); });
  expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 8000);
  act(() => { lastWs.triggerOpen(); lastWs.triggerClose(); });
  expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 8000);
  vi.useRealTimers();
});

it('calls invalidateQueries(["trades"]) exactly once on reconnect after a close', () => {
  const { result } = renderHook(() => useWebSocket(), { wrapper });
  act(() => lastWs.triggerOpen());
  act(() => lastWs.triggerClose());
  act(() => lastWs.triggerOpen());
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trades'] });
  expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
});

it('appends a new trade to ["trades"] cache on trade:created event', () => {
  renderHook(() => useWebSocket(), { wrapper });
  act(() => lastWs.triggerOpen());
  const trade = { id: 'TRD-200001', symbol: 'AAPL' };
  act(() => lastWs.triggerMessage({ event: 'trade:created', payload: trade }));
  const trades = queryClient.getQueryData<Trade[]>(['trades']);
  expect(trades).toContainEqual(trade);
});

it('replaces the matching trade in ["trades"] cache on trade:amended event', () => {
  queryClient.setQueryData(['trades'], [{ id: 'TRD-100001', quantity: 100 }]);
  renderHook(() => useWebSocket(), { wrapper });
  act(() => lastWs.triggerOpen());
  act(() => lastWs.triggerMessage({ event: 'trade:amended', payload: { id: 'TRD-100001', quantity: 200 } }));
  const trades = queryClient.getQueryData<Trade[]>(['trades']);
  expect(trades?.find(t => t.id === 'TRD-100001')?.quantity).toBe(200);
});

it('replaces the matching trade in ["trades"] cache on trade:cancelled event', () => {
  queryClient.setQueryData(['trades'], [{ id: 'TRD-100001', status: 'ACTIVE' }]);
  renderHook(() => useWebSocket(), { wrapper });
  act(() => lastWs.triggerOpen());
  act(() => lastWs.triggerMessage({ event: 'trade:cancelled', payload: { id: 'TRD-100001', status: 'CANCELLED' } }));
  const trades = queryClient.getQueryData<Trade[]>(['trades']);
  expect(trades?.find(t => t.id === 'TRD-100001')?.status).toBe('CANCELLED');
});

it('updates ["prices"] cache on price:updated event', () => {
  renderHook(() => useWebSocket(), { wrapper });
  act(() => lastWs.triggerOpen());
  act(() => lastWs.triggerMessage({
    event: 'price:updated',
    payload: [{ symbol: 'AAPL', currentPrice: 230.50, timestamp: new Date().toISOString() }],
  }));
  const prices = queryClient.getQueryData<Record<string, number>>(['prices']);
  expect(prices?.['AAPL']).toBe(230.50);
});

it('closes the WebSocket connection on unmount', () => {
  const { unmount } = renderHook(() => useWebSocket(), { wrapper });
  const ws = lastWs;
  unmount();
  expect(ws.close).toHaveBeenCalled();
});
