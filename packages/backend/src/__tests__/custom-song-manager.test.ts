// packages/backend/src/__tests__/custom-song-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CustomSongManager } from '../custom-song-manager';

describe('CustomSongManager', () => {
  let manager: CustomSongManager;

  beforeEach(() => {
    manager = new CustomSongManager();
  });

  describe('addSong', () => {
    it('should add valid song to pool', () => {
      const song = manager.addSong({
        title: 'Custom Song',
        artist: 'Custom Artist',
        year: 2020,
        spotifyId: '4uLU6hMCjMI75M1A2tKUQC'
      });

      expect(song.id).toBeDefined();
      expect(song.title).toBe('Custom Song');
      expect(song.spotifyUri).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
    });

    it('should validate Spotify ID format', () => {
      expect(() => manager.addSong({
        title: 'Song',
        artist: 'Artist',
        year: 2020,
        spotifyId: 'invalid-id!'
      })).toThrow('Invalid Spotify ID format');
    });

    it('should accept Spotify URL and extract ID', () => {
      const song = manager.addSong({
        title: 'Song',
        artist: 'Artist',
        year: 2020,
        spotifyId: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123'
      });

      expect(song.spotifyUri).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
    });

    it('should require year between 1900 and current year + 1', () => {
      expect(() => manager.addSong({
        title: 'Song',
        artist: 'Artist',
        year: 1800,
        spotifyId: '4uLU6hMCjMI75M1A2tKUQC'
      })).toThrow('Invalid year');
    });
  });

  describe('getSongPool', () => {
    it('should return all added songs', () => {
      manager.addSong({ title: 'Song 1', artist: 'Artist', year: 2020, spotifyId: 'abc123def456ghi' });
      manager.addSong({ title: 'Song 2', artist: 'Artist', year: 2021, spotifyId: 'xyz789abc123def' });

      const pool = manager.getSongPool();
      expect(pool).toHaveLength(2);
    });
  });

  describe('removeSong', () => {
    it('should remove song by id', () => {
      const song = manager.addSong({ title: 'Song', artist: 'Artist', year: 2020, spotifyId: 'abc123def456ghi' });
      manager.removeSong(song.id);

      expect(manager.getSongPool()).toHaveLength(0);
    });
  });

  describe('hasMinimumSongs', () => {
    it('should return false when below minimum', () => {
      manager.addSong({ title: 'Song', artist: 'Artist', year: 2020, spotifyId: 'abc123def456ghi' });
      expect(manager.hasMinimumSongs(10)).toBe(false);
    });

    it('should return true when at or above minimum', () => {
      for (let i = 0; i < 10; i++) {
        manager.addSong({ title: `Song ${i}`, artist: 'Artist', year: 2020, spotifyId: `abc123def456gh${i}` });
      }
      expect(manager.hasMinimumSongs(10)).toBe(true);
    });
  });
});
