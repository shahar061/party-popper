import { createContext, useContext, ReactNode, useCallback, useState } from 'react';
import {
  useGameConnection,
  ConnectionState,
  WebSocketMessage
} from '@party-popper/shared';
import type { GameState, Player } from '@party-popper/shared';

interface GameContextValue {
  // Connection
  connectionState: ConnectionState;
  isConnected: boolean;
  reconnectAttempt: number;
  connect: (gameCode: string, playerName: string) => void;
  disconnect: () => void;

  // Game state
  gameState: GameState | null;
  currentPlayer: Player | null;
  error: string | null;

  // Actions
  send: (message: WebSocketMessage) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
}

export function GameProvider({
  children,
  apiBaseUrl = import.meta.env.VITE_API_URL || ''
}: GameProviderProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'state_sync':
        setGameState(message.payload as GameState);
        break;
      case 'player_joined':
        // Update handled via state_sync
        break;
      case 'error':
        setError((message.payload as { message: string }).message);
        break;
      default:
        console.log('Unhandled message type:', message.type);
    }
  }, []);

  const handleConnect = useCallback(() => {
    setError(null);
  }, []);

  const handleDisconnect = useCallback(() => {
    // Keep game state for potential reconnection
  }, []);

  const handleError = useCallback(() => {
    setError('Connection error occurred');
  }, []);

  const {
    state: connectionState,
    isConnected,
    reconnectAttempt,
    connect: wsConnect,
    disconnect,
    send,
  } = useGameConnection({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  });

  const connect = useCallback(async (gameCode: string, playerName: string) => {
    setError(null);

    try {
      // First, validate the game exists
      const response = await fetch(`${apiBaseUrl}/api/games/${gameCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Game not found. Check the code and try again.');
          return;
        }
        throw new Error('Failed to join game');
      }

      const { wsUrl } = await response.json();

      // Store player info for reconnection
      sessionStorage.setItem('party-popper-session', JSON.stringify({
        gameCode,
        playerName,
        timestamp: Date.now(),
      }));

      // Connect to WebSocket
      wsConnect(wsUrl);

      // Send join message once connected (handled in onConnect)
      // Actually need to wait for connection, so we'll send after
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    }
  }, [apiBaseUrl, wsConnect]);

  const value: GameContextValue = {
    connectionState,
    isConnected,
    reconnectAttempt,
    connect,
    disconnect,
    gameState,
    currentPlayer,
    error,
    send,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
