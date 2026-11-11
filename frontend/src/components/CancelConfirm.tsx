import type { Trade } from '@tpicap/shared';

interface CancelConfirmProps {
  trade: Trade;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CancelConfirm({ onClose }: CancelConfirmProps) {
  return (
    <div className="form-panel">
      <h2>Cancel Trade</h2>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
