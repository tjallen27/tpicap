import { it, expect } from 'vitest';
import type { Trade } from '@tpicap/shared';
import { calculatePnl } from '../../lib/pnl';

it('returns positive P&L for a BUY trade when currentPrice > price', () => {
  const trade = { price: 100, quantity: 100, side: 'BUY' } as Trade;
  expect(calculatePnl(trade, 110)).toBe(1000);
});

it('returns negative P&L for a BUY trade when currentPrice < price', () => {
  const trade = { price: 100, quantity: 100, side: 'BUY' } as Trade;
  expect(calculatePnl(trade, 90)).toBe(-1000);
});

it('returns positive P&L for a SELL trade when currentPrice < price', () => {
  const trade = { price: 100, quantity: 100, side: 'SELL' } as Trade;
  expect(calculatePnl(trade, 90)).toBe(1000);
});

it('returns negative P&L for a SELL trade when currentPrice > price', () => {
  const trade = { price: 100, quantity: 100, side: 'SELL' } as Trade;
  expect(calculatePnl(trade, 110)).toBe(-1000);
});

it('returns 0 when currentPrice equals price', () => {
  const trade = { price: 100, quantity: 100, side: 'BUY' } as Trade;
  expect(calculatePnl(trade, 100)).toBe(0);
});

it('returns 0 when currentPrice equals trade.price (the fallback case)', () => {
  const trade = { price: 227, quantity: 500, side: 'BUY' } as Trade;
  expect(calculatePnl(trade, trade.price)).toBe(0);
});
