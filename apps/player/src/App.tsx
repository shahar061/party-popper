import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from './components/Layout';
import { JoinScreen } from './components/JoinScreen';
import { LobbyView } from './components/LobbyView';
import { PlayingView } from './components/PlayingView';
import { ConnectionStatus } from './components/ConnectionStatus';
import { PlayerStatusRow } from './components/PlayerStatusRow';
import type { GameState, Player, PlayerReadyMessage } from '@party-popper/shared';
import { ConnectionState } from '@party-popper/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type Screen = 'join' | 'lobby' | 'playing';

interface PlayerState {
  playerId: string;
  sessionId: string;
  gameCode: string;
}

function App() {
  const [screen, setScreen] = useState<Screen>('join');
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [scanDetected, setScanDetected] = useState(false);
  const autoReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setConnectionState(ConnectionState.Connecting);

      ws.onopen = () => {
        setConnectionState(ConnectionState.Connected);
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

                // Set screen based on game status
                switch (state.status) {
                  case 'lobby':
                    setScreen('lobby');
                    break;
                  case 'playing':
                    setScreen('playing');
                    break;
                  case 'finished':
                    setScreen('playing'); // Show playing screen with results
                    break;
                }

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
            case 'leader_claimed': {
              const { team, playerId } = message.payload as { team: 'A' | 'B'; playerId: string };
              setGameState(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  teams: {
                    ...prev.teams,
                    [team]: {
                      ...prev.teams[team],
                      players: prev.teams[team].players.map((p: Player) =>
                        p.id === playerId ? { ...p, isTeamLeader: true } : p
                      ),
                    },
                  },
                };
              });
              break;
            }
            case 'qr_scan_detected': {
              setScanDetected(true);
              // Auto-ready after 2 seconds - timer has started!
              autoReadyTimeoutRef.current = setTimeout(() => {
                handleReady();
              }, 2000);
              break;
            }
            case 'phase_changed': {
              const { phase, endsAt, quizOptions } = message.payload;
              setGameState(prev => {
                if (!prev || !prev.currentRound) return prev;
                return {
                  ...prev,
                  currentRound: {
                    ...prev.currentRound,
                    phase,
                    endsAt,
                    // Include quizOptions if provided (sent when transitioning to quiz phase)
                    ...(quizOptions && { quizOptions }),
                  },
                };
              });
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
        setConnectionState(ConnectionState.Disconnected);
        if (screen === 'join') {
          setError('Connection lost. Please try again.');
          setIsLoading(false);
        }
      };

      ws.onerror = () => {
        setError('Failed to connect. Check the game code and try again.');
        setIsLoading(false);
        setConnectionState(ConnectionState.Disconnected);
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
      setIsLoading(false);
    }
  }, [screen]);

  // Handler for ready button
  const handleReady = useCallback(() => {
    if (!wsRef.current || !playerState) return;

    // Clear auto-ready timeout if it exists
    if (autoReadyTimeoutRef.current) {
      clearTimeout(autoReadyTimeoutRef.current);
      autoReadyTimeoutRef.current = null;
    }

    const message: PlayerReadyMessage = {
      type: 'player_ready',
      payload: {
        playerId: playerState.playerId,
      },
    };

    wsRef.current.send(JSON.stringify(message));
    setScanDetected(false); // Reset scan detection state
  }, [playerState]);

  // Handler for quiz submission
  const handleSubmitQuiz = useCallback((artistIndex: number, titleIndex: number) => {
    wsRef.current?.send(JSON.stringify({
      type: 'submit_quiz',
      payload: { artistIndex, titleIndex }
    }));
  }, []);

  // Handler for placement submission
  const handleSubmitPlacement = useCallback((position: number) => {
    wsRef.current?.send(JSON.stringify({
      type: 'submit_placement',
      payload: { position }
    }));
  }, []);

  // Handler for using veto
  const handleUseVeto = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'use_veto' }));
  }, []);

  // Handler for passing on veto
  const handlePassVeto = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'pass_veto' }));
  }, []);

  // Handler for veto placement submission
  const handleSubmitVetoPlacement = useCallback((position: number) => {
    wsRef.current?.send(JSON.stringify({
      type: 'submit_veto_placement',
      payload: { position }
    }));
  }, []);

  // Handler for claiming team leader
  const handleClaimLeader = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'claim_team_leader' }));
  }, []);

  // Handler for quiz suggestion (non-leaders)
  const handleQuizSuggestion = useCallback((artistIndex: number | null, titleIndex: number | null) => {
    wsRef.current?.send(JSON.stringify({
      type: 'submit_quiz_suggestion',
      payload: { artistIndex, titleIndex }
    }));
  }, []);

  // Handler for placement suggestion (non-leaders)
  const handlePlacementSuggestion = useCallback((position: number) => {
    wsRef.current?.send(JSON.stringify({
      type: 'submit_placement_suggestion',
      payload: { position }
    }));
  }, []);

  // Handler for veto suggestion (non-leaders)
  const handleVetoSuggestion = useCallback((useVeto: boolean) => {
    wsRef.current?.send(JSON.stringify({
      type: 'submit_veto_suggestion',
      payload: { useVeto }
    }));
  }, []);

  // Cleanup WebSocket and timeout on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close(1000);
      if (autoReadyTimeoutRef.current) {
        clearTimeout(autoReadyTimeoutRef.current);
      }
    };
  }, []);

  // Get current player info for the status row
  const currentPlayer = gameState && playerState
    ? [...gameState.teams.A.players, ...gameState.teams.B.players].find(p => p.id === playerState.playerId)
    : null;

  const currentTeam = currentPlayer?.team;
  const currentTeamName = currentTeam ? gameState?.teams[currentTeam].name || `Team ${currentTeam}` : '';

  return (
    <Layout>
      {currentPlayer && (
        <PlayerStatusRow
          playerName={currentPlayer.name}
          team={currentPlayer.team}
          teamName={currentTeamName}
          isTeamLeader={currentPlayer.isTeamLeader}
        />
      )}
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
          onClaimLeader={handleClaimLeader}
        />
      )}

      {screen === 'playing' && gameState && playerState && (
        <PlayingView
          gameState={gameState}
          playerId={playerState.playerId}
          onReady={handleReady}
          scanDetected={scanDetected}
          onSubmitQuiz={handleSubmitQuiz}
          onSubmitPlacement={handleSubmitPlacement}
          onUseVeto={handleUseVeto}
          onPassVeto={handlePassVeto}
          onSubmitVetoPlacement={handleSubmitVetoPlacement}
          onQuizSuggestion={handleQuizSuggestion}
          onPlacementSuggestion={handlePlacementSuggestion}
          onVetoSuggestion={handleVetoSuggestion}
        />
      )}
    </Layout>
  );
}

export default App;
