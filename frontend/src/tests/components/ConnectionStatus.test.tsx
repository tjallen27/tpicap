import { it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionStatus } from '../../components/ConnectionStatus';

it('renders "Live" with green indicator when status is "connected"', () => {
  const { getByText } = render(<ConnectionStatus status="connected" />);
  expect(getByText('Live')).toBeInTheDocument();
});

it('renders "Reconnecting…" with amber indicator when status is "reconnecting"', () => {
  const { getByText } = render(<ConnectionStatus status="reconnecting" />);
  expect(getByText('Reconnecting…')).toBeInTheDocument();
});

it('renders "Disconnected" with red indicator and retry button when status is "disconnected"', () => {
  const onRetry = vi.fn();
  const { getByText } = render(<ConnectionStatus status="disconnected" onRetry={onRetry} />);
  expect(getByText('Disconnected')).toBeInTheDocument();
  expect(getByText('Retry')).toBeInTheDocument();
});

it('calls onRetry when retry button is clicked in disconnected state', async () => {
  const onRetry = vi.fn();
  const { getByText } = render(<ConnectionStatus status="disconnected" onRetry={onRetry} />);
  await userEvent.click(getByText('Retry'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
