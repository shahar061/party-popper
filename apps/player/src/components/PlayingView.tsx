import { useState, useEffect } from 'react';
import type { GameState } from '@party-popper/shared';
import { Layout } from './Layout';
import { TurnStatus } from './TurnStatus';
import { AnswerForm } from './AnswerForm';

interface PlayingViewProps {
  gameState: GameState;
  playerId: string;
  onSubmitAnswer: (data: { artist: string; title: string; year: number }) => void;
  onTyping: (field: string, value: string) => void;
  onReady: () => void;
  scanDetected: boolean;
}

export function PlayingView({
  gameState,
  playerId,
  onSubmitAnswer,
  onTyping,
  onReady,
  scanDetected,
}: PlayingViewProps) {
  const { currentRound, teams } = gameState;
  const [confirmed, setConfirmed] = useState(false);

  // Auto-confirm when scan is detected (after the 2-second delay in App.tsx)
  useEffect(() => {
    if (scanDetected) {
      const timer = setTimeout(() => {
        setConfirmed(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanDetected]);

  // Find which team the player is on
  const playerTeam = teams.A.players.find(p => p.id === playerId) ? 'A' : 'B';
  const myTeam = teams[playerTeam];
  const otherTeam = playerTeam === 'A' ? teams.B : teams.A;

  if (!currentRound) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Waiting for Round</h1>
            <p className="text-xl text-gray-300">The host will start the next round soon...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const isMyTurn = currentRound.activeTeam === playerTeam;
  const { phase } = currentRound;

  // Show answer form only when:
  // 1. It's my team's turn
  // 2. Phase is 'guessing'
  // 3. No answer submitted yet
  const canSubmitAnswer = isMyTurn && phase === 'guessing' && !currentRound.currentAnswer;

  return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        {/* Turn Status */}
        <TurnStatus
          isMyTurn={isMyTurn}
          teamName={myTeam.name}
          opponentTeamName={otherTeam.name}
        />

        {/* Conditional Content */}
        {canSubmitAnswer ? (
          <>
            {/* Ready Button - Show before answer form if not confirmed */}
            {!confirmed && (
              <div className="text-center space-y-6 mb-6">
                {scanDetected ? (
                  <div className="text-xl text-green-400 font-semibold animate-pulse">
                    Scan detected! Starting soon...
                  </div>
                ) : (
                  <>
                    <div className="text-xl text-white">
                      Scan the QR code on the TV to hear the song!
                    </div>
                    <button
                      onClick={() => {
                        onReady();
                        setConfirmed(true);
                      }}
                      className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-lg transition-colors"
                    >
                      Ready! I'm Listening
                    </button>
                    <div className="text-sm text-gray-400">
                      (Tap when you've scanned and started the song)
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Answer Form - Show after ready confirmation */}
            {confirmed && (
              <>
                <h2 className="text-2xl font-bold text-white text-center">
                  Submit Your Answer
                </h2>
                <AnswerForm
                  onSubmit={onSubmitAnswer}
                  onTyping={onTyping}
                />
              </>
            )}
          </>
        ) : (
          <div className="text-center space-y-4">
            {phase === 'guessing' && isMyTurn && currentRound.currentAnswer && (
              <div className="text-xl text-white">
                Answer submitted! Waiting for reveal...
              </div>
            )}
            {phase === 'guessing' && !isMyTurn && (
              <div className="text-xl text-gray-300">
                {otherTeam.name} is answering...
              </div>
            )}
            {phase === 'reveal' && (
              <div className="text-xl text-white">
                Answer revealed!
              </div>
            )}
            {phase === 'waiting' && (
              <div className="text-xl text-gray-300">
                Waiting for next round...
              </div>
            )}
          </div>
        )}

        {/* Score Display */}
        <div className="flex gap-8 mt-8">
          <div className="text-center">
            <div className="text-lg text-gray-400">{myTeam.name}</div>
            <div className="text-4xl font-bold text-white">{myTeam.score}</div>
          </div>
          <div className="text-2xl text-gray-500">-</div>
          <div className="text-center">
            <div className="text-lg text-gray-400">{otherTeam.name}</div>
            <div className="text-4xl font-bold text-white">{otherTeam.score}</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
