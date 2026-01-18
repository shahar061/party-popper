import { describe, it, expect } from 'vitest';
import { validatePlacement, getCorrectPosition } from '../placement-validator';
import type { TimelineSong } from '@party-popper/shared';

describe('validatePlacement', () => {
  const makeTimelineSong = (year: number): TimelineSong => ({
    id: `song-${year}`,
    title: `Song ${year}`,
    artist: 'Artist',
    year,
    spotifyUri: `spotify:track:${year}`,
    spotifyUrl: `https://open.spotify.com/track/${year}`,
    addedAt: Date.now(),
    pointsEarned: 1,
  });

  it('returns true for correct placement in empty timeline', () => {
    const timeline: TimelineSong[] = [];
    const songYear = 1980;
    const position = 0;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns true for correct placement at beginning', () => {
    const timeline = [makeTimelineSong(1980), makeTimelineSong(1990)];
    const songYear = 1970;
    const position = 0;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns true for correct placement in middle', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1990)];
    const songYear = 1980;
    const position = 1;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns true for correct placement at end', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1980)];
    const songYear = 1990;
    const position = 2;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns false for incorrect placement', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1990)];
    const songYear = 1980;
    const position = 0; // Should be 1
    expect(validatePlacement(timeline, songYear, position)).toBe(false);
  });

  it('returns false for placement at wrong end', () => {
    const timeline = [makeTimelineSong(1980)];
    const songYear = 1970;
    const position = 1; // Should be 0
    expect(validatePlacement(timeline, songYear, position)).toBe(false);
  });
});

describe('getCorrectPosition', () => {
  const makeTimelineSong = (year: number): TimelineSong => ({
    id: `song-${year}`,
    title: `Song ${year}`,
    artist: 'Artist',
    year,
    spotifyUri: `spotify:track:${year}`,
    spotifyUrl: `https://open.spotify.com/track/${year}`,
    addedAt: Date.now(),
    pointsEarned: 1,
  });

  it('returns 0 for empty timeline', () => {
    expect(getCorrectPosition([], 1980)).toBe(0);
  });

  it('returns 0 for song before all others', () => {
    const timeline = [makeTimelineSong(1980), makeTimelineSong(1990)];
    expect(getCorrectPosition(timeline, 1970)).toBe(0);
  });

  it('returns middle position for song between others', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1990)];
    expect(getCorrectPosition(timeline, 1980)).toBe(1);
  });

  it('returns end position for song after all others', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1980)];
    expect(getCorrectPosition(timeline, 1990)).toBe(2);
  });
});
