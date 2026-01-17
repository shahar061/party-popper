interface ScoreBoardProps {
  teamAScore: number;
  teamBScore: number;
  teamAName: string;
  teamBName: string;
  activeTeam: 'A' | 'B';
  targetScore: number;
}

export function ScoreBoard({
  teamAScore,
  teamBScore,
  teamAName,
  teamBName,
  activeTeam,
  targetScore
}: ScoreBoardProps) {
  return (
    <div className="flex items-center justify-center gap-8">
      <TeamScore
        testId="score-team-a"
        name={teamAName}
        score={teamAScore}
        isActive={activeTeam === 'A'}
        showIndicator={activeTeam === 'A'}
        indicatorTestId="turn-indicator-a"
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
}

function TeamScore({
  testId,
  name,
  score,
  isActive,
  showIndicator,
  indicatorTestId
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
      <div className="text-6xl font-bold text-white">{score}</div>
    </div>
  );
}
