import type { Team } from '@party-popper/shared';

interface LobbyViewProps {
  teamA: Team;
  teamB: Team;
  currentPlayerId: string;
  gameCode: string;
  isStarting?: boolean;
  onClaimLeader?: () => void;
}

interface TeamColumnProps {
  team: Team;
  teamLabel: 'A' | 'B';
  currentPlayerId: string;
}

function TeamColumn({ team, teamLabel, currentPlayerId }: TeamColumnProps) {
  const isTeamA = teamLabel === 'A';
  const headerColor = isTeamA ? 'bg-team-a-600' : 'bg-team-b-600';
  const borderColor = isTeamA ? 'border-team-a-700/50' : 'border-team-b-700/50';
  const bgColor = isTeamA ? 'bg-team-a-700/20' : 'bg-team-b-700/20';

  return (
    <div className={`flex-1 rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
      <div className={`${headerColor} px-3 py-2`}>
        <h3 className="text-sm font-semibold text-white text-center">
          {team.name || `Team ${teamLabel}`}
        </h3>
      </div>

      <ul className="p-3 space-y-2">
        {team.players.map((player) => (
          <li
            key={player.id}
            className={`flex items-center gap-2 text-sm ${
              player.id === currentPlayerId
                ? 'font-semibold text-white'
                : 'text-game-text/80'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                player.connected ? 'bg-green-500' : 'bg-game-muted'
              }`}
              aria-label={player.connected ? 'Online' : 'Offline'}
            />
            <span className="truncate">{player.name}</span>
            {player.id === currentPlayerId && (
              <span className="text-xs text-game-muted">(you)</span>
            )}
          </li>
        ))}

        {team.players.length === 0 && (
          <li className="text-sm text-game-muted italic text-center py-2">
            No players yet
          </li>
        )}
      </ul>
    </div>
  );
}

export function LobbyView({
  teamA,
  teamB,
  currentPlayerId,
  gameCode,
  isStarting = false,
  onClaimLeader
}: LobbyViewProps) {
  const totalPlayers = teamA.players.length + teamB.players.length;

  // Find which team the current player is on
  const currentPlayer = teamA.players.find(p => p.id === currentPlayerId) || teamB.players.find(p => p.id === currentPlayerId);
  const myTeam = currentPlayer?.team === 'A' ? teamA : teamB;
  const leader = myTeam.players.find(p => p.isTeamLeader);

  return (
    <div className="flex flex-col flex-1">
      {/* Header with game code */}
      <div className="text-center mb-6">
        <p className="text-sm text-game-muted mb-1">Game Code</p>
        <p className="text-2xl font-mono font-bold tracking-widest text-white">
          {gameCode}
        </p>
        <p className="text-sm text-game-muted mt-2">
          {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} in lobby
        </p>
      </div>

      {/* Teams side by side */}
      <div className="flex gap-3 flex-1 min-h-0">
        <TeamColumn
          team={teamA}
          teamLabel="A"
          currentPlayerId={currentPlayerId}
        />
        <TeamColumn
          team={teamB}
          teamLabel="B"
          currentPlayerId={currentPlayerId}
        />
      </div>

      {/* Team Leader Section */}
      {currentPlayer && (
        <div className="mt-4 text-center">
          {leader ? (
            <div className="inline-flex items-center gap-2 text-yellow-400 font-medium">
              <span>👑</span>
              <span>{leader.name} is your Team Leader</span>
            </div>
          ) : onClaimLeader ? (
            <button
              onClick={onClaimLeader}
              className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors"
            >
              Be Team Leader
            </button>
          ) : null}
        </div>
      )}

      {/* Status footer */}
      <div className="mt-6 text-center py-4">
        {isStarting ? (
          <div className="inline-flex items-center gap-2 text-green-400 font-medium">
            <svg
              className="w-5 h-5 animate-pulse"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span>Game is starting!</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-game-muted">
            <svg
              className="w-5 h-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Waiting for host to start...</span>
          </div>
        )}
      </div>
    </div>
  );
}
