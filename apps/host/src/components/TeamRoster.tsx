import type { Team, Player } from '@party-popper/shared';
import { GAME_CONSTANTS } from '@party-popper/shared';

interface TeamRosterProps {
  teams: {
    A: Team;
    B: Team;
  };
  onMovePlayer?: (playerId: string, toTeam: 'A' | 'B') => void;
}

export function TeamRoster({ teams, onMovePlayer }: TeamRosterProps) {
  return (
    <div className="grid grid-cols-2 gap-8 w-full max-w-4xl">
      <TeamColumn
        team={teams.A}
        teamId="A"
        color="team-a"
        onMovePlayer={onMovePlayer}
      />
      <TeamColumn
        team={teams.B}
        teamId="B"
        color="team-b"
        onMovePlayer={onMovePlayer}
      />
    </div>
  );
}

interface TeamColumnProps {
  team: Team;
  teamId: 'A' | 'B';
  color: 'team-a' | 'team-b';
  onMovePlayer?: (playerId: string, toTeam: 'A' | 'B') => void;
}

function TeamColumn({ team, teamId, color, onMovePlayer }: TeamColumnProps) {
  const maxPlayers = GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM;
  const emptySlots = maxPlayers - team.players.length;
  const hasLeader = team.players.some(p => p.isTeamLeader);
  const hasPlayers = team.players.length > 0;

  return (
    <div className={`bg-game-surface rounded-xl p-6 border-2 border-${color}-500`}>
      <h3 className={`text-tv-lg font-bold text-${color}-500 mb-6 text-center`}>
        {team.name}
      </h3>

      {/* Show waiting for leader message if team has players but no leader */}
      {hasPlayers && !hasLeader && (
        <div className="text-center text-game-muted text-tv-sm mb-3 animate-pulse">
          Waiting for leader...
        </div>
      )}

      <div className="space-y-3">
        {team.players.map((player) => (
          <PlayerSlot
            key={player.id}
            player={player}
            color={color}
            oppositeTeam={teamId === 'A' ? 'B' : 'A'}
            onMovePlayer={onMovePlayer}
          />
        ))}

        {Array.from({ length: emptySlots }).map((_, idx) => (
          <EmptySlot key={`empty-${idx}`} />
        ))}
      </div>
    </div>
  );
}

interface PlayerSlotProps {
  player: Player;
  color: 'team-a' | 'team-b';
  oppositeTeam: 'A' | 'B';
  onMovePlayer?: (playerId: string, toTeam: 'A' | 'B') => void;
}

function PlayerSlot({ player, color, oppositeTeam, onMovePlayer }: PlayerSlotProps) {
  return (
    <div
      className={`
        flex items-center justify-between
        bg-game-bg rounded-lg px-4 py-3
        border border-game-border
        animate-slideIn
      `}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full ${
            player.connected ? `bg-${color}-500` : 'bg-game-muted'
          }`}
        />
        <span className="text-tv-base text-game-text">
          {player.isTeamLeader && <span className="mr-1">👑</span>}
          {player.name}
        </span>
      </div>

      {onMovePlayer && (
        <button
          onClick={() => onMovePlayer(player.id, oppositeTeam)}
          className={`
            text-tv-sm text-game-muted hover:text-${color}-500
            transition-colors px-3 py-1 rounded
            hover:bg-game-surface
          `}
          aria-label={`Move ${player.name} to Team ${oppositeTeam}`}
        >
          Move
        </button>
      )}
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      className={`
        flex items-center justify-center
        bg-game-bg/50 rounded-lg px-4 py-3
        border border-dashed border-game-border
      `}
    >
      <span className="text-tv-sm text-game-muted">Empty slot</span>
    </div>
  );
}
