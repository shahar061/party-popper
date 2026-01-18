import type { TeammateQuizVote } from '@party-popper/shared';

interface TeamVotesPanelProps {
  votes: TeammateQuizVote[];
  artists: string[];
  titles: string[];
}

export function TeamVotesPanel({ votes, artists, titles }: TeamVotesPanelProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-yellow-500/30">
      <h4 className="text-yellow-400 font-bold text-sm mb-2">Team Votes</h4>
      <div className="space-y-1">
        {votes.map(vote => (
          <div key={vote.playerId} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{vote.playerName}:</span>
            {vote.artistIndex !== null && vote.titleIndex !== null ? (
              <span className="text-white">{artists[vote.artistIndex]} / {titles[vote.titleIndex]}</span>
            ) : (
              <span className="text-gray-500 italic">(thinking...)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
