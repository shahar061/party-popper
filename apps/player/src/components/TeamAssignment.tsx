import type { Team } from '@party-popper/shared';

interface TeamAssignmentProps {
  assignedTeam: 'A' | 'B';
  teamA: Team;
  teamB: Team;
  playerName: string;
}

export function TeamAssignment({
  assignedTeam,
  teamA,
  teamB,
  playerName
}: TeamAssignmentProps) {
  const myTeam = assignedTeam === 'A' ? teamA : teamB;
  const isTeamA = assignedTeam === 'A';

  const teamColorClasses = isTeamA
    ? 'bg-team-a-600 border-team-a-500'
    : 'bg-team-b-600 border-team-b-500';

  const teamBgClasses = isTeamA
    ? 'bg-team-a-700/20 border-team-a-700/50'
    : 'bg-team-b-700/20 border-team-b-700/50';

  return (
    <div className="flex flex-col flex-1">
      {/* Team badge */}
      <div className="text-center mb-8">
        <div className={`inline-block px-6 py-3 rounded-2xl ${teamColorClasses}`}>
          <p className="text-sm text-white/80 mb-1">You are on</p>
          <h2 className="text-2xl font-bold text-white">
            {myTeam.name || `Team ${assignedTeam}`}
          </h2>
        </div>
      </div>

      {/* Teammates list */}
      <div className={`rounded-xl border p-4 mb-6 ${teamBgClasses}`}>
        <h3 className="text-sm font-medium text-game-muted mb-3">Your Teammates</h3>
        <ul className="space-y-2">
          {myTeam.players.map((player) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 ${
                player.name === playerName ? 'font-bold text-white' : 'text-game-text/80'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  player.connected ? 'bg-green-500' : 'bg-game-muted'
                }`}
                aria-label={player.connected ? 'Online' : 'Offline'}
              />
              <span>{player.name}</span>
              {player.name === playerName && (
                <span className="text-xs text-game-muted">(you)</span>
              )}
            </li>
          ))}
        </ul>

        {myTeam.players.length === 1 && (
          <p className="text-sm text-game-muted mt-3 italic">
            Waiting for more teammates to join...
          </p>
        )}
      </div>

      {/* Waiting message */}
      <div className="mt-auto text-center py-8">
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
          <span>Waiting for host to start the game</span>
        </div>
      </div>
    </div>
  );
}
