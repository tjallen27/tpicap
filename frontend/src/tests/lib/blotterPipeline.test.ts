import { it, expect } from 'vitest';
import type { Trade } from '@tpicap/shared';
import { filterTrades } from '../../lib/blotterPipeline';

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

it('returns all trades when search is empty string', () => {
  const trades = [makeTrade({ id: 'TRD-100001' }), makeTrade({ id: 'TRD-100002' })];
  expect(filterTrades(trades, '', [], [])).toHaveLength(2);
});

it('filters by id (case-insensitive)', () => {
  const trades = [makeTrade({ id: 'TRD-100001' }), makeTrade({ id: 'TRD-200001' })];
  expect(filterTrades(trades, 'trd-1', [], [])).toEqual([trades[0]]);
});

it('filters by symbol (case-insensitive)', () => {
  const trades = [makeTrade({ symbol: 'AAPL' }), makeTrade({ symbol: 'MSFT' })];
  expect(filterTrades(trades, 'msft', [], [])).toEqual([trades[1]]);
});

it('filters by trader (case-insensitive)', () => {
  const trades = [makeTrade({ trader: 'Alice' }), makeTrade({ trader: 'Bob' })];
  expect(filterTrades(trades, 'alice', [], [])).toEqual([trades[0]]);
});

it('filters by book (case-insensitive)', () => {
  const trades = [makeTrade({ book: 'BOOK1' }), makeTrade({ book: 'BOOK2' })];
  expect(filterTrades(trades, 'book2', [], [])).toEqual([trades[1]]);
});

it('filters by counterparty (case-insensitive)', () => {
  const trades = [makeTrade({ counterparty: 'CPT1' }), makeTrade({ counterparty: 'CPT2' })];
  expect(filterTrades(trades, 'cpt1', [], [])).toEqual([trades[0]]);
});

it('returns empty array when search matches no trade', () => {
  const trades = [makeTrade({ symbol: 'AAPL' })];
  expect(filterTrades(trades, 'ZZZZZ', [], [])).toHaveLength(0);
});

it('does not search quantity or price fields', () => {
  const trades = [makeTrade({ quantity: 12345, price: 100 })];
  expect(filterTrades(trades, '12345', [], [])).toHaveLength(0);
});

it('filters to only BUY trades when sides is ["BUY"]', () => {
  const trades = [makeTrade({ side: 'BUY' }), makeTrade({ side: 'SELL' })];
  expect(filterTrades(trades, '', ['BUY'], [])).toEqual([trades[0]]);
});

it('filters to only SELL trades when sides is ["SELL"]', () => {
  const trades = [makeTrade({ side: 'BUY' }), makeTrade({ side: 'SELL' })];
  expect(filterTrades(trades, '', ['SELL'], [])).toEqual([trades[1]]);
});

it('returns all trades when sides is empty (no filter)', () => {
  const trades = [makeTrade({ side: 'BUY' }), makeTrade({ side: 'SELL' })];
  expect(filterTrades(trades, '', [], [])).toHaveLength(2);
});

it('filters to only ACTIVE trades when statuses is ["ACTIVE"]', () => {
  const trades = [makeTrade({ status: 'ACTIVE' }), makeTrade({ status: 'CANCELLED' })];
  expect(filterTrades(trades, '', [], ['ACTIVE'])).toEqual([trades[0]]);
});

it('filters to only CANCELLED trades when statuses is ["CANCELLED"]', () => {
  const trades = [makeTrade({ status: 'ACTIVE' }), makeTrade({ status: 'CANCELLED' })];
  expect(filterTrades(trades, '', [], ['CANCELLED'])).toEqual([trades[1]]);
});

it('applies search AND side filter together', () => {
  const trades = [
    makeTrade({ symbol: 'AAPL', side: 'BUY' }),
    makeTrade({ symbol: 'AAPL', side: 'SELL' }),
    makeTrade({ symbol: 'MSFT', side: 'BUY' }),
  ];
  expect(filterTrades(trades, 'AAPL', ['BUY'], [])).toEqual([trades[0]]);
});

it('applies search AND status filter together', () => {
  const trades = [
    makeTrade({ symbol: 'AAPL', status: 'ACTIVE' }),
    makeTrade({ symbol: 'AAPL', status: 'CANCELLED' }),
  ];
  expect(filterTrades(trades, 'AAPL', [], ['ACTIVE'])).toEqual([trades[0]]);
});

it('applies search AND side AND status filters together — composed pipeline produces correct subset', () => {
  const trades = [
    makeTrade({ id: 'TRD-A', symbol: 'AAPL', side: 'BUY',  status: 'ACTIVE'    }),
    makeTrade({ id: 'TRD-B', symbol: 'AAPL', side: 'SELL', status: 'ACTIVE'    }),
    makeTrade({ id: 'TRD-C', symbol: 'AAPL', side: 'BUY',  status: 'CANCELLED' }),
    makeTrade({ id: 'TRD-D', symbol: 'MSFT', side: 'BUY',  status: 'ACTIVE'    }),
  ];
  const result = filterTrades(trades, 'AAPL', ['BUY'], ['ACTIVE']);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('TRD-A');
});
