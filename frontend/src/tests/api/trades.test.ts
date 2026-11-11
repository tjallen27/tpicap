import { vi, it, expect, beforeEach } from 'vitest';
import { fetchTrades, createTrade, amendTrade, cancelTrade } from '../../api/trades';

beforeEach(() => {
  vi.restoreAllMocks();
});

it('fetchTrades calls GET /trades and returns Trade[]', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ trades: [{ id: 'TRD-100001', symbol: 'AAPL' }] }),
  }) as typeof fetch;
  const result = await fetchTrades();
  expect(fetch).toHaveBeenCalledWith(`${import.meta.env.VITE_API_URL}/trades`);
  expect(result[0].id).toBe('TRD-100001');
});

it('createTrade calls POST /trades with the payload', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'TRD-100002', symbol: 'MSFT' }),
  }) as typeof fetch;
  const payload = {
    symbol: 'MSFT', side: 'BUY' as const, quantity: 100, price: 534,
    trader: 'Alice', book: 'BOOK1', counterparty: 'CPT1',
    tradeTimestamp: '2026-11-11T09:00:00.000Z',
  };
  await createTrade(payload);
  expect(fetch).toHaveBeenCalledWith(
    `${import.meta.env.VITE_API_URL}/trades`,
    expect.objectContaining({ method: 'POST' })
  );
});

it('amendTrade calls PATCH /trades/:id', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as typeof fetch;
  await amendTrade('TRD-100001', { quantity: 200 });
  expect(fetch).toHaveBeenCalledWith(
    `${import.meta.env.VITE_API_URL}/trades/TRD-100001`,
    expect.objectContaining({ method: 'PATCH' })
  );
});

it('cancelTrade calls PATCH /trades/:id/cancel', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as typeof fetch;
  await cancelTrade('TRD-100001');
  expect(fetch).toHaveBeenCalledWith(
    `${import.meta.env.VITE_API_URL}/trades/TRD-100001/cancel`,
    expect.objectContaining({ method: 'PATCH' })
  );
});

it('fetchTrades throws an ApiError with status when response is not ok', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as typeof fetch;
  await expect(fetchTrades()).rejects.toMatchObject({ status: 500 });
});
