import type { TeammateVetoVote } from '@party-popper/shared';

interface VetoSuggestionsPanelProps {
  votes: TeammateVetoVote[];
}

export function VetoSuggestionsPanel({ votes }: VetoSuggestionsPanelProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-red-500/30">
      <h4 className="text-red-400 font-bold text-sm mb-2">Team Suggestions</h4>
      <div className="space-y-1">
        {votes.map(vote => (
          <div key={vote.playerId} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{vote.playerName}:</span>
            {vote.useVeto !== null ? (
              <span className={vote.useVeto ? 'text-red-400' : 'text-gray-300'}>
                {vote.useVeto ? 'Use Veto' : 'Pass'}
              </span>
            ) : (
              <span className="text-gray-500 italic">(thinking...)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
