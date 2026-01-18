import type { TeammatePlacementVote, TimelineSong } from '@party-popper/shared';

interface PlacementSuggestionsPanelProps {
  votes: TeammatePlacementVote[];
  timeline: TimelineSong[];
}

function getPositionLabel(position: number, timeline: TimelineSong[]): string {
  if (timeline.length === 0) return 'First position';
  if (position === 0) return `Before ${timeline[0].year}`;
  if (position >= timeline.length) return `After ${timeline[timeline.length - 1].year}`;
  return `Between ${timeline[position - 1].year} and ${timeline[position].year}`;
}

export function PlacementSuggestionsPanel({ votes, timeline }: PlacementSuggestionsPanelProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-yellow-500/30">
      <h4 className="text-yellow-400 font-bold text-sm mb-2">Team Suggestions</h4>
      <div className="space-y-1">
        {votes.map(vote => (
          <div key={vote.playerId} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{vote.playerName}:</span>
            {vote.position !== null ? (
              <span className="text-white">{getPositionLabel(vote.position, timeline)}</span>
            ) : (
              <span className="text-gray-500 italic">(thinking...)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
