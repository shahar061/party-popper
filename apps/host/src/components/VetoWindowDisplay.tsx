interface VetoWindowDisplayProps {
  activeTeamName: string;
  vetoTeamName: string;
  placement: string;
  timeRemaining: number;
}

export function VetoWindowDisplay({
  activeTeamName,
  vetoTeamName,
  placement,
  timeRemaining,
}: VetoWindowDisplayProps) {
  return (
    <div className="bg-red-900/30 border-4 border-red-500 rounded-2xl p-8 text-center space-y-6">
      <h2 className="text-4xl font-bold text-red-400 animate-pulse">
        VETO WINDOW
      </h2>

      <div className="space-y-4">
        <p className="text-2xl text-white">
          {activeTeamName} placed the song {placement}
        </p>

        <p className="text-3xl font-bold text-yellow-400">
          {vetoTeamName}: Will you challenge?
        </p>
      </div>

      <div className="text-6xl font-mono font-bold text-red-400">
        {Math.ceil(timeRemaining / 1000)}
      </div>
    </div>
  );
}
