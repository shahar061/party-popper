// apps/player/src/components/TurnStatus.tsx
interface TurnStatusProps {
  isMyTurn: boolean;
  teamName: string;
  opponentTeamName?: string;
}

export function TurnStatus({
  isMyTurn,
  teamName,
  opponentTeamName = 'Other team'
}: TurnStatusProps) {
  return (
    <div
      data-testid="turn-status"
      className={`
        w-full py-4 px-6 rounded-lg text-center transition-all duration-300
        ${isMyTurn ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'}
      `}
    >
      <div className="text-lg font-medium">{teamName}</div>

      {isMyTurn ? (
        <div className="text-2xl font-bold mt-1">
          It's Your Turn!
        </div>
      ) : (
        <div className="text-xl mt-1">
          Waiting for {opponentTeamName}...
        </div>
      )}
    </div>
  );
}
