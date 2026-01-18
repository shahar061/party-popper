// packages/backend/src/__tests__/win-condition.test.ts
import { describe, it, expect } from 'vitest';
import { WinConditionChecker } from '../win-condition';
import type { Team, TimelineSong } from '@party-popper/shared';

describe('WinConditionChecker', () => {
  const checker = new WinConditionChecker();

  const createTimelineSong = (): TimelineSong => ({
    id: '1',
    title: 'Test',
    artist: 'Test',
    year: 2000,
    spotifyUri: '',
    spotifyUrl: '',
    pointsEarned: 1,
    addedAt: Date.now()
  });

  const createTeam = (timelineLength: number): Team => ({
    name: 'Test Team',
    players: [],
    timeline: Array(timelineLength).fill(null).map(() => createTimelineSong()),
    tokens: 0,
    score: timelineLength
  });

  describe('checkWinner', () => {
    it('should return Team A as winner when A reaches target', () => {
      const teams = {
        A: createTeam(10),
        B: createTeam(5)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(true);
      expect(result.winner).toBe('A');
    });

    it('should return Team B as winner when B reaches target', () => {
      const teams = {
        A: createTeam(7),
        B: createTeam(10)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(true);
      expect(result.winner).toBe('B');
    });

    it('should return no winner when neither team reaches target', () => {
      const teams = {
        A: createTeam(5),
        B: createTeam(7)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(false);
      expect(result.winner).toBeNull();
    });

    it('should handle tie at target (both win simultaneously)', () => {
      const teams = {
        A: createTeam(10),
        B: createTeam(10)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(false);
      expect(result.isTie).toBe(true);
    });

    it('should return winner if one team exceeds target', () => {
      const teams = {
        A: createTeam(12),
        B: createTeam(5)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(true);
      expect(result.winner).toBe('A');
    });
  });

  describe('getTeamScore', () => {
    it('should return timeline length as score', () => {
      const team = createTeam(7);
      expect(checker.getTeamScore(team)).toBe(7);
    });

    it('should return 0 for empty timeline', () => {
      const team = createTeam(0);
      expect(checker.getTeamScore(team)).toBe(0);
    });
  });
});
