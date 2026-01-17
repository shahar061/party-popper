// packages/backend/src/__tests__/answer-validator.test.ts
import { describe, it, expect } from 'vitest';
import { AnswerValidator } from '../answer-validator';
import type { Song } from '@party-popper/shared';

describe('AnswerValidator', () => {
  const validator = new AnswerValidator();
  const song: Song = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  describe('validateArtist', () => {
    it('should match exact artist name', () => {
      expect(validator.validateArtist('Queen', song)).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(validator.validateArtist('queen', song)).toBe(true);
      expect(validator.validateArtist('QUEEN', song)).toBe(true);
    });

    it('should ignore leading "The"', () => {
      const beatlesSong: Song = { ...song, artist: 'The Beatles' };
      expect(validator.validateArtist('Beatles', beatlesSong)).toBe(true);
      expect(validator.validateArtist('the beatles', beatlesSong)).toBe(true);
    });

    it('should reject incorrect artist', () => {
      expect(validator.validateArtist('Prince', song)).toBe(false);
    });

    it('should trim whitespace', () => {
      expect(validator.validateArtist('  Queen  ', song)).toBe(true);
    });
  });

  describe('validateTitle', () => {
    it('should match exact title', () => {
      expect(validator.validateTitle('Bohemian Rhapsody', song)).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(validator.validateTitle('bohemian rhapsody', song)).toBe(true);
    });

    it('should reject incorrect title', () => {
      expect(validator.validateTitle('We Will Rock You', song)).toBe(false);
    });
  });

  describe('validateYear', () => {
    it('should return 1 for exact year match', () => {
      expect(validator.validateYear(1975, song)).toBe(1);
    });

    it('should return 0.5 for +/- 1 year', () => {
      expect(validator.validateYear(1974, song)).toBe(0.5);
      expect(validator.validateYear(1976, song)).toBe(0.5);
    });

    it('should return 0 for more than 1 year off', () => {
      expect(validator.validateYear(1973, song)).toBe(0);
      expect(validator.validateYear(1980, song)).toBe(0);
    });
  });

  describe('validateAnswer', () => {
    it('should return full validation result', () => {
      const result = validator.validateAnswer(
        { artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 },
        song
      );

      expect(result.artistCorrect).toBe(true);
      expect(result.titleCorrect).toBe(true);
      expect(result.yearScore).toBe(1);
      expect(result.totalScore).toBe(3);
    });

    it('should calculate partial scores', () => {
      const result = validator.validateAnswer(
        { artist: 'Wrong', title: 'Bohemian Rhapsody', year: 1976 },
        song
      );

      expect(result.artistCorrect).toBe(false);
      expect(result.titleCorrect).toBe(true);
      expect(result.yearScore).toBe(0.5);
      expect(result.totalScore).toBe(1.5);
    });

    it('should return zero for all wrong answers', () => {
      const result = validator.validateAnswer(
        { artist: 'Wrong Artist', title: 'Wrong Title', year: 2000 },
        song
      );

      expect(result.artistCorrect).toBe(false);
      expect(result.titleCorrect).toBe(false);
      expect(result.yearScore).toBe(0);
      expect(result.totalScore).toBe(0);
    });
  });
});
