// apps/host/src/components/VictoryScreen.tsx
import type { TimelineSong } from '@party-popper/shared';

interface VictoryScreenProps {
  winnerName: string;
  winnerTeam: 'A' | 'B';
  teamAScore: number;
  teamBScore: number;
  teamATimeline: TimelineSong[];
  teamBTimeline: TimelineSong[];
  teamAName?: string;
  teamBName?: string;
}

export function VictoryScreen({
  winnerName,
  winnerTeam,
  teamAScore,
  teamBScore,
  teamATimeline,
  teamBTimeline,
  teamAName = 'Team A',
  teamBName = 'Team B'
}: VictoryScreenProps) {
  const winnerColor = winnerTeam === 'A' ? 'text-blue-400' : 'text-orange-400';

  return (
    <div
      data-testid="victory-screen"
      className="min-h-screen bg-gray-900 p-8 victory-celebration relative overflow-hidden"
    >
      {/* Confetti background effect */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#3b82f6', '#f97316', '#eab308', '#22c55e', '#ef4444'][i % 5],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random()}s`
            }}
          />
        ))}
      </div>

      {/* Winner Announcement */}
      <div className="text-center mb-12 relative z-10">
        <div className="text-8xl mb-4">🏆</div>
        <div className="text-3xl text-yellow-400 uppercase tracking-wider mb-2">
          Winner
        </div>
        <div className={`text-6xl font-bold ${winnerColor}`}>
          {winnerName}
        </div>
      </div>

      {/* Final Scores */}
      <div className="flex justify-center gap-16 mb-12 relative z-10">
        <div className="text-center">
          <div className="text-xl text-blue-400 mb-2">{teamAName}</div>
          <div
            data-testid="final-score-a"
            className={`text-6xl font-bold ${winnerTeam === 'A' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            {teamAScore}
          </div>
        </div>
        <div className="text-4xl text-gray-500 self-center">vs</div>
        <div className="text-center">
          <div className="text-xl text-orange-400 mb-2">{teamBName}</div>
          <div
            data-testid="final-score-b"
            className={`text-6xl font-bold ${winnerTeam === 'B' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            {teamBScore}
          </div>
        </div>
      </div>

      {/* Timelines */}
      <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto relative z-10">
        <div className="bg-gray-800/80 rounded-xl p-6">
          <h3 className="text-xl font-bold text-blue-400 mb-4">{teamAName}'s Timeline</h3>
          <div className="space-y-2">
            {teamATimeline.map((song) => (
              <div key={song.id} className="flex justify-between text-gray-300">
                <span>{song.title}</span>
                <span className="text-gray-500">{song.year}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/80 rounded-xl p-6">
          <h3 className="text-xl font-bold text-orange-400 mb-4">{teamBName}'s Timeline</h3>
          <div className="space-y-2">
            {teamBTimeline.map((song) => (
              <div key={song.id} className="flex justify-between text-gray-300">
                <span>{song.title}</span>
                <span className="text-gray-500">{song.year}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
