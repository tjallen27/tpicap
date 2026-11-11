import type { Trade } from '@tpicap/shared';

interface AmendTradeFormProps {
  trade: Trade;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AmendTradeForm({ onClose }: AmendTradeFormProps) {
  return (
    <div className="form-panel">
      <h2>Amend Trade</h2>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
