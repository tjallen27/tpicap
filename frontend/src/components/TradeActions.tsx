import type { Trade } from '@tpicap/shared';

interface TradeActionsProps {
  trade?: Trade;
  data?: Trade;
  onAmend?: (trade: Trade) => void;
  onCancel?: (trade: Trade) => void;
  context?: { onAmend: (trade: Trade) => void; onCancel: (trade: Trade) => void };
}

export function TradeActions({ trade, data, onAmend, onCancel, context }: TradeActionsProps) {
  const t = trade ?? data;
  const handleAmend = onAmend ?? context?.onAmend;
  const handleCancel = onCancel ?? context?.onCancel;

  if (!t || t.status === 'CANCELLED') return null;

  return (
    <div>
      <button onClick={() => handleAmend?.(t)}>Amend</button>
      <button onClick={() => handleCancel?.(t)}>Cancel</button>
    </div>
  );
}
