import { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from './components/Layout';
import { JoinScreen } from './components/JoinScreen';
import { LobbyView } from './components/LobbyView';
import { PlayingView } from './components/PlayingView';
import { ConnectionStatus } from './components/ConnectionStatus';
import { PlayerStatusRow } from './components/PlayerStatusRow';
import { useReconnectingWebSocket } from './hooks/useReconnectingWebSocket';
import type { GameState, Player, PlayerReadyMessage } from '@party-popper/shared';
import { ConnectionState } from '@party-popper/shared';

type Screen = 'join' | 'lobby' | 'playing' | 'reconnecting';

interface PlayerState {
  playerId: string;
  sessionId: string;
  gameCode: string;
}

function App() {
  const [screen, setScreen] = useState<Screen>('join');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [scanDetected, setScanDetected] = useState(false);
  const [reconnectMessage, setReconnectMessage] = useState<string | null>(null);
  const autoReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message: { type: string; payload?: unknown }) => {
    switch (message.type) {
      case 'state_sync': {
        const payload = message.payload as { gameState: GameState };
        const state = payload.gameState;
        setGameState(state);

        // Find our player
        const allPlayers = [...state.teams.A.players, ...state.teams.B.players];
        const ourPlayer = allPlayers.find(p => p.sessionId === sessionId);

        if (ourPlayer) {
          setPlayerState(prev => ({
            playerId: ourPlayer.id,
            sessionId: sessionId,
            gameCode: prev?.gameCode || storedSession?.gameCode || '',
          }));

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
          setReconnectMessage(null);
        }
        break;
      }
      case 'rejoin_success': {
        // Server confirmed our rejoin - state_sync will follow
        setReconnectMessage('Reconnected! Syncing state...');
        break;
      }
      case 'player_joined': {
        const payload = message.payload as { player: Player };
        const player = payload.player;
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
        const payload = message.payload as { playerId: string };
        const { playerId } = payload;
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
      case 'player_reconnected': {
        const payload = message.payload as { playerId: string; sessionId: string };
        // Update player's connected status
        setGameState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            teams: {
              A: {
                ...prev.teams.A,
                players: prev.teams.A.players.map(p =>
                  p.id === payload.playerId ? { ...p, connected: true } : p
                ),
              },
              B: {
                ...prev.teams.B,
                players: prev.teams.B.players.map(p =>
                  p.id === payload.playerId ? { ...p, connected: true } : p
                ),
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
        const payload = message.payload as { team: 'A' | 'B'; playerId: string };
        const { team, playerId } = payload;
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
        const payload = message.payload as { phase: string; endsAt: number; quizOptions?: GameState['currentRound'] extends { quizOptions?: infer Q } ? Q : never };
        const { phase, endsAt, quizOptions } = payload;
        setGameState(prev => {
          if (!prev || !prev.currentRound) return prev;
          const updatedRound = {
            ...prev.currentRound,
            phase: phase as NonNullable<GameState['currentRound']>['phase'],
            endsAt,
          };
          // Include quizOptions if provided (sent when transitioning to quiz phase)
          if (quizOptions) {
            updatedRound.quizOptions = quizOptions;
          }
          return {
            ...prev,
            currentRound: updatedRound,
          };
        });
        break;
      }
      case 'error': {
        const payload = message.payload as { message: string };
        setError(payload.message);
        setIsLoading(false);
        break;
      }
    }
  }, []);

  // WebSocket connection callbacks
  const handleConnected = useCallback(() => {
    setError(null);
  }, []);

  const handleDisconnected = useCallback(() => {
    // Only show error on join screen
    if (screen === 'join') {
      setError('Connection lost. Please try again.');
      setIsLoading(false);
    }
  }, [screen]);

  const handleReconnecting = useCallback(() => {
    setReconnectMessage('Connection lost. Reconnecting...');
  }, []);

  const handleReconnectFailed = useCallback(() => {
    setReconnectMessage(null);
    setError('Failed to reconnect. Please rejoin the game.');
    setScreen('join');
    clearStoredSession();
  }, []);

  // Initialize the reconnecting WebSocket hook
  const {
    connect,
    disconnect,
    send,
    connectionState,
    sessionId,
    isReconnecting,
    storedSession,
    clearStoredSession,
  } = useReconnectingWebSocket({
    onMessage: handleMessage,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onReconnecting: handleReconnecting,
    onReconnectFailed: handleReconnectFailed,
  });

  // Handle join form submission
  const handleJoin = useCallback(({ code, name }: { code: string; name: string }) => {
    setIsLoading(true);
    setError(null);
    connect(code, name);
  }, [connect]);

  // Handle rejoining from stored session
  const handleRejoin = useCallback(() => {
    if (storedSession) {
      setIsLoading(true);
      setError(null);
      setReconnectMessage('Rejoining game...');
      connect(storedSession.gameCode, storedSession.playerName);
    }
  }, [storedSession, connect]);

  // Clear stored session and start fresh
  const handleStartFresh = useCallback(() => {
    clearStoredSession();
    setError(null);
  }, [clearStoredSession]);

  // Handler for ready button
  const handleReady = useCallback(() => {
    if (!playerState) return;

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

    send(message);
    setScanDetected(false); // Reset scan detection state
  }, [playerState, send]);

  // Handler for quiz submission
  const handleSubmitQuiz = useCallback((artistIndex: number, titleIndex: number) => {
    send({
      type: 'submit_quiz',
      payload: { artistIndex, titleIndex, sessionId }
    });
  }, [send, sessionId]);

  // Handler for placement submission
  const handleSubmitPlacement = useCallback((position: number) => {
    send({
      type: 'submit_placement',
      payload: { position, sessionId }
    });
  }, [send, sessionId]);

  // Handler for using veto
  const handleUseVeto = useCallback(() => {
    send({
      type: 'use_veto',
      payload: { sessionId }
    });
  }, [send, sessionId]);

  // Handler for passing on veto
  const handlePassVeto = useCallback(() => {
    send({
      type: 'pass_veto',
      payload: { sessionId }
    });
  }, [send, sessionId]);

  // Handler for veto placement submission
  const handleSubmitVetoPlacement = useCallback((position: number) => {
    send({
      type: 'submit_veto_placement',
      payload: { position, sessionId }
    });
  }, [send, sessionId]);

  // Handler for claiming team leader
  const handleClaimLeader = useCallback(() => {
    send({
      type: 'claim_team_leader',
      payload: { sessionId }
    });
  }, [send, sessionId]);

  // Handler for quiz suggestion (non-leaders)
  const handleQuizSuggestion = useCallback((artistIndex: number | null, titleIndex: number | null) => {
    send({
      type: 'submit_quiz_suggestion',
      payload: { artistIndex, titleIndex, sessionId }
    });
  }, [send, sessionId]);

  // Handler for placement suggestion (non-leaders)
  const handlePlacementSuggestion = useCallback((position: number) => {
    send({
      type: 'submit_placement_suggestion',
      payload: { position, sessionId }
    });
  }, [send, sessionId]);

  // Handler for veto suggestion (non-leaders)
  const handleVetoSuggestion = useCallback((useVeto: boolean) => {
    send({
      type: 'submit_veto_suggestion',
      payload: { useVeto, sessionId }
    });
  }, [send, sessionId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
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
      <ConnectionStatus
        state={isReconnecting ? ConnectionState.Connecting : connectionState}
      />

      {/* Reconnecting overlay */}
      {reconnectMessage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 text-center max-w-sm mx-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white text-lg">{reconnectMessage}</p>
          </div>
        </div>
      )}

      {screen === 'join' && (
        <>
          {/* Show rejoin option if there's a stored session */}
          {storedSession && !isLoading && (
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500 rounded-xl">
              <p className="text-blue-300 text-sm mb-3">
                You were in game <strong>{storedSession.gameCode}</strong> as <strong>{storedSession.playerName}</strong>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRejoin}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  Rejoin Game
                </button>
                <button
                  onClick={handleStartFresh}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                >
                  New Game
                </button>
              </div>
            </div>
          )}
          <JoinScreen
            onJoin={handleJoin}
            isLoading={isLoading}
            error={error}
          />
        </>
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
