import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from './components/Layout';
import { JoinScreen } from './components/JoinScreen';
import { LobbyView } from './components/LobbyView';
import { ConnectionStatus } from './components/ConnectionStatus';
import type { GameState, Player } from '@party-popper/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type Screen = 'join' | 'lobby' | 'playing';
type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface PlayerState {
  playerId: string;
  sessionId: string;
  gameCode: string;
}

function App() {
  const [screen, setScreen] = useState<Screen>('join');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(
    sessionStorage.getItem('playerSessionId') || crypto.randomUUID()
  );

  // Persist session ID
  useEffect(() => {
    sessionStorage.setItem('playerSessionId', sessionIdRef.current);
  }, []);

  const handleJoin = useCallback(async ({ code, name }: { code: string; name: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Connect to WebSocket
      const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_URL.replace(/^https?:\/\//, '');
      const ws = new WebSocket(`${wsProtocol}://${wsHost}/api/games/${code}/ws`);

      wsRef.current = ws;
      setConnectionState('connecting');

      ws.onopen = () => {
        setConnectionState('connected');
        // Send join message
        ws.send(JSON.stringify({
          type: 'join',
          payload: {
            playerName: name,
            sessionId: sessionIdRef.current,
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'state_sync': {
              const state = message.payload.gameState as GameState;
              setGameState(state);

              // Find our player
              const allPlayers = [...state.teams.A.players, ...state.teams.B.players];
              const ourPlayer = allPlayers.find(p => p.sessionId === sessionIdRef.current);

              if (ourPlayer) {
                setPlayerState({
                  playerId: ourPlayer.id,
                  sessionId: sessionIdRef.current,
                  gameCode: code,
                });
                setScreen('lobby');
                setIsLoading(false);
              }
              break;
            }
            case 'player_joined': {
              const player = message.payload.player as Player;
              setGameState(prev => {
                if (!prev) return prev;
                const team = player.team;
                return {
                  ...prev,
                  teams: {
                    ...prev.teams,
                    [team]: {
                      ...prev.teams[team],
                      players: [...prev.teams[team].players, player],
                    },
                  },
                };
              });
              break;
            }
            case 'player_left': {
              const { playerId } = message.payload;
              setGameState(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  teams: {
                    A: {
                      ...prev.teams.A,
                      players: prev.teams.A.players.filter(p => p.id !== playerId),
                    },
                    B: {
                      ...prev.teams.B,
                      players: prev.teams.B.players.filter(p => p.id !== playerId),
                    },
                  },
                };
              });
              break;
            }
            case 'game_started': {
              setScreen('playing');
              break;
            }
            case 'error': {
              setError(message.payload.message);
              setIsLoading(false);
              break;
            }
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        if (screen === 'join') {
          setError('Connection lost. Please try again.');
          setIsLoading(false);
        }
      };

      ws.onerror = () => {
        setError('Failed to connect. Check the game code and try again.');
        setIsLoading(false);
        setConnectionState('disconnected');
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
      setIsLoading(false);
    }
  }, [screen]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close(1000);
    };
  }, []);

  return (
    <Layout>
      <ConnectionStatus state={connectionState} />

      {screen === 'join' && (
        <JoinScreen
          onJoin={handleJoin}
          isLoading={isLoading}
          error={error}
        />
      )}

      {screen === 'lobby' && gameState && playerState && (
        <LobbyView
          teamA={gameState.teams.A}
          teamB={gameState.teams.B}
          currentPlayerId={playerState.playerId}
          gameCode={playerState.gameCode}
        />
      )}

      {screen === 'playing' && (
        <div className="flex flex-col flex-1 items-center justify-center">
          <h1 className="text-2xl font-bold text-white">Game in Progress</h1>
          <p className="text-game-muted mt-2">Gameplay UI coming soon...</p>
        </div>
      )}
    </Layout>
  );
}

export default App;
