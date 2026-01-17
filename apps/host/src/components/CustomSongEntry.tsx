// apps/host/src/components/CustomSongEntry.tsx
import { useState } from 'react';
import type { Song } from '@party-popper/shared';

interface SongInput {
  spotifyUrl: string;
  artist: string;
  title: string;
  year: string;
}

interface CustomSongEntryProps {
  songs: Song[];
  onAddSong: (song: SongInput) => void;
  onRemoveSong: (id: string) => void;
  minimumSongs?: number;
}

export function CustomSongEntry({
  songs,
  onAddSong,
  onRemoveSong,
  minimumSongs = 10
}: CustomSongEntryProps) {
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddSong({ spotifyUrl, artist, title, year });
    setSpotifyUrl('');
    setArtist('');
    setTitle('');
    setYear('');
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Custom Mode - Add Songs</h2>

      <div className="mb-6 text-gray-400">
        <span className="text-xl font-bold text-white">{songs.length}</span> of {minimumSongs} songs added
        {songs.length < minimumSongs && (
          <span className="ml-2 text-yellow-400">(need {minimumSongs - songs.length} more)</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <input
          type="text"
          placeholder="Spotify URL (e.g., https://open.spotify.com/track/...)"
          value={spotifyUrl}
          onChange={(e) => setSpotifyUrl(e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
        />
        <div className="grid grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
          />
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
          />
          <input
            type="text"
            placeholder="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
        >
          Add Song
        </button>
      </form>

      {songs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-300 mb-3">Song List</h3>
          {songs.map((song) => (
            <div
              key={song.id}
              className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
            >
              <div className="flex-1">
                <span className="text-white font-medium">{song.title}</span>
                <span className="text-gray-400 mx-2">-</span>
                <span className="text-gray-400">{song.artist}</span>
                <span className="text-gray-500 ml-2">({song.year})</span>
              </div>
              <button
                data-testid={`delete-song-${song.id}`}
                onClick={() => onRemoveSong(song.id)}
                className="ml-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
