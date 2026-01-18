import type { Player } from '@party-popper/shared';

interface ScoreBoardProps {
  teamAScore: number;
  teamBScore: number;
  teamAName: string;
  teamBName: string;
  activeTeam: 'A' | 'B';
  targetScore: number;
  teamAPlayers?: Player[];
  teamBPlayers?: Player[];
}

export function ScoreBoard({
  teamAScore,
  teamBScore,
  teamAName,
  teamBName,
  activeTeam,
  targetScore,
  teamAPlayers,
  teamBPlayers
}: ScoreBoardProps) {
  const teamALeader = teamAPlayers?.find(p => p.isTeamLeader);
  const teamBLeader = teamBPlayers?.find(p => p.isTeamLeader);

  return (
    <div className="flex items-center justify-center gap-8">
      <TeamScore
        testId="score-team-a"
        name={teamAName}
        score={teamAScore}
        isActive={activeTeam === 'A'}
        showIndicator={activeTeam === 'A'}
        indicatorTestId="turn-indicator-a"
        leaderName={teamALeader?.name}
      />

      <div className="text-center">
        <div className="text-gray-400 text-lg">First to</div>
        <div className="text-4xl font-bold text-white">{targetScore}</div>
      </div>

      <TeamScore
        testId="score-team-b"
        name={teamBName}
        score={teamBScore}
        isActive={activeTeam === 'B'}
        showIndicator={activeTeam === 'B'}
        indicatorTestId="turn-indicator-b"
        leaderName={teamBLeader?.name}
      />
    </div>
  );
}

interface TeamScoreProps {
  testId: string;
  name: string;
  score: number;
  isActive: boolean;
  showIndicator: boolean;
  indicatorTestId: string;
  leaderName?: string;
}

function TeamScore({
  testId,
  name,
  score,
  isActive,
  showIndicator,
  indicatorTestId,
  leaderName
}: TeamScoreProps) {
  return (
    <div
      data-testid={testId}
      className={`
        relative bg-gray-800 rounded-xl p-6 min-w-[200px] text-center
        transition-all duration-300
        ${isActive ? 'ring-4 ring-yellow-400 shadow-glow' : ''}
      `}
    >
      {showIndicator && (
        <div
          data-testid={indicatorTestId}
          className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 text-3xl animate-bounce"
        >
          ▼
        </div>
      )}

      <div className="text-xl text-gray-300 mb-2">{name}</div>
      {leaderName && (
        <div className="text-sm text-yellow-400 mb-1">
          👑 {leaderName}
        </div>
      )}
      <div className="text-6xl font-bold text-white">{score}</div>
    </div>
  );
}
