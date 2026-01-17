// packages/backend/src/__tests__/round-state-machine-veto.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoundStateMachine } from '../round-state-machine';

describe('RoundStateMachine - Veto Phase', () => {
  let machine: RoundStateMachine;
  const mockSong = {
    id: 'song-1',
    title: 'Test Song',
    artist: 'Test Artist',
    year: 1985,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  beforeEach(() => {
    machine = new RoundStateMachine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('veto window transition', () => {
    it('should transition from guessing to veto_window on submission', () => {
      machine.startRound(mockSong, 'A', 1, 60000);

      const round = machine.submitAnswer({
        artist: 'Test Artist',
        title: 'Test Song',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      expect(round.phase).toBe('veto_window');
    });

    it('should set veto window duration to 15 seconds', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      machine.startRound(mockSong, 'A', 1, 60000);
      machine.submitAnswer({
        artist: 'Test',
        title: 'Test',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: now
      });

      expect(machine.getVetoWindowRemaining()).toBeLessThanOrEqual(15000);
      expect(machine.getVetoWindowRemaining()).toBeGreaterThan(0);
    });

    it('should transition from veto_window to reveal when window expires', () => {
      vi.useFakeTimers();
      machine.startRound(mockSong, 'A', 1, 60000);
      machine.submitAnswer({
        artist: 'Test',
        title: 'Test',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      vi.advanceTimersByTime(15000);
      const round = machine.expireVetoWindow();

      expect(round.phase).toBe('reveal');
    });

    it('should allow veto during veto_window phase', () => {
      machine.startRound(mockSong, 'A', 1, 60000);
      machine.submitAnswer({
        artist: 'Test',
        title: 'Test',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      const round = machine.initiateVeto('B', 'year');

      expect(round.vetoChallenge).toEqual({
        challengingTeam: 'B',
        challengedField: 'year'
      });
    });

    it('should throw error if veto attempted in wrong phase', () => {
      machine.startRound(mockSong, 'A', 1, 60000);

      expect(() => machine.initiateVeto('B', 'year'))
        .toThrow('Cannot veto in guessing phase');
    });

    it('should return 0 for veto window remaining when not in veto_window phase', () => {
      machine.startRound(mockSong, 'A', 1, 60000);
      expect(machine.getVetoWindowRemaining()).toBe(0);
    });
  });
});
