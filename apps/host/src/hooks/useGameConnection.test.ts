import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameConnection } from './useGameConnection';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();
  close = vi.fn();

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  simulateClose(code = 1000) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code });
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

describe('useGameConnection', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should connect to WebSocket and expose connection state', async () => {
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws')
    );

    expect(result.current.connectionState).toBe('connecting');

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connectionState).toBe('connected');
  });

  it('should auto-reconnect on disconnect with exponential backoff', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws')
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connectionState).toBe('connected');

    act(() => {
      MockWebSocket.instances[0].simulateClose(1006); // Abnormal close
    });

    expect(result.current.connectionState).toBe('disconnected');

    // First reconnect attempt after 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockWebSocket.instances.length).toBe(2);
    expect(result.current.connectionState).toBe('connecting');

    vi.useRealTimers();
  });

  it('should expose send function for messages', async () => {
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws')
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.send({ type: 'test_message', payload: { foo: 'bar' } });
    });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test_message', payload: { foo: 'bar' } })
    );
  });

  it('should call onMessage callback when message received', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws', { onMessage })
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage({ type: 'state_sync', payload: {} });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'state_sync', payload: {} });
  });
});
