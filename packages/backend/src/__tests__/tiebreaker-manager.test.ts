// packages/backend/src/__tests__/tiebreaker-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TiebreakerManager } from '../tiebreaker-manager';
import type { Team, Song } from '@party-popper/shared';

describe('TiebreakerManager', () => {
  let manager: TiebreakerManager;

  const createTeam = (score: number): Team => ({
    name: 'Test Team',
    players: [{ id: 'p1', name: 'Player', connected: true, lastSeen: Date.now() }],
    timeline: Array(score).fill({
      song: { id: '1', title: 'Test', artist: 'Test', year: 2000, spotifyUri: '', spotifyUrl: '' },
      pointsEarned: 1,
      addedAt: Date.now()
    }),
    vetoTokens: 3,
    score
  });

  const mockSong: Song = {
    id: 'tiebreaker-song',
    title: 'Tiebreaker Song',
    artist: 'Test Artist',
    year: 1990,
    spotifyUri: 'spotify:track:tie',
    spotifyUrl: 'https://open.spotify.com/track/tie'
  };

  beforeEach(() => {
    manager = new TiebreakerManager();
  });

  describe('shouldTriggerTiebreaker', () => {
    it('should trigger when both teams at target-1 and scores equal', () => {
      const teams = { A: createTeam(9), B: createTeam(9) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(true);
    });

    it('should not trigger when scores are not equal', () => {
      const teams = { A: createTeam(9), B: createTeam(8) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(false);
    });

    it('should not trigger when neither team near target', () => {
      const teams = { A: createTeam(5), B: createTeam(5) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(false);
    });

    it('should trigger when both at target (simultaneous win scenario)', () => {
      const teams = { A: createTeam(10), B: createTeam(10) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(true);
    });
  });

  describe('startTiebreaker', () => {
    it('should create tiebreaker round with same song for both teams', () => {
      const tiebreaker = manager.startTiebreaker(mockSong);

      expect(tiebreaker.song).toEqual(mockSong);
      expect(tiebreaker.isActive).toBe(true);
      expect(tiebreaker.teamASubmitted).toBe(false);
      expect(tiebreaker.teamBSubmitted).toBe(false);
    });
  });

  describe('submitTiebreakerAnswer', () => {
    it('should record answer and timestamp for team', () => {
      manager.startTiebreaker(mockSong);

      const result = manager.submitTiebreakerAnswer('A', {
        artist: 'Test Artist',
        title: 'Tiebreaker Song',
        year: 1990
      });

      expect(result.teamASubmitted).toBe(true);
      expect(result.teamAAnswer).toBeDefined();
    });

    it('should determine winner when both teams submit', () => {
      manager.startTiebreaker(mockSong);

      manager.submitTiebreakerAnswer('A', {
        artist: 'Test Artist',
        title: 'Tiebreaker Song',
        year: 1990
      });

      const result = manager.submitTiebreakerAnswer('B', {
        artist: 'Wrong',
        title: 'Wrong',
        year: 2000
      });

      expect(result.isComplete).toBe(true);
      expect(result.winner).toBe('A');
    });

    it('should award win to first correct answer', () => {
      manager.startTiebreaker(mockSong);

      // Team B submits first but wrong
      manager.submitTiebreakerAnswer('B', {
        artist: 'Wrong',
        title: 'Wrong',
        year: 2000
      });

      // Team A submits later but correct
      const result = manager.submitTiebreakerAnswer('A', {
        artist: 'Test Artist',
        title: 'Tiebreaker Song',
        year: 1990
      });

      expect(result.winner).toBe('A');
    });
  });
});
