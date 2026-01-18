import { useState, useEffect } from 'react';
import type { TeammateQuizVote } from '@party-popper/shared';
import { TeamVotesPanel } from './TeamVotesPanel';

interface QuizFormProps {
  artists: string[];
  songTitles: string[];
  onSubmit: (artistIndex: number, titleIndex: number) => void;
  onSuggestionChange?: (artistIndex: number | null, titleIndex: number | null) => void;
  disabled?: boolean;
  timeRemaining?: number;
  isTeamLeader?: boolean;
  teamVotes?: TeammateQuizVote[];
}

export function QuizForm({
  artists,
  songTitles,
  onSubmit,
  onSuggestionChange,
  disabled = false,
  timeRemaining,
  isTeamLeader = true,
  teamVotes = [],
}: QuizFormProps) {
  const [selectedArtist, setSelectedArtist] = useState<number | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<number | null>(null);
  const [suggestionSent, setSuggestionSent] = useState(false);

  const canSubmit = selectedArtist !== null && selectedTitle !== null && !disabled;

  // Send suggestion when selection changes (for non-leaders)
  useEffect(() => {
    if (!isTeamLeader && onSuggestionChange) {
      onSuggestionChange(selectedArtist, selectedTitle);
      if (selectedArtist !== null && selectedTitle !== null) {
        setSuggestionSent(true);
      }
    }
  }, [selectedArtist, selectedTitle, isTeamLeader, onSuggestionChange]);

  const handleSubmit = () => {
    if (selectedArtist !== null && selectedTitle !== null) {
      onSubmit(selectedArtist, selectedTitle);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center">
          <span className="text-4xl font-mono font-bold text-yellow-400">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
      )}

      {/* Artist Selection */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-white text-center">Who sings this?</h3>
        <div className="grid grid-cols-2 gap-3">
          {artists.map((artist, index) => (
            <button
              key={index}
              onClick={() => setSelectedArtist(index)}
              disabled={disabled}
              className={`p-4 rounded-lg text-lg font-medium transition-all ${
                selectedArtist === index
                  ? 'bg-yellow-500 text-black ring-4 ring-yellow-300'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {artist}
            </button>
          ))}
        </div>
      </div>

      {/* Song Title Selection */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-white text-center">What's the song?</h3>
        <div className="grid grid-cols-2 gap-3">
          {songTitles.map((title, index) => (
            <button
              key={index}
              onClick={() => setSelectedTitle(index)}
              disabled={disabled}
              className={`p-4 rounded-lg text-lg font-medium transition-all ${
                selectedTitle === index
                  ? 'bg-yellow-500 text-black ring-4 ring-yellow-300'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {/* Team Votes Panel (for leaders only) */}
      {isTeamLeader && teamVotes.length > 0 && (
        <TeamVotesPanel votes={teamVotes} artists={artists} titles={songTitles} />
      )}

      {/* Submit Button or Suggestion Status */}
      {isTeamLeader ? (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 text-xl font-bold rounded-lg transition-colors ${
            canSubmit
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Submit Answer
        </button>
      ) : (
        <div className="text-center py-4">
          {suggestionSent ? (
            <p className="text-green-400 font-medium">
              Your suggestion has been sent to your team leader
            </p>
          ) : (
            <p className="text-gray-400">
              Select your answer to suggest it to your team leader
            </p>
          )}
        </div>
      )}
    </div>
  );
}
