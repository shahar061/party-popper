// packages/backend/src/__tests__/round-state-machine.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoundStateMachine } from '../round-state-machine';
import type { Song } from '@party-popper/shared';

describe('RoundStateMachine', () => {
  let machine: RoundStateMachine;
  const mockSong: Song = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  beforeEach(() => {
    machine = new RoundStateMachine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startRound', () => {
    it('should initialize round in guessing phase', () => {
      const round = machine.startRound(mockSong, 'A', 1, 60000);

      expect(round.phase).toBe('guessing');
      expect(round.song).toEqual(mockSong);
      expect(round.activeTeam).toBe('A');
      expect(round.number).toBe(1);
      expect(round.currentAnswer).toBeNull();
      expect(round.vetoChallenge).toBeNull();
    });

    it('should set timer with startedAt and endsAt', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const round = machine.startRound(mockSong, 'A', 1, 45000);

      expect(round.startedAt).toBe(now);
      expect(round.endsAt).toBe(now + 45000);
    });
  });

  describe('phase transitions', () => {
    it('should transition from guessing to reveal on submission', () => {
      machine.startRound(mockSong, 'A', 1, 60000);

      const round = machine.submitAnswer({
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      expect(round.phase).toBe('reveal');
    });

    it('should store the submitted answer', () => {
      machine.startRound(mockSong, 'A', 1, 60000);

      const answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };

      const round = machine.submitAnswer(answer);

      expect(round.currentAnswer).toEqual(answer);
    });

    it('should transition from guessing to reveal on timeout', () => {
      machine.startRound(mockSong, 'A', 1, 60000);

      const round = machine.timeout();

      expect(round.phase).toBe('reveal');
      expect(round.currentAnswer).toBeNull();
    });

    it('should throw error if submitting answer in wrong phase', () => {
      machine.startRound(mockSong, 'A', 1, 60000);
      machine.timeout(); // Move to reveal

      expect(() => machine.submitAnswer({
        artist: 'Queen',
        title: 'Test',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      })).toThrow('Cannot submit answer in reveal phase');
    });

    it('should throw error if no round in progress', () => {
      expect(() => machine.submitAnswer({
        artist: 'Queen',
        title: 'Test',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      })).toThrow('No round in progress');
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time in guessing phase', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      machine.startRound(mockSong, 'A', 1, 60000);

      vi.setSystemTime(now + 30000);
      expect(machine.getRemainingTime()).toBe(30000);
    });

    it('should return 0 if time expired', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      machine.startRound(mockSong, 'A', 1, 60000);

      vi.setSystemTime(now + 70000);
      expect(machine.getRemainingTime()).toBe(0);
    });

    it('should return 0 if no round in progress', () => {
      expect(machine.getRemainingTime()).toBe(0);
    });
  });

  describe('getCurrentRound', () => {
    it('should return current round', () => {
      const round = machine.startRound(mockSong, 'A', 1, 60000);
      expect(machine.getCurrentRound()).toEqual(round);
    });

    it('should return null if no round', () => {
      expect(machine.getCurrentRound()).toBeNull();
    });
  });

  describe('endRound', () => {
    it('should clear current round', () => {
      machine.startRound(mockSong, 'A', 1, 60000);
      machine.endRound();
      expect(machine.getCurrentRound()).toBeNull();
    });
  });
});
