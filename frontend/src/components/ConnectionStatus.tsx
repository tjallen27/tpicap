interface ConnectionStatusProps {
  status: 'connected' | 'reconnecting' | 'disconnected';
  onRetry?: () => void;
}

export function ConnectionStatus({ status, onRetry }: ConnectionStatusProps) {
  if (status === 'connected') {
    return (
      <span className="connection-status connection-status--connected">
        <span className="connection-dot" />
        Live
      </span>
    );
  }

  if (status === 'reconnecting') {
    return (
      <span className="connection-status connection-status--reconnecting">
        <span className="connection-dot" />
        Reconnecting…
      </span>
    );
  }

  return (
    <span className="connection-status connection-status--disconnected">
      <span className="connection-dot" />
      Disconnected
      <button onClick={onRetry}>Retry</button>
    </span>
  );
}
