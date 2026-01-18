import type { Song } from '@party-popper/shared';

export interface ValidationResult {
  artistCorrect: boolean;
  titleCorrect: boolean;
  yearScore: number;
  totalScore: number;
}

interface RoundResultProps {
  song: Song;
  validation: ValidationResult;
  teamName: string;
}

export function RoundResult({ song, validation, teamName }: RoundResultProps) {
  const { artistCorrect, titleCorrect, yearScore, totalScore } = validation;

  const getYearBadgeColor = () => {
    if (yearScore === 1) return 'bg-green-500';
    if (yearScore === 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 animate-fade-in">
      <h2 className="text-2xl text-gray-300">{teamName}'s Answer</h2>

      <div className="text-center space-y-4">
        <div className="text-5xl font-bold text-white">
          {song.title}
        </div>
        <div className="text-3xl text-gray-300">
          {song.artist}
        </div>
        <div className="text-4xl text-yellow-400 font-bold">
          {song.year}
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        <ResultBadge
          testId="result-artist"
          label="Artist"
          correct={artistCorrect}
        />
        <ResultBadge
          testId="result-title"
          label="Title"
          correct={titleCorrect}
        />
        <div
          data-testid="result-year"
          className={`px-4 py-2 rounded-full text-white font-bold ${getYearBadgeColor()}`}
        >
          Year {yearScore === 1 ? '✓' : yearScore === 0.5 ? '~' : '✗'}
        </div>
      </div>

      <div
        data-testid="points-animation"
        className="text-6xl font-bold text-green-400 animate-bounce"
      >
        +{totalScore}
      </div>

      {totalScore > 0 ? (
        <p className="text-xl text-green-400">Song added to timeline!</p>
      ) : (
        <p className="text-xl text-red-400">No points scored</p>
      )}
    </div>
  );
}

interface ResultBadgeProps {
  testId: string;
  label: string;
  correct: boolean;
}

function ResultBadge({ testId, label, correct }: ResultBadgeProps) {
  return (
    <div
      data-testid={testId}
      className={`px-4 py-2 rounded-full text-white font-bold ${
        correct ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      {label} {correct ? '✓' : '✗'}
    </div>
  );
}
