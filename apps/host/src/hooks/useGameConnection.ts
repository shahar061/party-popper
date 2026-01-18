import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
}

export interface UseGameConnectionOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  maxReconnectAttempts?: number;
}

export function useGameConnection(
  url: string | null,
  options: UseGameConnectionOptions = {}
) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    maxReconnectAttempts = 5,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    url ? 'connecting' : 'disconnected'
  );
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs for callbacks to avoid re-creating connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Keep refs updated
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setConnectionState('connecting');

    ws.onopen = () => {
      setConnectionState('connected');
      reconnectAttemptRef.current = 0;
      onConnectRef.current?.();
    };

    ws.onclose = (event) => {
      setConnectionState('disconnected');
      onDisconnectRef.current?.();

      // Don't reconnect on normal closure (code 1000) or if max attempts reached
      if (event.code !== 1000 && reconnectAttemptRef.current < maxReconnectAttempts) {
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
        reconnectAttemptRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        onMessageRef.current?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      // Error will be followed by close event
    };
  }, [url, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptRef.current = maxReconnectAttempts; // Prevent reconnection
    wsRef.current?.close(1000);
    wsRef.current = null;
    setConnectionState('disconnected');
  }, [maxReconnectAttempts]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close(1000);
    };
  }, [connect]);

  return {
    connectionState,
    send,
    disconnect,
    reconnect: connect,
  };
}
