// packages/backend/src/__tests__/timeline-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TimelineManager } from '../timeline-manager';
import type { Song, TimelineSong } from '@party-popper/shared';

describe('TimelineManager', () => {
  let manager: TimelineManager;

  const createSong = (year: number, title: string): Song => ({
    id: `song-${year}-${title}`,
    title,
    artist: 'Test Artist',
    year,
    spotifyUri: `spotify:track:${year}`,
    spotifyUrl: `https://open.spotify.com/track/${year}`
  });

  beforeEach(() => {
    manager = new TimelineManager();
  });

  describe('addSong', () => {
    it('should add first song to empty timeline', () => {
      const song = createSong(1985, 'Song A');
      const timeline = manager.addSong([], song, 2);

      expect(timeline).toHaveLength(1);
      expect(timeline[0].title).toBe('Song A');
      expect(timeline[0].year).toBe(1985);
      expect(timeline[0].pointsEarned).toBe(2);
    });

    it('should insert songs in chronological order', () => {
      const song1990 = createSong(1990, 'Song 1990');
      const song1980 = createSong(1980, 'Song 1980');
      const song1985 = createSong(1985, 'Song 1985');

      let timeline = manager.addSong([], song1990, 1);
      timeline = manager.addSong(timeline, song1980, 2);
      timeline = manager.addSong(timeline, song1985, 3);

      expect(timeline[0].year).toBe(1980);
      expect(timeline[1].year).toBe(1985);
      expect(timeline[2].year).toBe(1990);
    });

    it('should handle songs with same year', () => {
      const songA = createSong(1985, 'Song A');
      const songB = createSong(1985, 'Song B');

      let timeline = manager.addSong([], songA, 1);
      timeline = manager.addSong(timeline, songB, 2);

      expect(timeline).toHaveLength(2);
      expect(timeline[0].year).toBe(1985);
      expect(timeline[1].year).toBe(1985);
    });

    it('should set addedAt timestamp', () => {
      const song = createSong(1985, 'Song A');
      const before = Date.now();
      const timeline = manager.addSong([], song, 2);
      const after = Date.now();

      expect(timeline[0].addedAt).toBeGreaterThanOrEqual(before);
      expect(timeline[0].addedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('isDuplicate', () => {
    it('should detect duplicate song by id', () => {
      const song = createSong(1985, 'Song A');
      const timelineSong: TimelineSong = {
        ...song,
        pointsEarned: 2,
        addedAt: Date.now()
      };
      const timeline: TimelineSong[] = [timelineSong];

      expect(manager.isDuplicate(timeline, song)).toBe(true);
    });

    it('should return false for new song', () => {
      const song1 = createSong(1985, 'Song A');
      const song2 = createSong(1990, 'Song B');
      const timelineSong: TimelineSong = {
        ...song1,
        pointsEarned: 2,
        addedAt: Date.now()
      };
      const timeline: TimelineSong[] = [timelineSong];

      expect(manager.isDuplicate(timeline, song2)).toBe(false);
    });

    it('should return false for empty timeline', () => {
      const song = createSong(1985, 'Song A');
      expect(manager.isDuplicate([], song)).toBe(false);
    });
  });

  describe('getTimelineScore', () => {
    it('should return number of songs in timeline', () => {
      const song1 = createSong(1985, 'Song A');
      const song2 = createSong(1990, 'Song B');

      let timeline = manager.addSong([], song1, 2);
      timeline = manager.addSong(timeline, song2, 1);

      expect(manager.getTimelineScore(timeline)).toBe(2);
    });

    it('should return 0 for empty timeline', () => {
      expect(manager.getTimelineScore([])).toBe(0);
    });
  });
});
