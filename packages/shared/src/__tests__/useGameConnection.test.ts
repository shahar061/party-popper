import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameConnection, ConnectionState } from '../hooks/useGameConnection';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();
  close = vi.fn();

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateClose(code = 1000) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError() {
    this.onerror?.(new Event('error'));
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

  it('starts in disconnected state', () => {
    const { result } = renderHook(() => useGameConnection());

    expect(result.current.state).toBe(ConnectionState.Disconnected);
    expect(result.current.isConnected).toBe(false);
  });

  it('connects to WebSocket URL when connect is called', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
    });

    expect(result.current.state).toBe(ConnectionState.Connecting);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toBe('wss://example.com/ws');
  });

  it('updates state to connected when WebSocket opens', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.state).toBe(ConnectionState.Connected);
    expect(result.current.isConnected).toBe(true);
  });

  it('calls onMessage callback when message received', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useGameConnection({ onMessage }));

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage({ type: 'state_sync', payload: {} });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'state_sync', payload: {} });
  });

  it('sends message through WebSocket', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.send({ type: 'join', payload: { name: 'Player1' } });
    });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'join', payload: { name: 'Player1' } })
    );
  });

  it('attempts reconnection on unexpected close', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateClose(1006); // Abnormal close
    });

    expect(result.current.state).toBe(ConnectionState.Reconnecting);

    act(() => {
      vi.advanceTimersByTime(1000); // First retry delay
    });

    expect(MockWebSocket.instances.length).toBe(2);
    vi.useRealTimers();
  });

  it('calls disconnect to close connection', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
    expect(result.current.state).toBe(ConnectionState.Disconnected);
  });
});
