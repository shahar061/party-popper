import { useState, useEffect } from 'react';
import type { GameState, NewRoundPhase, TeammateQuizVote, TeammatePlacementVote, TeammateVetoVote } from '@party-popper/shared';
import { Layout } from './Layout';
import { TurnStatus } from './TurnStatus';
import { QuizForm } from './QuizForm';
import { TimelinePlacement } from './TimelinePlacement';
import { VetoDecision } from './VetoDecision';

interface PlayingViewProps {
  gameState: GameState;
  playerId: string;
  onSubmitQuiz: (artistIndex: number, titleIndex: number) => void;
  onSubmitPlacement: (position: number) => void;
  onUseVeto: () => void;
  onPassVeto: () => void;
  onSubmitVetoPlacement: (position: number) => void;
  onReady: () => void;
  scanDetected: boolean;
  onQuizSuggestion?: (artistIndex: number | null, titleIndex: number | null) => void;
  onPlacementSuggestion?: (position: number) => void;
  onVetoSuggestion?: (useVeto: boolean) => void;
  teamQuizVotes?: TeammateQuizVote[];
  teamPlacementVotes?: TeammatePlacementVote[];
  teamVetoVotes?: TeammateVetoVote[];
}

export function PlayingView({
  gameState,
  playerId,
  onSubmitQuiz,
  onSubmitPlacement,
  onUseVeto,
  onPassVeto,
  onSubmitVetoPlacement,
  onReady,
  scanDetected,
  onQuizSuggestion,
  onPlacementSuggestion,
  onVetoSuggestion,
  teamQuizVotes = [],
  teamPlacementVotes = [],
  teamVetoVotes = [],
}: PlayingViewProps) {
  const { currentRound, teams } = gameState;
  const [selectedPlacement, setSelectedPlacement] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Find which team the player is on
  const playerTeam = teams.A.players.find(p => p.id === playerId) ? 'A' : 'B';
  const myTeam = teams[playerTeam];
  const otherTeam = playerTeam === 'A' ? teams.B : teams.A;

  // Check if current player is team leader
  const currentPlayer = myTeam.players.find(p => p.id === playerId);
  const isTeamLeader = currentPlayer?.isTeamLeader ?? false;

  // Timer effect
  useEffect(() => {
    if (!currentRound) return;

    const updateTimer = () => {
      const remaining = Math.max(0, currentRound.endsAt - Date.now());
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [currentRound?.endsAt]);

  // Reset placement when phase changes
  useEffect(() => {
    setSelectedPlacement(null);
  }, [currentRound?.phase]);

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
  const phase = currentRound.phase as NewRoundPhase;
  const isVetoTeam = !isMyTurn;

  const handlePlacementSelect = (position: number) => {
    setSelectedPlacement(position);
    if (isTeamLeader) {
      onSubmitPlacement(position);
    } else if (onPlacementSuggestion) {
      onPlacementSuggestion(position);
    }
  };

  const handleVetoPlacementSelect = (position: number) => {
    setSelectedPlacement(position);
    if (isTeamLeader) {
      onSubmitVetoPlacement(position);
    } else if (onPlacementSuggestion) {
      onPlacementSuggestion(position);
    }
  };

  // Get placement description for veto window
  const getPlacementDescription = (): string => {
    if (!currentRound.placement) return 'somewhere';
    const pos = currentRound.placement.position;
    const timeline = teams[currentRound.activeTeam].timeline;

    if (timeline.length === 0) return 'on an empty timeline';
    if (pos === 0) return `before ${timeline[0].year}`;
    if (pos >= timeline.length) return `after ${timeline[timeline.length - 1].year}`;
    return `between ${timeline[pos - 1].year} and ${timeline[pos].year}`;
  };

  return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        {/* Turn Status */}
        <TurnStatus
          isMyTurn={isMyTurn}
          teamName={myTeam.name}
          opponentTeamName={otherTeam.name}
        />

        {/* Token Display */}
        <div className="flex gap-4 text-lg">
          <span className="text-yellow-400">Your Tokens: {myTeam.tokens}</span>
        </div>

        {/* Phase-specific content */}
        {phase === 'listening' && isMyTurn && (
          <div className="text-center space-y-4">
            {scanDetected ? (
              <div className="text-xl text-green-400 font-semibold animate-pulse">
                Scan detected! Starting quiz...
              </div>
            ) : (
              <>
                <div className="text-xl text-white">
                  Scan the QR code on the TV to hear the song!
                </div>
                <button
                  onClick={onReady}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-lg transition-colors"
                >
                  Ready! I'm Listening
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'quiz' && isMyTurn && currentRound.quizOptions && (
          <QuizForm
            artists={currentRound.quizOptions.artists}
            songTitles={currentRound.quizOptions.songTitles}
            onSubmit={onSubmitQuiz}
            onSuggestionChange={onQuizSuggestion}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.quizAnswer}
            isTeamLeader={isTeamLeader}
            teamVotes={teamQuizVotes}
          />
        )}

        {phase === 'placement' && isMyTurn && (
          <TimelinePlacement
            timeline={myTeam.timeline}
            onSelectPosition={handlePlacementSelect}
            selectedPosition={selectedPlacement}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.placement}
            isTeamLeader={isTeamLeader}
            teamSuggestions={teamPlacementVotes}
          />
        )}

        {phase === 'veto_window' && isVetoTeam && (
          <VetoDecision
            tokensAvailable={myTeam.tokens}
            opponentPlacement={getPlacementDescription()}
            onUseVeto={onUseVeto}
            onPass={onPassVeto}
            onSuggestionChange={onVetoSuggestion}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.vetoDecision}
            isTeamLeader={isTeamLeader}
            teamSuggestions={teamVetoVotes}
          />
        )}

        {phase === 'veto_placement' && isVetoTeam && (
          <TimelinePlacement
            timeline={myTeam.timeline}
            onSelectPosition={handleVetoPlacementSelect}
            selectedPosition={selectedPlacement}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.vetoPlacement}
            isTeamLeader={isTeamLeader}
            teamSuggestions={teamPlacementVotes}
          />
        )}

        {/* Waiting states */}
        {phase === 'listening' && !isMyTurn && (
          <div className="text-xl text-gray-300">{otherTeam.name} is listening...</div>
        )}

        {phase === 'quiz' && !isMyTurn && (
          <div className="text-xl text-gray-300">{otherTeam.name} is answering the quiz...</div>
        )}

        {phase === 'placement' && !isMyTurn && (
          <div className="text-xl text-gray-300">{otherTeam.name} is placing the song...</div>
        )}

        {phase === 'veto_window' && !isVetoTeam && (
          <div className="text-xl text-gray-300">Waiting for veto decision...</div>
        )}

        {phase === 'veto_placement' && !isVetoTeam && (
          <div className="text-xl text-gray-300">Veto team is placing...</div>
        )}

        {phase === 'reveal' && (
          <div className="text-center space-y-4">
            <div className="text-2xl text-white">Round Complete!</div>
            <div className="text-4xl font-bold text-yellow-400">{currentRound.song.title}</div>
            <div className="text-2xl text-gray-300">{currentRound.song.artist}</div>
            <div className="text-xl text-yellow-500">{currentRound.song.year}</div>
          </div>
        )}

        {/* Score Display */}
        <div className="flex gap-8 mt-8">
          <div className="text-center">
            <div className="text-lg text-gray-400">{myTeam.name}</div>
            <div className="text-4xl font-bold text-white">{myTeam.timeline.length}</div>
            <div className="text-sm text-gray-500">songs</div>
          </div>
          <div className="text-2xl text-gray-500">-</div>
          <div className="text-center">
            <div className="text-lg text-gray-400">{otherTeam.name}</div>
            <div className="text-4xl font-bold text-white">{otherTeam.timeline.length}</div>
            <div className="text-sm text-gray-500">songs</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
