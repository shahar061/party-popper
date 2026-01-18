import { useState, useEffect } from 'react';
import type { Round, NewRoundPhase } from '@party-popper/shared';
import { SongQRCode } from './SongQRCode';

interface RoundDisplayProps {
  round: Round;
  teamName?: string;
  vetoTeamName?: string;
  gameCode: string;
}

export function RoundDisplay({ round, teamName = 'Current Team', vetoTeamName, gameCode }: RoundDisplayProps) {
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

  // Cast phase to NewRoundPhase for type safety
  const phase = round.phase as NewRoundPhase;

  // Timer hasn't started yet if endsAt is more than 5 minutes in the future
  // (far future date indicates waiting for QR scan)
  const timerStarted = round.endsAt - Date.now() < 5 * 60 * 1000;

  // Determine the veto team (opposite of active team)
  const vetoTeam = vetoTeamName || (round.activeTeam === 'A' ? 'Team B' : 'Team A');

  // Render phase-specific content
  const renderPhaseContent = () => {
    switch (phase) {
      case 'listening':
        return (
          <>
            <div className="text-2xl font-bold text-white">
              {teamName}'s Turn
            </div>
            <SongQRCode spotifyUri={round.song.spotifyUri} gameCode={gameCode} size={250} />
            <div
              data-testid="round-timer"
              className="text-6xl font-mono font-bold text-white"
            >
              {timerStarted ? formatTime(remainingTime) : 'Waiting for scan...'}
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                Scan the QR code to start the timer
              </div>
            </div>
          </>
        );

      case 'quiz':
        return (
          <>
            <div className="text-2xl font-bold text-white">
              {teamName} is answering
            </div>
            <div
              data-testid="round-timer"
              className="text-6xl font-mono font-bold text-yellow-400"
            >
              {formatTime(remainingTime)}
            </div>
            <div className="text-center">
              <div className="text-xl text-gray-300">
                Answer the quiz on your device
              </div>
            </div>
          </>
        );

      case 'placement':
        return (
          <>
            <div className="text-2xl font-bold text-white">
              {teamName} is placing
            </div>
            <div
              data-testid="round-timer"
              className="text-6xl font-mono font-bold text-blue-400"
            >
              {formatTime(remainingTime)}
            </div>
            <div className="text-center">
              <div className="text-xl text-gray-300">
                Place the song on your timeline
              </div>
            </div>
          </>
        );

      case 'veto_window':
        return (
          <>
            <div className="text-2xl font-bold text-white">
              {vetoTeam}: Will you challenge?
            </div>
            <div
              data-testid="round-timer"
              className="text-6xl font-mono font-bold text-purple-400"
            >
              {formatTime(remainingTime)}
            </div>
            <div className="text-center">
              <div className="text-xl text-gray-300">
                Use a token to challenge the placement
              </div>
            </div>
          </>
        );

      case 'veto_placement':
        return (
          <>
            <div className="text-2xl font-bold text-white">
              {vetoTeam} is placing veto
            </div>
            <div
              data-testid="round-timer"
              className="text-6xl font-mono font-bold text-red-400"
            >
              {formatTime(remainingTime)}
            </div>
            <div className="text-center">
              <div className="text-xl text-gray-300">
                Place the song where you think it belongs
              </div>
            </div>
          </>
        );

      case 'reveal':
        return (
          <>
            <div className="text-2xl font-bold text-white">
              Round Result
            </div>
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
          </>
        );

      default:
        // Fallback for legacy phases or unknown phases
        return (
          <>
            <div className="text-2xl font-bold text-white">
              {teamName}'s Turn
            </div>
            <SongQRCode spotifyUri={round.song.spotifyUri} gameCode={gameCode} size={250} />
            <div
              data-testid="round-timer"
              className="text-6xl font-mono font-bold text-white"
            >
              {timerStarted ? formatTime(remainingTime) : 'Waiting for scan...'}
            </div>
          </>
        );
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {renderPhaseContent()}
    </div>
  );
}
