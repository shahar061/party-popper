import type { Team } from '@party-popper/shared';
import { TeamRoster } from './TeamRoster';

interface LobbyScreenProps {
  joinCode: string;
  playerAppUrl: string;
  teams: {
    A: Team;
    B: Team;
  };
  onMovePlayer?: (playerId: string, toTeam: 'A' | 'B') => void;
}

export function LobbyScreen({
  joinCode,
  playerAppUrl,
  teams,
  onMovePlayer,
}: LobbyScreenProps) {
  const joinUrl = `${playerAppUrl}?code=${joinCode}`;
  const hasPlayers = teams.A.players.length > 0 || teams.B.players.length > 0;

  return (
    <div className="flex flex-col items-center min-h-screen bg-game-bg p-8">
      {/* Header with Join Code */}
      <div className="text-center mb-8">
        <h1 className="text-tv-xl font-bold text-game-text mb-2">Party Popper</h1>
        <div className="flex items-center justify-center gap-4">
          <div className="bg-game-surface rounded-xl px-8 py-4 border-2 border-game-border">
            <p className="text-tv-sm text-game-muted mb-1">Join Code</p>
            <span className="text-tv-code font-bold tracking-wider text-game-text">
              {joinCode}
            </span>
          </div>
        </div>
        <p className="text-tv-sm text-game-muted mt-4">
          Visit <span className="font-mono text-game-text">{joinUrl}</span>
        </p>
      </div>

      {/* Team Roster or Waiting Message */}
      <div className="flex-1 flex items-center justify-center w-full">
        {hasPlayers ? (
          <TeamRoster teams={teams} onMovePlayer={onMovePlayer} />
        ) : (
          <WaitingForPlayers />
        )}
      </div>
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
