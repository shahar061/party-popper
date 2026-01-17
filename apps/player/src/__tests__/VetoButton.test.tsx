// apps/player/src/__tests__/VetoButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VetoButton } from '../components/VetoButton';

describe('VetoButton', () => {
  it('should show veto button when enabled', () => {
    render(
      <VetoButton
        tokensRemaining={2}
        onVeto={vi.fn()}
        isVetoWindowActive={true}
      />
    );

    expect(screen.getByRole('button', { name: /challenge/i })).toBeInTheDocument();
  });

  it('should be disabled when team has 0 tokens', () => {
    render(
      <VetoButton
        tokensRemaining={0}
        onVeto={vi.fn()}
        isVetoWindowActive={true}
      />
    );

    expect(screen.getByRole('button', { name: /challenge/i })).toBeDisabled();
  });

  it('should show field selection on click', () => {
    render(
      <VetoButton
        tokensRemaining={2}
        onVeto={vi.fn()}
        isVetoWindowActive={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /challenge/i }));

    expect(screen.getByRole('button', { name: /artist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /year/i })).toBeInTheDocument();
  });

  it('should show confirmation after selecting field', () => {
    render(
      <VetoButton
        tokensRemaining={2}
        onVeto={vi.fn()}
        isVetoWindowActive={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /challenge/i }));
    fireEvent.click(screen.getByRole('button', { name: /artist/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('should call onVeto with selected field when confirmed', () => {
    const onVeto = vi.fn();
    render(
      <VetoButton
        tokensRemaining={2}
        onVeto={onVeto}
        isVetoWindowActive={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /challenge/i }));
    fireEvent.click(screen.getByRole('button', { name: /title/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onVeto).toHaveBeenCalledWith('title');
  });

  it('should show token count', () => {
    render(
      <VetoButton
        tokensRemaining={2}
        onVeto={vi.fn()}
        isVetoWindowActive={true}
      />
    );

    expect(screen.getByText(/2 tokens/i)).toBeInTheDocument();
  });

  it('should be hidden when veto window is not active', () => {
    render(
      <VetoButton
        tokensRemaining={2}
        onVeto={vi.fn()}
        isVetoWindowActive={false}
      />
    );

    expect(screen.queryByRole('button', { name: /challenge/i })).not.toBeInTheDocument();
  });
});
