// apps/player/src/components/VetoCountdown.tsx
interface VetoCountdownProps {
  remainingTime: number;
  isActive: boolean;
}

export function VetoCountdown({ remainingTime, isActive }: VetoCountdownProps) {
  if (!isActive) {
    return null;
  }

  const seconds = Math.ceil(remainingTime / 1000);
  const isUrgent = seconds <= 5;

  return (
    <div className="bg-gray-800 rounded-2xl p-6 text-center">
      <div className="text-lg text-yellow-400 mb-2">
        Challenge Window Open!
      </div>
      <div
        data-testid="veto-countdown"
        className={`text-6xl font-bold mb-2 ${
          isUrgent ? 'text-red-500 animate-pulse' : 'text-white'
        }`}
      >
        {seconds}
      </div>
      <div className="text-sm text-gray-400">
        seconds to challenge
      </div>
    </div>
  );
}
