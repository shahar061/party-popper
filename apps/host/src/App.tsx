import { useCallback, useEffect, useState } from 'react';
import { useGameConnection, type WebSocketMessage } from './hooks/useGameConnection';
import { useGameStore } from './store/gameStore';
import { LobbyScreen } from './components/LobbyScreen';
import { ConnectionStatus } from './components/ConnectionStatus';
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
  GameSettings,
} from '@party-popper/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const PLAYER_APP_URL = import.meta.env.VITE_PLAYER_URL || 'http://localhost:5174';

type Screen = 'loading' | 'lobby' | 'playing' | 'finished';

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        case 'error':
          setError(serverMsg.payload.message);
          break;
      }
    },
    [syncState, addPlayer, removePlayer, movePlayer, updateSettings]
  );

  const { connectionState, send } = useGameConnection(wsUrl, {
    onMessage: handleMessage,
    onConnect: () => setError(null),
  });

  // Create game on mount
  useEffect(() => {
    async function createGame() {
      try {
        const response = await fetch(`${API_URL}/api/games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to create game');
        }

        const data = await response.json();
        setWsUrl(data.wsUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create game');
      }
    }

    createGame();
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
  }, [send]);

  // Loading state
  if (screen === 'loading') {
    return (
      <>
        <ConnectionStatus state={connectionState} />
        <div className="min-h-screen flex items-center justify-center bg-game-bg">
          <div className="text-center">
            <h1 className="text-tv-xl font-bold text-game-text mb-4">Party Popper</h1>
            <p className="text-tv-base text-game-muted">
              {error || 'Creating game...'}
            </p>
          </div>
        </div>
      </>
    );
  }

  // Lobby screen
  if (screen === 'lobby' && game) {
    return (
      <>
        <ConnectionStatus state={connectionState} />
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

  // Placeholder for other screens
  return (
    <>
      <ConnectionStatus state={connectionState} />
      <div className="min-h-screen flex items-center justify-center bg-game-bg">
        <div className="text-center">
          <h1 className="text-tv-xl font-bold text-game-text mb-4">Party Popper</h1>
          <p className="text-tv-base text-game-muted">Screen: {screen}</p>
        </div>
      </div>
    </>
  );
}

export default App;
