import { useState, useEffect } from 'react';
import type { Round } from '@party-popper/shared';
import { SongQRCode } from './SongQRCode';

interface RoundDisplayProps {
  round: Round;
  teamName?: string;
  gameCode: string;
}

export function RoundDisplay({ round, teamName = 'Current Team', gameCode }: RoundDisplayProps) {
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, round.endsAt - Date.now());
      setRemainingTime(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [round.endsAt]);

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const isRevealed = round.phase === 'reveal';

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-2xl font-bold text-white">
        {teamName}'s Turn
      </div>

      <SongQRCode spotifyUri={round.song.spotifyUri} gameCode={gameCode} size={250} />

      <div
        data-testid="round-timer"
        className="text-6xl font-mono font-bold text-white"
      >
        {formatTime(remainingTime)}
      </div>

      {isRevealed && (
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold text-white">
            {round.song.title}
          </div>
          <div className="text-2xl text-gray-300">
            {round.song.artist}
          </div>
          <div className="text-xl text-yellow-400">
            {round.song.year}
          </div>
        </div>
      )}

      {!isRevealed && (
        <div className="text-center">
          <div className="text-xl font-bold text-white mb-2">
            Scan to open in Spotify
          </div>
          <div className="text-base text-gray-400">
            (Then tap play to hear the song)
          </div>
        </div>
      )}
    </div>
  );
}
