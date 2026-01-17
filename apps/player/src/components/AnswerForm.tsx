import { useState, FormEvent } from 'react';

interface AnswerFormData {
  artist: string;
  title: string;
  year: number;
}

interface AnswerFormProps {
  onSubmit: (data: AnswerFormData) => void;
  onTyping: (field: string, value: string) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function AnswerForm({
  onSubmit,
  onTyping,
  isSubmitting = false,
  disabled = false
}: AnswerFormProps) {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (artist && title && year) {
      onSubmit({
        artist,
        title,
        year: parseInt(year, 10)
      });
    }
  };

  const handleArtistChange = (value: string) => {
    setArtist(value);
    onTyping('artist', value);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    onTyping('title', value);
  };

  const handleYearChange = (value: string) => {
    setYear(value);
    onTyping('year', value);
  };

  const isDisabled = disabled || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="artist" className="block text-lg font-medium text-white mb-2">
          Artist
        </label>
        <input
          id="artist"
          type="text"
          value={artist}
          onChange={(e) => handleArtistChange(e.target.value)}
          disabled={isDisabled}
          className="w-full px-4 py-3 text-lg rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none disabled:opacity-50"
          placeholder="Enter artist name"
        />
      </div>

      <div>
        <label htmlFor="title" className="block text-lg font-medium text-white mb-2">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={isDisabled}
          className="w-full px-4 py-3 text-lg rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none disabled:opacity-50"
          placeholder="Enter song title"
        />
      </div>

      <div>
        <label htmlFor="year" className="block text-lg font-medium text-white mb-2">
          Year
        </label>
        <input
          id="year"
          type="number"
          min="1950"
          max="2030"
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          disabled={isDisabled}
          className="w-full px-4 py-3 text-lg rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none disabled:opacity-50"
          placeholder="Enter release year"
        />
      </div>

      <button
        type="submit"
        disabled={isDisabled || !artist || !title || !year}
        className="w-full py-4 text-xl font-bold rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Answer'}
      </button>
    </form>
  );
}
