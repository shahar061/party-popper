import { useState, useRef, useCallback, useEffect } from 'react';

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
}

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
}

export interface UseGameConnectionOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
}

export interface UseGameConnectionReturn {
  state: ConnectionState;
  isConnected: boolean;
  reconnectAttempt: number;
  connect: (url: string) => void;
  disconnect: () => void;
  send: (message: WebSocketMessage) => void;
}

export function useGameConnection(
  options: UseGameConnectionOptions = {}
): UseGameConnectionReturn {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    maxReconnectAttempts = 5,
    reconnectBaseDelay = 1000,
  } = options;

  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const urlRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback((url: string) => {
    clearReconnectTimeout();
    intentionalCloseRef.current = false;
    urlRef.current = url;

    if (wsRef.current) {
      wsRef.current.close();
    }

    setState(ConnectionState.Connecting);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(ConnectionState.Connected);
      setReconnectAttempt(0);
      onConnect?.();
    };

    ws.onclose = (event) => {
      wsRef.current = null;

      if (intentionalCloseRef.current) {
        setState(ConnectionState.Disconnected);
        onDisconnect?.();
        return;
      }

      // Abnormal close - attempt reconnection
      if (event.code !== 1000 && reconnectAttempt < maxReconnectAttempts && urlRef.current) {
        setState(ConnectionState.Reconnecting);
        const delay = reconnectBaseDelay * Math.pow(2, reconnectAttempt);

        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          connect(urlRef.current!);
        }, delay);
      } else {
        setState(ConnectionState.Disconnected);
        onDisconnect?.();
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        onMessage?.(message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (event) => {
      onError?.(event);
    };
  }, [onConnect, onDisconnect, onMessage, onError, maxReconnectAttempts, reconnectBaseDelay, reconnectAttempt, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    intentionalCloseRef.current = true;
    setReconnectAttempt(0);

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
    }

    setState(ConnectionState.Disconnected);
  }, [clearReconnectTimeout]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clearReconnectTimeout]);

  return {
    state,
    isConnected: state === ConnectionState.Connected,
    reconnectAttempt,
    connect,
    disconnect,
    send,
  };
}
