// apps/host/src/components/VetoWindow.tsx
interface VetoWindowProps {
  remainingTime: number;
  vetoingTeam: 'A' | 'B';
  teamAName?: string;
  teamBName?: string;
  isActive: boolean;
}

export function VetoWindow({
  remainingTime,
  vetoingTeam,
  teamAName = 'Team A',
  teamBName = 'Team B',
  isActive
}: VetoWindowProps) {
  if (!isActive) return null;

  const seconds = Math.ceil(remainingTime / 1000);
  const teamName = vetoingTeam === 'A' ? teamAName : teamBName;
  const isUrgent = seconds <= 5;

  return (
    <div
      data-testid="veto-window"
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
    >
      <div className="bg-gray-900 rounded-3xl p-12 text-center border-4 border-yellow-500 shadow-2xl shadow-yellow-500/20">
        <div className="text-2xl text-yellow-400 uppercase tracking-wider mb-4">
          Veto Challenge Window
        </div>

        <div className="text-xl text-gray-300 mb-8">
          <span className="font-bold text-white">{teamName}</span> can challenge the answer!
        </div>

        <div
          data-testid="veto-countdown"
          className={`text-9xl font-bold text-white mb-8 ${isUrgent ? 'animate-pulse text-red-500' : ''}`}
        >
          {seconds}
        </div>

        <div className="text-lg text-gray-400">
          seconds remaining
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-8 rounded-full transition-all duration-300 ${
                i < seconds ? 'bg-yellow-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
