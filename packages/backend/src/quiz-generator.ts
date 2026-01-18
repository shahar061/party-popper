import type { Song, QuizOptions } from '@party-popper/shared';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateQuizOptions(correctSong: Song, songPool: Song[]): QuizOptions {
  // Filter out the correct song and get unique artists/titles
  const otherSongs = songPool.filter(s => s.id !== correctSong.id);
  const shuffled = shuffleArray(otherSongs);

  // Get unique artists (excluding correct)
  const uniqueArtists = new Set<string>();
  for (const song of shuffled) {
    if (song.artist !== correctSong.artist) {
      uniqueArtists.add(song.artist);
    }
    if (uniqueArtists.size >= 3) break;
  }

  // Get unique titles (excluding correct)
  const uniqueTitles = new Set<string>();
  for (const song of shuffled) {
    if (song.title !== correctSong.title) {
      uniqueTitles.add(song.title);
    }
    if (uniqueTitles.size >= 3) break;
  }

  // Build options arrays
  const wrongArtists = Array.from(uniqueArtists).slice(0, 3);
  const wrongTitles = Array.from(uniqueTitles).slice(0, 3);

  // Combine with correct answer and shuffle
  const artists = shuffleArray([correctSong.artist, ...wrongArtists]);
  const songTitles = shuffleArray([correctSong.title, ...wrongTitles]);

  // Find correct indices
  const correctArtistIndex = artists.indexOf(correctSong.artist);
  const correctTitleIndex = songTitles.indexOf(correctSong.title);

  return {
    artists,
    songTitles,
    correctArtistIndex,
    correctTitleIndex,
  };
}
