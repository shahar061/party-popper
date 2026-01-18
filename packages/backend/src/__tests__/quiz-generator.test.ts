import { describe, it, expect } from 'vitest';
import { generateQuizOptions } from '../quiz-generator';
import type { Song } from '@party-popper/shared';

describe('generateQuizOptions', () => {
  const correctSong: Song = {
    id: '1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:1',
    spotifyUrl: 'https://open.spotify.com/track/1',
  };

  const songPool: Song[] = [
    correctSong,
    { id: '2', title: 'Hey Jude', artist: 'The Beatles', year: 1968, spotifyUri: 'spotify:track:2', spotifyUrl: 'https://open.spotify.com/track/2' },
    { id: '3', title: 'Thriller', artist: 'Michael Jackson', year: 1982, spotifyUri: 'spotify:track:3', spotifyUrl: 'https://open.spotify.com/track/3' },
    { id: '4', title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, spotifyUri: 'spotify:track:4', spotifyUrl: 'https://open.spotify.com/track/4' },
    { id: '5', title: 'Like a Rolling Stone', artist: 'Bob Dylan', year: 1965, spotifyUri: 'spotify:track:5', spotifyUrl: 'https://open.spotify.com/track/5' },
    { id: '6', title: 'Imagine', artist: 'John Lennon', year: 1971, spotifyUri: 'spotify:track:6', spotifyUrl: 'https://open.spotify.com/track/6' },
    { id: '7', title: 'Stairway to Heaven', artist: 'Led Zeppelin', year: 1971, spotifyUri: 'spotify:track:7', spotifyUrl: 'https://open.spotify.com/track/7' },
  ];

  it('returns 4 artist options including the correct one', () => {
    const result = generateQuizOptions(correctSong, songPool);
    expect(result.artists).toHaveLength(4);
    expect(result.artists).toContain('Queen');
  });

  it('returns 4 song title options including the correct one', () => {
    const result = generateQuizOptions(correctSong, songPool);
    expect(result.songTitles).toHaveLength(4);
    expect(result.songTitles).toContain('Bohemian Rhapsody');
  });

  it('includes correct artist and title indices', () => {
    const result = generateQuizOptions(correctSong, songPool);
    expect(result.artists[result.correctArtistIndex]).toBe('Queen');
    expect(result.songTitles[result.correctTitleIndex]).toBe('Bohemian Rhapsody');
  });

  it('does not duplicate artists or titles', () => {
    const result = generateQuizOptions(correctSong, songPool);
    const uniqueArtists = new Set(result.artists);
    const uniqueTitles = new Set(result.songTitles);
    expect(uniqueArtists.size).toBe(4);
    expect(uniqueTitles.size).toBe(4);
  });

  it('handles small song pool gracefully', () => {
    const smallPool = songPool.slice(0, 3);
    const result = generateQuizOptions(correctSong, smallPool);
    expect(result.artists.length).toBeGreaterThanOrEqual(1);
    expect(result.songTitles.length).toBeGreaterThanOrEqual(1);
  });
});
