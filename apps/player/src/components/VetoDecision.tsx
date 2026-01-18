import { useState } from 'react';
import type { TeammateVetoVote } from '@party-popper/shared';
import { VetoSuggestionsPanel } from './VetoSuggestionsPanel';

interface VetoDecisionProps {
  tokensAvailable: number;
  opponentPlacement: string; // e.g., "between 1975 and 1982"
  onUseVeto: () => void;
  onPass: () => void;
  onSuggestionChange?: (useVeto: boolean) => void;
  disabled?: boolean;
  timeRemaining?: number;
  isTeamLeader?: boolean;
  teamSuggestions?: TeammateVetoVote[];
}

export function VetoDecision({
  tokensAvailable,
  opponentPlacement,
  onUseVeto,
  onPass,
  onSuggestionChange,
  disabled = false,
  timeRemaining,
  isTeamLeader = true,
  teamSuggestions = [],
}: VetoDecisionProps) {
  const [suggestionSent, setSuggestionSent] = useState<'veto' | 'pass' | null>(null);
  const canUseVeto = tokensAvailable > 0 && !disabled;

  const handleSuggestVeto = () => {
    if (!isTeamLeader && onSuggestionChange) {
      onSuggestionChange(true);
      setSuggestionSent('veto');
    }
  };

  const handleSuggestPass = () => {
    if (!isTeamLeader && onSuggestionChange) {
      onSuggestionChange(false);
      setSuggestionSent('pass');
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 text-center">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center">
          <span className="text-4xl font-mono font-bold text-red-400">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
      )}

      <div className="bg-red-900/30 border border-red-500 rounded-xl p-6 space-y-4">
        <h2 className="text-2xl font-bold text-red-400">VETO OPPORTUNITY!</h2>

        <p className="text-white text-lg">
          The other team placed the song {opponentPlacement}
        </p>

        <p className="text-yellow-400 font-medium">
          You have {tokensAvailable} token{tokensAvailable !== 1 ? 's' : ''}
        </p>

        {/* Team Suggestions Panel (for leaders only) */}
        {isTeamLeader && teamSuggestions.length > 0 && (
          <VetoSuggestionsPanel votes={teamSuggestions} />
        )}

        {isTeamLeader ? (
          <div className="space-y-3 pt-4">
            <button
              onClick={onUseVeto}
              disabled={!canUseVeto}
              className={`w-full py-4 text-xl font-bold rounded-lg transition-colors ${
                canUseVeto
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              Use Veto Token
            </button>

            <button
              onClick={onPass}
              disabled={disabled}
              className="w-full py-4 text-xl font-bold rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            >
              Pass
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-4">
            {suggestionSent ? (
              <p className="text-green-400 font-medium py-4">
                Your suggestion ({suggestionSent === 'veto' ? 'Use Veto' : 'Pass'}) has been sent to your team leader
              </p>
            ) : (
              <>
                <button
                  onClick={handleSuggestVeto}
                  disabled={tokensAvailable === 0}
                  className={`w-full py-4 text-xl font-bold rounded-lg transition-colors ${
                    tokensAvailable > 0
                      ? 'bg-red-500/50 text-white hover:bg-red-500'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Suggest Use Veto
                </button>

                <button
                  onClick={handleSuggestPass}
                  className="w-full py-4 text-xl font-bold rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors"
                >
                  Suggest Pass
                </button>
              </>
            )}
          </div>
        )}

        {tokensAvailable === 0 && (
          <p className="text-gray-400 text-sm">
            No tokens available - {isTeamLeader ? 'you must pass' : 'team must pass'}
          </p>
        )}
      </div>
    </div>
  );
}
