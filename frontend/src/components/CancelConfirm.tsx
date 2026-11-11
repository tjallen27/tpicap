import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Trade } from '@tpicap/shared';
import { cancelTrade, ApiError } from '../api/trades';

interface CancelConfirmProps {
  trade: Trade;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CancelConfirm({ trade, onClose, onSuccess }: CancelConfirmProps) {
  const [notification, setNotification] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => cancelTrade(trade.id),
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setNotification('This trade has already been cancelled.');
        queryClient.invalidateQueries({ queryKey: ['trades'] });
      } else {
        setNotification('Failed to cancel trade. Please try again.');
      }
    },
  });

  return (
    <div className="form-panel">
      <p>Are you sure you want to cancel trade {trade.id}?</p>

      {notification && <p className="form-notification">{notification}</p>}

      <div>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Confirm
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
