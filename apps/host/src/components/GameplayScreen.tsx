import type { GameState } from '@party-popper/shared';
import { TVLayout } from './TVLayout';
import { ScoreBoard } from './ScoreBoard';
import { RoundDisplay } from './RoundDisplay';
import { AnswerDisplay } from './AnswerDisplay';
import { TimelineDisplay } from './TimelineDisplay';
import { VetoWindowDisplay } from './VetoWindowDisplay';

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
  const vetoTeam = currentRound.activeTeam === 'A' ? teams.B : teams.A;
  const { phase, currentAnswer, placement } = currentRound;

  // Calculate time remaining for veto window
  const now = Date.now();
  const vetoTimeRemaining = currentRound.endsAt - now;

  // Generate placement description for veto display
  const getPlacementDescription = (): string => {
    if (!placement) return 'in timeline';
    const timeline = activeTeam.timeline;
    if (placement.position === 0) return 'at the beginning';
    if (placement.position >= timeline.length) return 'at the end';
    return `between position ${placement.position} and ${placement.position + 1}`;
  };

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

        {/* Timeline Display - shows both team timelines with tokens */}
        <TimelineDisplay
          teamATimeline={teams.A.timeline}
          teamBTimeline={teams.B.timeline}
          teamAName={teams.A.name}
          teamBName={teams.B.name}
          teamATokens={teams.A.tokens}
          teamBTokens={teams.B.tokens}
        />

        {/* Veto Window Display - only during veto_window phase */}
        {phase === 'veto_window' && (
          <VetoWindowDisplay
            activeTeamName={activeTeam.name}
            vetoTeamName={vetoTeam.name}
            placement={getPlacementDescription()}
            timeRemaining={vetoTimeRemaining}
          />
        )}

        {/* Round Display */}
        <RoundDisplay
          round={currentRound}
          teamName={activeTeam.name}
          gameCode={game.joinCode}
        />

        {/* Answer Display (only show in reveal phase) */}
        {phase === 'reveal' && currentAnswer && (
          <AnswerDisplay
            teamName={activeTeam.name}
            artist={currentAnswer.artist}
            title={currentAnswer.title}
            year={currentAnswer.year}
          />
        )}

        {/* Next Round Button (only show in waiting phase - legacy) */}
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
          {/* Legacy phases */}
          {phase === 'guessing' && 'Waiting for answer...'}
          {phase === 'waiting' && 'Ready for next round'}
          {/* New quiz phases */}
          {phase === 'listening' && 'Listen to the song...'}
          {phase === 'quiz' && `${activeTeam.name}: Answer the quiz!`}
          {phase === 'placement' && `${activeTeam.name}: Place the song in your timeline!`}
          {phase === 'veto_window' && `${vetoTeam.name}: Will you challenge?`}
          {phase === 'veto_placement' && `${vetoTeam.name}: Place your guess!`}
          {phase === 'reveal' && 'Answer revealed!'}
        </div>
      </div>
    </TVLayout>
  );
}
