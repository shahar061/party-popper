import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { ConnectionState } from '@party-popper/shared';

describe('ConnectionStatus', () => {
  it('shows green dot when connected', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Connected} />
    );

    const statusDot = container.querySelector('.bg-green-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('shows yellow dot when connecting', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Connecting} />
    );

    const statusDot = container.querySelector('.bg-yellow-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('shows yellow animated dot when reconnecting', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Reconnecting} reconnectAttempt={2} />
    );

    const statusDot = container.querySelector('.bg-yellow-500');
    expect(statusDot).toBeInTheDocument();
    expect(statusDot).toHaveClass('animate-pulse');
  });

  it('shows red dot when disconnected', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Disconnected} />
    );

    const statusDot = container.querySelector('.bg-red-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('displays reconnect attempt count when reconnecting', () => {
    render(
      <ConnectionStatus state={ConnectionState.Reconnecting} reconnectAttempt={3} />
    );

    expect(screen.getByText(/attempt 3/i)).toBeInTheDocument();
  });

  it('displays connection status text', () => {
    render(<ConnectionStatus state={ConnectionState.Connected} />);

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('shows compact mode without text when compact prop is true', () => {
    render(<ConnectionStatus state={ConnectionState.Connected} compact />);

    expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();
  });
});
