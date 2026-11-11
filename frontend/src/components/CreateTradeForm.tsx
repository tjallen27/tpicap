interface CreateTradeFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateTradeForm({ onClose }: CreateTradeFormProps) {
  return (
    <div className="form-panel">
      <h2>Create Trade</h2>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
