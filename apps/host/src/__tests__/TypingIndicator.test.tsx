// apps/host/src/__tests__/TypingIndicator.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TypingIndicator } from '../components/TypingIndicator';

describe('TypingIndicator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should animate characters appearing', async () => {
    vi.useFakeTimers();

    render(<TypingIndicator text="Queen" animate={true} />);

    // Animate through each character (5 chars * 30ms = 150ms, but need extra for safety)
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        vi.advanceTimersByTime(35);
      });
    }

    expect(screen.getByText('Queen')).toBeInTheDocument();
  });

  it('should show full text immediately when animate is false', () => {
    render(<TypingIndicator text="Queen" animate={false} />);

    expect(screen.getByText('Queen')).toBeInTheDocument();
  });

  it('should show cursor when typing', () => {
    render(<TypingIndicator text="Que" animate={true} isTyping={true} />);

    expect(screen.getByTestId('typing-cursor')).toBeInTheDocument();
  });

  it('should hide cursor when not typing', () => {
    render(<TypingIndicator text="Queen" animate={false} isTyping={false} />);

    expect(screen.queryByTestId('typing-cursor')).not.toBeInTheDocument();
  });

  it('should apply gameshow effect class', () => {
    render(<TypingIndicator text="Queen" animate={true} />);

    const container = screen.getByTestId('typing-indicator');
    expect(container).toHaveClass('font-mono');
  });
});
