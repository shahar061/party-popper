import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionState } from '@party-popper/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const SESSION_STORAGE_KEY = 'partyPopper_session';

interface SessionData {
  sessionId: string;
  gameCode: string;
  playerName: string;
  joinedAt: number;
}

interface UseReconnectingWebSocketOptions {
  onMessage: (message: { type: string; payload?: unknown }) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onReconnecting: () => void;
  onReconnectFailed: () => void;
}

interface UseReconnectingWebSocketReturn {
  connect: (gameCode: string, playerName: string) => void;
  disconnect: () => void;
  send: (message: unknown) => void;
  connectionState: ConnectionState;
  sessionId: string;
  isReconnecting: boolean;
  storedSession: SessionData | null;
  clearStoredSession: () => void;
}

// Get stored session from localStorage
function getStoredSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const session = JSON.parse(stored) as SessionData;
      // Session is valid for 2 hours
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      if (Date.now() - session.joinedAt < TWO_HOURS) {
        return session;
      }
      // Session expired, clear it
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  return null;
}

// Store session in localStorage
function storeSession(session: SessionData): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

// Clear stored session
function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function useReconnectingWebSocket(
  options: UseReconnectingWebSocketOptions
): UseReconnectingWebSocketReturn {
  const { onMessage, onConnected, onDisconnected, onReconnecting, onReconnectFailed } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [storedSession, setStoredSession] = useState<SessionData | null>(getStoredSession);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(storedSession?.sessionId || crypto.randomUUID());
  const gameCodeRef = useRef<string | null>(storedSession?.gameCode || null);
  const playerNameRef = useRef<string | null>(storedSession?.playerName || null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxReconnectAttempts = 5;
  const isIntentionalCloseRef = useRef(false);

  // Create WebSocket connection
  const createConnection = useCallback((gameCode: string, isReconnect = false) => {
    const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
    const wsHost = API_URL.replace(/^https?:\/\//, '');
    const ws = new WebSocket(`${wsProtocol}://${wsHost}/api/games/${gameCode}/ws`);

    wsRef.current = ws;
    setConnectionState(ConnectionState.Connecting);

    ws.onopen = () => {
      setConnectionState(ConnectionState.Connected);
      reconnectAttemptsRef.current = 0;
      setIsReconnecting(false);

      // Send join/rejoin message
      const joinMessage = {
        type: isReconnect ? 'rejoin' : 'join',
        payload: {
          playerName: playerNameRef.current,
          sessionId: sessionIdRef.current,
        },
      };
      ws.send(JSON.stringify(joinMessage));

      onConnected();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type: string; payload?: unknown };
        onMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      setConnectionState(ConnectionState.Disconnected);
      wsRef.current = null;

      // Don't reconnect if it was intentional or code 1000 (normal close)
      if (isIntentionalCloseRef.current || event.code === 1000) {
        isIntentionalCloseRef.current = false;
        onDisconnected();
        return;
      }

      // Attempt reconnection if we have session data
      if (gameCodeRef.current && playerNameRef.current) {
        attemptReconnect();
      } else {
        onDisconnected();
      }
    };

    ws.onerror = () => {
      // Error will trigger onclose, so we just log here
      console.error('WebSocket error occurred');
    };

    return ws;
  }, [onMessage, onConnected, onDisconnected]);

  // Attempt reconnection with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setIsReconnecting(false);
      onReconnectFailed();
      return;
    }

    setIsReconnecting(true);
    onReconnecting();

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
    reconnectAttemptsRef.current++;

    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (gameCodeRef.current) {
        createConnection(gameCodeRef.current, true);
      }
    }, delay);
  }, [createConnection, onReconnecting, onReconnectFailed]);

  // Connect to a game
  const connect = useCallback((gameCode: string, playerName: string) => {
    // Store session info
    gameCodeRef.current = gameCode;
    playerNameRef.current = playerName;

    const session: SessionData = {
      sessionId: sessionIdRef.current,
      gameCode,
      playerName,
      joinedAt: Date.now(),
    };
    storeSession(session);
    setStoredSession(session);

    // Close existing connection if any
    if (wsRef.current) {
      isIntentionalCloseRef.current = true;
      wsRef.current.close(1000);
    }

    createConnection(gameCode, false);
  }, [createConnection]);

  // Disconnect from game
  const disconnect = useCallback(() => {
    isIntentionalCloseRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000);
    }
    setIsReconnecting(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  // Send message
  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, []);

  // Clear stored session
  const clearStoredSession = useCallback(() => {
    clearSession();
    setStoredSession(null);
    gameCodeRef.current = null;
    playerNameRef.current = null;
  }, []);

  // Page Visibility API - reconnect when app comes back to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App returned to foreground');

        // If we have a stored session and we're disconnected, attempt to reconnect
        if (
          gameCodeRef.current &&
          playerNameRef.current &&
          (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
        ) {
          console.log('Attempting to reconnect after visibility change...');
          reconnectAttemptsRef.current = 0; // Reset attempts for visibility-triggered reconnect
          attemptReconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [attemptReconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        isIntentionalCloseRef.current = true;
        wsRef.current.close(1000);
      }
    };
  }, []);

  return {
    connect,
    disconnect,
    send,
    connectionState,
    sessionId: sessionIdRef.current,
    isReconnecting,
    storedSession,
    clearStoredSession,
  };
}
