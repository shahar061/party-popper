// apps/host/src/components/TiebreakerScreen.tsx
import type { Song } from '@party-popper/shared';
import { SongQRCode } from './SongQRCode';

interface TiebreakerScreenProps {
  song: Song;
  teamAName: string;
  teamBName: string;
  teamASubmitted: boolean;
  teamBSubmitted: boolean;
  winner?: 'A' | 'B' | null;
}

export function TiebreakerScreen({
  song,
  teamAName,
  teamBName,
  teamASubmitted,
  teamBSubmitted,
  winner
}: TiebreakerScreenProps) {
  const winnerName = winner === 'A' ? teamAName : winner === 'B' ? teamBName : null;

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="text-center mb-8">
        <div className="text-4xl font-bold text-yellow-400 animate-pulse">
          ⚡ TIEBREAKER ⚡
        </div>
        <div className="text-xl text-gray-400 mt-2">
          First correct answer wins!
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <SongQRCode spotifyUri={song.spotifyUri} size={200} />
      </div>

      <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Team A Panel */}
        <div
          data-testid="team-a-panel"
          className="bg-gray-800 rounded-2xl p-6 border-4 border-blue-500"
        >
          <div className="text-2xl font-bold text-blue-400 mb-4">{teamAName}</div>
          {teamASubmitted ? (
            <div data-testid="team-a-submitted" className="text-green-400 text-xl flex items-center gap-2">
              <span>✓</span> Answer Submitted
            </div>
          ) : (
            <div className="text-gray-400 text-xl animate-pulse">
              Waiting for answer...
            </div>
          )}
        </div>

        {/* Team B Panel */}
        <div
          data-testid="team-b-panel"
          className="bg-gray-800 rounded-2xl p-6 border-4 border-orange-500"
        >
          <div className="text-2xl font-bold text-orange-400 mb-4">{teamBName}</div>
          {teamBSubmitted ? (
            <div data-testid="team-b-submitted" className="text-green-400 text-xl flex items-center gap-2">
              <span>✓</span> Answer Submitted
            </div>
          ) : (
            <div className="text-gray-400 text-xl animate-pulse">
              Waiting for answer...
            </div>
          )}
        </div>
      </div>

      {/* Winner Announcement */}
      {winner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl mb-8">🏆</div>
            <div className="text-6xl font-bold text-yellow-400 mb-4">
              {winnerName} WINS!
            </div>
            <div className="text-2xl text-white">
              Tiebreaker Champion
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
