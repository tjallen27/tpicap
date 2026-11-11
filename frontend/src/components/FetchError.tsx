interface FetchErrorProps {
  onRetry: () => void;
}

export function FetchError({ onRetry }: FetchErrorProps) {
  return (
    <div>
      <p>Failed to load trades</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}
