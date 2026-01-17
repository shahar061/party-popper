// apps/host/src/components/VetoTokenDisplay.tsx
interface VetoTokenDisplayProps {
  teamATokens: number;
  teamBTokens: number;
  teamAName?: string;
  teamBName?: string;
}

const MAX_TOKENS = 3;

function TokenIcon({ active, testId }: { active: boolean; testId: string }) {
  return (
    <div
      data-testid={testId}
      className={`w-8 h-8 rounded-full border-2 border-yellow-500 flex items-center justify-center transition-opacity ${
        active ? 'opacity-100 bg-yellow-500' : 'opacity-30 bg-transparent'
      }`}
    >
      <span className={`text-sm font-bold ${active ? 'text-black' : 'text-yellow-500'}`}>V</span>
    </div>
  );
}

function TeamTokens({
  tokens,
  teamId,
  teamName
}: {
  tokens: number;
  teamId: 'a' | 'b';
  teamName: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm text-gray-300">{teamName}</div>
      <div className="flex gap-2">
        {Array.from({ length: MAX_TOKENS }).map((_, i) => (
          <TokenIcon
            key={i}
            active={i < tokens}
            testId={`team-${teamId}-token-${i}`}
          />
        ))}
      </div>
      <div
        data-testid={`team-${teamId}-count`}
        className="text-lg font-bold text-yellow-400"
      >
        {tokens}
      </div>
    </div>
  );
}

export function VetoTokenDisplay({
  teamATokens,
  teamBTokens,
  teamAName = 'Team A',
  teamBName = 'Team B'
}: VetoTokenDisplayProps) {
  return (
    <div className="flex justify-between items-center gap-8 bg-gray-800 rounded-lg p-4">
      <TeamTokens tokens={teamATokens} teamId="a" teamName={teamAName} />
      <div className="text-gray-500 text-sm">VETO TOKENS</div>
      <TeamTokens tokens={teamBTokens} teamId="b" teamName={teamBName} />
    </div>
  );
}
