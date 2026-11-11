import type { Trade } from '@tpicap/shared';

export function calculatePnl(trade: Trade, currentPrice: number): number {
  return (currentPrice - trade.price) * trade.quantity * (trade.side === 'BUY' ? 1 : -1);
}
