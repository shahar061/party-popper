import type { GameState } from '@party-popper/shared';
import { TVLayout } from './TVLayout';
import { ScoreBoard } from './ScoreBoard';
import { RoundDisplay } from './RoundDisplay';
import { AnswerDisplay } from './AnswerDisplay';

interface GameplayScreenProps {
  game: GameState;
  onNextRound: () => void;
}

export function GameplayScreen({ game, onNextRound }: GameplayScreenProps) {
  const { currentRound, teams, settings } = game;

  if (!currentRound) {
    return (
      <TVLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-tv-2xl font-bold text-game-text mb-4">No Active Round</h1>
            <p className="text-tv-base text-game-muted">Waiting for round to start...</p>
          </div>
        </div>
      </TVLayout>
    );
  }

  const activeTeam = teams[currentRound.activeTeam];
  const { phase, currentAnswer } = currentRound;

  return (
    <TVLayout>
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
        {/* Scoreboard */}
        <ScoreBoard
          teamAScore={teams.A.score}
          teamBScore={teams.B.score}
          teamAName={teams.A.name}
          teamBName={teams.B.name}
          activeTeam={currentRound.activeTeam}
          targetScore={settings.targetScore}
        />

        {/* Round Display */}
        <RoundDisplay
          round={currentRound}
          teamName={activeTeam.name}
          gameCode={game.joinCode}
        />

        {/* Answer Display (only show in reveal or waiting phase) */}
        {(phase === 'reveal' || phase === 'waiting') && currentAnswer && (
          <AnswerDisplay
            teamName={activeTeam.name}
            artist={currentAnswer.artist}
            title={currentAnswer.title}
            year={currentAnswer.year}
          />
        )}

        {/* Next Round Button (only show in waiting phase) */}
        {phase === 'waiting' && (
          <button
            onClick={onNextRound}
            className="px-8 py-4 bg-game-primary hover:bg-game-primary-hover text-white text-2xl font-bold rounded-lg transition-colors"
          >
            Next Round
          </button>
        )}

        {/* Phase Indicator */}
        <div className="text-center text-game-muted text-xl">
          {phase === 'guessing' && 'Waiting for answer...'}
          {phase === 'reveal' && 'Answer revealed!'}
          {phase === 'waiting' && 'Ready for next round'}
        </div>
      </div>
    </TVLayout>
  );
}
