// apps/player/src/__tests__/useTypingBroadcast.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingBroadcast } from '../hooks/useTypingBroadcast';

describe('useTypingBroadcast', () => {
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockSendMessage.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send TYPING message on input change', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, true)
    );

    act(() => {
      result.current.broadcastTyping('artist', 'Que');
    });

    vi.advanceTimersByTime(100);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'typing',
      payload: { field: 'artist', value: 'Que' }
    });
  });

  it('should debounce to max 10 messages per second', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, true)
    );

    // Rapid typing
    act(() => {
      result.current.broadcastTyping('artist', 'Q');
      result.current.broadcastTyping('artist', 'Qu');
      result.current.broadcastTyping('artist', 'Que');
      result.current.broadcastTyping('artist', 'Quee');
      result.current.broadcastTyping('artist', 'Queen');
    });

    vi.advanceTimersByTime(100);

    // Should only send one message (debounced)
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'typing',
      payload: { field: 'artist', value: 'Queen' }
    });
  });

  it('should not send when player is not on active team', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, false)
    );

    act(() => {
      result.current.broadcastTyping('artist', 'Queen');
    });

    vi.advanceTimersByTime(100);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should send immediately after debounce period', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, true)
    );

    act(() => {
      result.current.broadcastTyping('artist', 'Q');
    });
    vi.advanceTimersByTime(100);

    act(() => {
      result.current.broadcastTyping('artist', 'Queen');
    });
    vi.advanceTimersByTime(100);

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });
});
