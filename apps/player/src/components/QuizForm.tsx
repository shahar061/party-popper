import { useState } from 'react';

interface QuizFormProps {
  artists: string[];
  songTitles: string[];
  onSubmit: (artistIndex: number, titleIndex: number) => void;
  disabled?: boolean;
  timeRemaining?: number;
}

export function QuizForm({
  artists,
  songTitles,
  onSubmit,
  disabled = false,
  timeRemaining,
}: QuizFormProps) {
  const [selectedArtist, setSelectedArtist] = useState<number | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<number | null>(null);

  const canSubmit = selectedArtist !== null && selectedTitle !== null && !disabled;

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

      {/* Submit Button */}
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
    </div>
  );
}
