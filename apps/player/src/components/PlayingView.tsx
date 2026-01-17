import type { GameState } from '@party-popper/shared';
import { Layout } from './Layout';
import { TurnStatus } from './TurnStatus';
import { AnswerForm } from './AnswerForm';

interface PlayingViewProps {
  gameState: GameState;
  playerId: string;
  onSubmitAnswer: (data: { artist: string; title: string; year: number }) => void;
  onTyping: (field: string, value: string) => void;
}

export function PlayingView({
  gameState,
  playerId,
  onSubmitAnswer,
  onTyping,
}: PlayingViewProps) {
  const { currentRound, teams } = gameState;

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
            <h2 className="text-2xl font-bold text-white text-center">
              Submit Your Answer
            </h2>
            <AnswerForm
              onSubmit={onSubmitAnswer}
              onTyping={onTyping}
            />
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
