import type { Team, GameSettings } from '@party-popper/shared';
import { TeamRoster } from './TeamRoster';
import { JoinQRCode } from './JoinQRCode';
import { GameSettingsPanel } from './GameSettingsPanel';

interface LobbyScreenProps {
  joinCode: string;
  playerAppUrl: string;
  teams: {
    A: Team;
    B: Team;
  };
  settings: GameSettings;
  onMovePlayer?: (playerId: string, toTeam: 'A' | 'B') => void;
  onUpdateSettings?: (settings: Partial<GameSettings>) => void;
  onStartGame?: () => void;
}

export function LobbyScreen({
  joinCode,
  playerAppUrl,
  teams,
  settings,
  onMovePlayer,
  onUpdateSettings,
  onStartGame,
}: LobbyScreenProps) {
  const joinUrl = `${playerAppUrl}?code=${joinCode}`;
  const hasPlayers = teams.A.players.length > 0 || teams.B.players.length > 0;
  const canStart = teams.A.players.length >= 1 && teams.B.players.length >= 1;

  return (
    <div className="flex flex-col items-center min-h-screen bg-game-bg p-8">
      {/* Header with Join Code and QR */}
      <div className="text-center mb-8">
        <h1 className="text-tv-xl font-bold text-game-text mb-4">Party Popper</h1>
        <div className="flex items-center justify-center gap-8">
          {/* QR Code */}
          <JoinQRCode url={joinUrl} size={200} />

          {/* Join Code */}
          <div className="bg-game-surface rounded-xl px-8 py-6 border-2 border-game-border">
            <p className="text-tv-sm text-game-muted mb-2">Join Code</p>
            <span className="text-tv-code font-bold tracking-wider text-game-text">
              {joinCode}
            </span>
            <p className="text-tv-sm text-game-muted mt-4">
              <span className="font-mono text-game-text">{joinUrl}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Teams and Settings */}
      <div className="flex-1 flex items-start justify-center gap-8 w-full max-w-6xl">
        {/* Team Roster or Waiting Message */}
        <div className="flex-1">
          {hasPlayers ? (
            <TeamRoster teams={teams} onMovePlayer={onMovePlayer} />
          ) : (
            <WaitingForPlayers />
          )}
        </div>

        {/* Settings Panel */}
        {onUpdateSettings && (
          <div className="w-80">
            <GameSettingsPanel
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          </div>
        )}
      </div>

      {/* Start Game Button */}
      {onStartGame && (
        <div className="mt-8">
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className={`
              px-12 py-4 rounded-xl text-tv-lg font-bold
              transition-all duration-200
              ${
                canStart
                  ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                  : 'bg-game-surface text-game-muted cursor-not-allowed'
              }
            `}
          >
            {canStart ? 'Start Game' : 'Need 1+ player per team'}
          </button>
        </div>
      )}
    </div>
  );
}

function WaitingForPlayers() {
  return (
    <div className="flex flex-col items-center gap-6">
      <WaitingDots />
      <span className="text-tv-lg text-game-muted">Waiting for players to join...</span>
    </div>
  );
}

function WaitingDots() {
  return (
    <div className="flex gap-3">
      <span className="w-5 h-5 bg-team-a-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-5 h-5 bg-team-b-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-5 h-5 bg-game-text rounded-full animate-bounce" />
    </div>
  );
}
