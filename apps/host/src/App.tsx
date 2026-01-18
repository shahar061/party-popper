import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameConnection, type WebSocketMessage } from './hooks/useGameConnection';
import { useGameStore } from './store/gameStore';
import { LobbyScreen } from './components/LobbyScreen';
import { GameplayScreen } from './components/GameplayScreen';
import { VictoryScreen } from './components/VictoryScreen';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ToastContainer, useToasts } from './components/Toast';
import { TVLayout } from './components/TVLayout';
import type {
  ServerMessage,
  StateSyncMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  TeamChangedMessage,
  SettingsUpdatedMessage,
  ReassignTeamMessage,
  UpdateSettingsMessage,
  StartGameMessage,
  NextRoundMessage,
  GameSettings,
} from '@party-popper/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const PLAYER_APP_URL = import.meta.env.VITE_PLAYER_URL || 'http://localhost:5174';

type Screen = 'loading' | 'lobby' | 'playing' | 'finished';

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  const { toasts, dismissToast, success, error: showError, info } = useToasts();
  const { game, syncState, addPlayer, removePlayer, movePlayer, updateSettings } = useGameStore();

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      const serverMsg = message as ServerMessage;

      switch (serverMsg.type) {
        case 'state_sync': {
          const syncMsg = serverMsg as StateSyncMessage;
          syncState(syncMsg.payload.gameState);
          break;
        }
        case 'player_joined': {
          const joinMsg = serverMsg as PlayerJoinedMessage;
          addPlayer(joinMsg.payload.player, joinMsg.payload.player.team);
          info(`${joinMsg.payload.player.name} joined!`);
          break;
        }
        case 'player_left': {
          const leftMsg = serverMsg as PlayerLeftMessage;
          removePlayer(leftMsg.payload.playerId);
          break;
        }
        case 'team_changed': {
          const teamMsg = serverMsg as TeamChangedMessage;
          movePlayer(teamMsg.payload.playerId, teamMsg.payload.toTeam);
          break;
        }
        case 'settings_updated': {
          const settingsMsg = serverMsg as SettingsUpdatedMessage;
          updateSettings(settingsMsg.payload.settings);
          break;
        }
        case 'game_started': {
          // Game has started, state will be synced via state_sync or we rely on status update
          info('Game started!');
          break;
        }
        case 'error':
          showError(serverMsg.payload.message);
          break;
      }
    },
    [syncState, addPlayer, removePlayer, movePlayer, updateSettings, info, showError]
  );

  const { connectionState, send } = useGameConnection(wsUrl, {
    onMessage: handleMessage,
    onConnect: () => success('Connected to game server'),
    onDisconnect: () => showError('Disconnected from server'),
  });

  // Ref to ensure game is only created once (survives StrictMode double-mount)
  const gameCreatedRef = useRef(false);

  // Create game on mount (only once)
  useEffect(() => {
    // Prevent double creation from StrictMode or HMR
    if (gameCreatedRef.current) return;
    gameCreatedRef.current = true;

    async function createGame() {
      try {
        const response = await fetch(`${API_URL}/api/games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'classic' }),
        });

        if (!response.ok) {
          throw new Error('Failed to create game');
        }

        const data = await response.json();

        // Construct WebSocket URL from joinCode
        const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
        const wsHost = API_URL.replace(/^https?:\/\//, '');
        setWsUrl(`${wsProtocol}://${wsHost}/api/games/${data.joinCode}/ws?role=host`);
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to create game');
        // Allow retry on error
        gameCreatedRef.current = false;
      }
    }

    createGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update screen based on game status
  useEffect(() => {
    if (!game) return;

    switch (game.status) {
      case 'lobby':
        setScreen('lobby');
        break;
      case 'playing':
        setScreen('playing');
        break;
      case 'finished':
        setScreen('finished');
        break;
    }
  }, [game?.status]);

  // Handler for moving players between teams
  const handleMovePlayer = useCallback(
    (playerId: string, toTeam: 'A' | 'B') => {
      const message: ReassignTeamMessage = {
        type: 'reassign_team',
        payload: { playerId, team: toTeam },
      };
      send(message);
      // Optimistic update
      movePlayer(playerId, toTeam);
    },
    [send, movePlayer]
  );

  // Handler for updating game settings
  const handleUpdateSettings = useCallback(
    (settings: Partial<GameSettings>) => {
      const message: UpdateSettingsMessage = {
        type: 'update_settings',
        payload: settings,
      };
      send(message);
      // Optimistic update
      updateSettings(settings);
    },
    [send, updateSettings]
  );

  // Handler for starting the game
  const handleStartGame = useCallback(() => {
    const message: StartGameMessage = {
      type: 'start_game',
    };
    send(message);
    info('Starting game...');
  }, [send, info]);

  // Handler for next round
  const handleNextRound = useCallback(() => {
    const message: NextRoundMessage = {
      type: 'next_round',
    };
    send(message);
  }, [send]);

  // Loading state
  if (screen === 'loading') {
    return (
      <TVLayout>
        <ConnectionStatus state={connectionState} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-tv-2xl font-bold text-game-text mb-4">Party Popper</h1>
            <p className="text-tv-base text-game-muted">Creating game...</p>
            <div className="mt-8 flex justify-center gap-3">
              <span className="w-4 h-4 bg-team-a-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-4 h-4 bg-team-b-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-4 h-4 bg-game-text rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      </TVLayout>
    );
  }

  // Lobby screen
  if (screen === 'lobby' && game) {
    return (
      <>
        <ConnectionStatus state={connectionState} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <LobbyScreen
          joinCode={game.joinCode}
          playerAppUrl={PLAYER_APP_URL}
          teams={game.teams}
          settings={game.settings}
          onMovePlayer={handleMovePlayer}
          onUpdateSettings={handleUpdateSettings}
          onStartGame={handleStartGame}
        />
      </>
    );
  }

  // Playing screen
  if (screen === 'playing' && game) {
    return (
      <>
        <ConnectionStatus state={connectionState} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <GameplayScreen
          game={game}
          onNextRound={handleNextRound}
        />
      </>
    );
  }

  // Finished screen
  if (screen === 'finished' && game) {
    // Determine winner
    const teamAScore = game.teams.A.score;
    const teamBScore = game.teams.B.score;
    const winnerTeam = teamAScore > teamBScore ? 'A' : 'B';
    const winnerName = game.teams[winnerTeam].name;

    return (
      <>
        <ConnectionStatus state={connectionState} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <VictoryScreen
          winnerName={winnerName}
          winnerTeam={winnerTeam}
          teamAScore={teamAScore}
          teamBScore={teamBScore}
          teamATimeline={game.teams.A.timeline}
          teamBTimeline={game.teams.B.timeline}
          teamAName={game.teams.A.name}
          teamBName={game.teams.B.name}
        />
      </>
    );
  }

  // Placeholder for other screens
  return (
    <TVLayout>
      <ConnectionStatus state={connectionState} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-tv-2xl font-bold text-game-text mb-4">Party Popper</h1>
          <p className="text-tv-base text-game-muted">Screen: {screen}</p>
        </div>
      </div>
    </TVLayout>
  );
}

export default App;
