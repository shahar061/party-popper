// apps/host/src/__tests__/SessionControls.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionControls } from '../components/SessionControls';

describe('SessionControls', () => {
  it('should show Play Again button', () => {
    render(
      <SessionControls
        onPlayAgain={vi.fn()}
        onEndSession={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument();
  });

  it('should show End Session button', () => {
    render(
      <SessionControls
        onPlayAgain={vi.fn()}
        onEndSession={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /end session/i })).toBeInTheDocument();
  });

  it('should call onPlayAgain when Play Again is clicked', () => {
    const onPlayAgain = vi.fn();
    render(
      <SessionControls
        onPlayAgain={onPlayAgain}
        onEndSession={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /play again/i }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('should show confirmation dialog before ending session', () => {
    render(
      <SessionControls
        onPlayAgain={vi.fn()}
        onEndSession={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /end session/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should call onEndSession when confirmed', () => {
    const onEndSession = vi.fn();
    render(
      <SessionControls
        onPlayAgain={vi.fn()}
        onEndSession={onEndSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /end session/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onEndSession).toHaveBeenCalledTimes(1);
  });

  it('should cancel dialog without calling onEndSession', () => {
    const onEndSession = vi.fn();
    render(
      <SessionControls
        onPlayAgain={vi.fn()}
        onEndSession={onEndSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /end session/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onEndSession).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });
});
