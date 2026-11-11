import type { Trade } from '@tpicap/shared';

export function filterTrades(
  trades: Trade[],
  search: string,
  sides: string[],
  statuses: string[],
): Trade[] {
  let result = trades;

  if (sides.length > 0) {
    result = result.filter(t => sides.includes(t.side));
  }

  if (statuses.length > 0) {
    result = result.filter(t => statuses.includes(t.status));
  }

  const term = search.toLowerCase();
  if (term) {
    result = result.filter(t =>
      t.id.toLowerCase().includes(term) ||
      t.symbol.toLowerCase().includes(term) ||
      t.trader.toLowerCase().includes(term) ||
      t.book.toLowerCase().includes(term) ||
      t.counterparty.toLowerCase().includes(term),
    );
  }

  return result;
}
