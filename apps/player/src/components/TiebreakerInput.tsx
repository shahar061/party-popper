// apps/player/src/components/TiebreakerInput.tsx
import { useState } from 'react';

interface TiebreakerAnswer {
  artist: string;
  title: string;
  year: string;
}

interface TiebreakerInputProps {
  onSubmit: (answer: TiebreakerAnswer) => void;
  hasSubmitted: boolean;
}

export function TiebreakerInput({ onSubmit, hasSubmitted }: TiebreakerInputProps) {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ artist, title, year });
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <div className="text-center mb-6">
        <div className="text-2xl font-bold text-yellow-400 animate-pulse">
          ⚡ TIEBREAKER ⚡
        </div>
        <div className="text-sm text-gray-400 mt-2">
          Both teams racing to answer!
        </div>
      </div>

      {hasSubmitted && (
        <div className="text-center py-4 mb-4">
          <div className="text-2xl font-bold text-green-400">
            ✓ Answer Submitted!
          </div>
          <div className="text-gray-400 mt-1">
            Waiting for result...
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          disabled={hasSubmitted}
          className={`w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 ${
            hasSubmitted ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={hasSubmitted}
          className={`w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 ${
            hasSubmitted ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        <input
          type="text"
          placeholder="Year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={hasSubmitted}
          className={`w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 ${
            hasSubmitted ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        {!hasSubmitted && (
          <button
            type="submit"
            className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 text-white text-xl font-bold rounded-xl transition-colors"
          >
            Submit Answer
          </button>
        )}
      </form>
    </div>
  );
}
