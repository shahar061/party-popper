import { useState, useEffect } from 'react';
import type { GameState, NewRoundPhase, RoundPhase } from '@party-popper/shared';
import { TVLayout } from './TVLayout';
import { CompactTimelinePanel } from './TimelineDisplay';
import { SongQRCode } from './SongQRCode';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface GameplayScreenProps {
  game: GameState;
  onNextRound: () => void;
}

export function GameplayScreen({ game, onNextRound }: GameplayScreenProps) {
  const { currentRound, teams, settings } = game;

  if (!currentRound) {
    return (
      <TVLayout fullScreen>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-game-text mb-4">No Active Round</h1>
            <p className="text-xl text-game-muted">Waiting for round to start...</p>
          </div>
        </div>
      </TVLayout>
    );
  }

  const activeTeamKey = currentRound.activeTeam;
  const vetoTeamKey = activeTeamKey === 'A' ? 'B' : 'A';
  const activeTeam = teams[activeTeamKey];
  const vetoTeam = teams[vetoTeamKey];

  return (
    <TVLayout fullScreen>
      {/* 3-Column Grid Layout */}
      <div className="h-full grid grid-cols-[1fr_2fr_1fr] gap-3">
        {/* Left Panel - Team A Timeline */}
        <CompactTimelinePanel
          timeline={teams.A.timeline}
          teamName={teams.A.name}
          tokens={teams.A.tokens}
          score={teams.A.score}
          isActive={activeTeamKey === 'A'}
          testId="timeline-team-a"
        />

        {/* Center Panel - Game Action */}
        <GameActionPanel
          round={currentRound}
          activeTeamName={activeTeam.name}
          vetoTeamName={vetoTeam.name}
          targetScore={settings.targetScore}
          gameCode={game.joinCode}
          onNextRound={onNextRound}
          activeTeamTimeline={activeTeam.timeline}
          placement={currentRound.placement}
        />

        {/* Right Panel - Team B Timeline */}
        <CompactTimelinePanel
          timeline={teams.B.timeline}
          teamName={teams.B.name}
          tokens={teams.B.tokens}
          score={teams.B.score}
          isActive={activeTeamKey === 'B'}
          testId="timeline-team-b"
        />
      </div>
    </TVLayout>
  );
}

// Consolidated Game Action Panel
interface GameActionPanelProps {
  round: NonNullable<GameState['currentRound']>;
  activeTeamName: string;
  vetoTeamName: string;
  targetScore: number;
  gameCode: string;
  onNextRound: () => void;
  activeTeamTimeline: GameState['teams']['A']['timeline'];
  placement?: { position: number } | null;
}

function GameActionPanel({
  round,
  activeTeamName,
  vetoTeamName,
  targetScore,
  gameCode,
  onNextRound,
  activeTeamTimeline,
  placement,
}: GameActionPanelProps) {
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [logStatus, setLogStatus] = useState<'idle' | 'logging' | 'success' | 'error'>('idle');
  const phase = round.phase as NewRoundPhase | RoundPhase;

  // Build QR URL for logging
  const QR_BASE_URL = import.meta.env.VITE_QR_BASE_URL || API_URL;
  const PLAYLIST_ID = '7KZdOsKtIGfE9YKiJjyM8I';
  const trackId = round.song.spotifyUri.startsWith('spotify:track:')
    ? round.song.spotifyUri.replace('spotify:track:', '')
    : round.song.spotifyUri;
  const spotifyUrl = `https://open.spotify.com/track/${trackId}?context=spotify:playlist:${PLAYLIST_ID}`;
  const qrCodeUrl = `${QR_BASE_URL}/qr/track?code=${gameCode}&spotify=${encodeURIComponent(spotifyUrl)}`;

  const logQrUrl = async (type: 'success' | 'failed') => {
    setLogStatus('logging');
    try {
      await fetch(`${API_URL}/api/qr-log/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: qrCodeUrl,
          songTitle: `${round.song.artist} - ${round.song.title}`,
          gameCode,
        }),
      });
      setLogStatus('success');
      setTimeout(() => setLogStatus('idle'), 2000);
    } catch {
      setLogStatus('error');
      setTimeout(() => setLogStatus('idle'), 2000);
    }
  };

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

  // Timer hasn't started yet if endsAt is more than 5 minutes in the future
  const timerStarted = round.endsAt - Date.now() < 5 * 60 * 1000;
  const isUrgent = remainingTime < 10000 && timerStarted;

  // Get placement description
  const getPlacementDescription = (): string => {
    if (!placement) return 'in timeline';
    if (placement.position === 0) return 'at the beginning';
    if (placement.position >= activeTeamTimeline.length) return 'at the end';
    return `between position ${placement.position} and ${placement.position + 1}`;
  };

  // Phase-specific colors
  const phaseColors: Record<string, string> = {
    listening: 'text-white',
    quiz: 'text-yellow-400',
    placement: 'text-blue-400',
    veto_window: 'text-purple-400',
    veto_placement: 'text-red-400',
    reveal: 'text-green-400',
  };

  const phaseLabels: Record<string, string> = {
    listening: 'LISTENING',
    quiz: 'QUIZ TIME',
    placement: 'PLACEMENT',
    veto_window: 'VETO WINDOW',
    veto_placement: 'VETO PLACEMENT',
    reveal: 'REVEAL',
  };

  return (
    <div className="h-full flex flex-col bg-gray-900/50 rounded-xl p-4 border border-gray-700">
      {/* Round info header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-400 text-sm">
          Round {round.number} &bull; First to {targetScore}
        </div>
        <div className={`text-sm font-bold phase-indicator ${phaseColors[phase] || 'text-white'}`}>
          {phaseLabels[phase] || phase.toUpperCase()}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {/* Phase-specific content */}
        {phase === 'listening' && (
          <>
            <div className="text-2xl font-bold text-white">
              {activeTeamName}'s Turn
            </div>
            <SongQRCode spotifyUri={round.song.spotifyUri} gameCode={gameCode} size={200} />
            {/* QR Debug Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => logQrUrl('success')}
                disabled={logStatus === 'logging'}
                className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white rounded transition-colors"
              >
                {logStatus === 'logging' ? '...' : logStatus === 'success' ? '✓' : 'Works'}
              </button>
              <button
                onClick={() => logQrUrl('failed')}
                disabled={logStatus === 'logging'}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white rounded transition-colors"
              >
                {logStatus === 'logging' ? '...' : logStatus === 'success' ? '✓' : "Doesn't Work"}
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {round.song.artist} - {round.song.title}
            </div>
            <div
              data-testid="round-timer"
              className="text-5xl font-mono font-bold text-white"
            >
              {timerStarted ? formatTime(remainingTime) : 'Scan QR to start'}
            </div>
          </>
        )}

        {phase === 'quiz' && (
          <>
            <div className="text-2xl font-bold text-white">
              {activeTeamName} is answering
            </div>
            <div
              data-testid="round-timer"
              className={`text-6xl font-mono font-bold ${isUrgent ? 'timer-urgent' : 'text-yellow-400'}`}
            >
              {formatTime(remainingTime)}
            </div>
            <div className="text-lg text-gray-300">
              Answer the quiz on your device
            </div>
            {/* QR Debug Buttons - also shown in quiz phase for broken link reporting */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => logQrUrl('success')}
                disabled={logStatus === 'logging'}
                className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white rounded transition-colors"
              >
                {logStatus === 'logging' ? '...' : logStatus === 'success' ? '✓' : 'QR Worked'}
              </button>
              <button
                onClick={() => logQrUrl('failed')}
                disabled={logStatus === 'logging'}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white rounded transition-colors"
              >
                {logStatus === 'logging' ? '...' : logStatus === 'success' ? '✓' : 'QR Failed'}
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {round.song.artist} - {round.song.title}
            </div>
          </>
        )}

        {phase === 'placement' && (
          <>
            <div className="text-2xl font-bold text-white">
              {activeTeamName} is placing
            </div>
            <div
              data-testid="round-timer"
              className={`text-6xl font-mono font-bold ${isUrgent ? 'timer-urgent' : 'text-blue-400'}`}
            >
              {formatTime(remainingTime)}
            </div>
            <div className="text-lg text-gray-300">
              Place the song on your timeline
            </div>
          </>
        )}

        {phase === 'veto_window' && (
          <>
            <div className="text-2xl font-bold text-purple-400 animate-pulse">
              VETO WINDOW
            </div>
            <div className="text-lg text-white">
              {activeTeamName} placed the song {getPlacementDescription()}
            </div>
            <div className="text-xl font-bold text-yellow-400">
              {vetoTeamName}: Will you challenge?
            </div>
            <div
              data-testid="round-timer"
              className={`text-6xl font-mono font-bold ${isUrgent ? 'timer-urgent' : 'text-purple-400'}`}
            >
              {formatTime(remainingTime)}
            </div>
          </>
        )}

        {phase === 'veto_placement' && (
          <>
            <div className="text-2xl font-bold text-white">
              {vetoTeamName} is placing veto
            </div>
            <div
              data-testid="round-timer"
              className={`text-6xl font-mono font-bold ${isUrgent ? 'timer-urgent' : 'text-red-400'}`}
            >
              {formatTime(remainingTime)}
            </div>
            <div className="text-lg text-gray-300">
              Place the song where you think it belongs
            </div>
          </>
        )}

        {phase === 'reveal' && (
          <>
            <div className="text-2xl font-bold text-green-400">
              Round Result
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-white">
                {round.song.title}
              </div>
              <div className="text-2xl text-gray-300">
                {round.song.artist}
              </div>
              <div className="text-3xl font-bold text-yellow-400">
                {round.song.year}
              </div>
            </div>
            <button
              onClick={onNextRound}
              className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 text-white text-xl font-bold rounded-lg transition-colors pulse-glow"
            >
              Next Round
            </button>
          </>
        )}

        {/* Legacy phases fallback */}
        {(phase === 'guessing' || phase === 'waiting') && (
          <>
            <div className="text-2xl font-bold text-white">
              {activeTeamName}'s Turn
            </div>
            <SongQRCode spotifyUri={round.song.spotifyUri} gameCode={gameCode} size={200} />
            <div
              data-testid="round-timer"
              className="text-5xl font-mono font-bold text-white"
            >
              {timerStarted ? formatTime(remainingTime) : 'Waiting...'}
            </div>
            {phase === 'waiting' && (
              <button
                onClick={onNextRound}
                className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 text-white text-xl font-bold rounded-lg transition-colors"
              >
                Next Round
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
