// packages/backend/src/__tests__/veto-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { VetoResolver } from '../veto-resolver';
import type { Song, Answer, VetoChallenge } from '@party-popper/shared';

describe('VetoResolver', () => {
  const resolver = new VetoResolver();

  const song: Song = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  describe('resolveVeto', () => {
    it('should grant steal opportunity when veto is correct (answer was wrong)', () => {
      const answer: Answer = {
        artist: 'Wrong Artist',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'artist'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(true);
      expect(result.stealOpportunity).toBe(true);
      expect(result.penaltyTeam).toBeNull();
    });

    it('should penalize vetoing team when veto is incorrect (answer was correct)', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'artist'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(false);
      expect(result.stealOpportunity).toBe(false);
      expect(result.penaltyTeam).toBeNull(); // Only token loss, no additional penalty
    });

    it('should handle year veto with exact match', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'year'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(false);
    });

    it('should handle year veto when off by more than 1', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1980,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'year'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(true);
      expect(result.stealOpportunity).toBe(true);
    });

    it('should treat close year (+/- 1) as correct for veto purposes', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1976,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'year'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(false);
    });
  });
});
