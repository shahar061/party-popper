import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSession,
  getSession,
  clearSession,
  isSessionValid,
  SESSION_TIMEOUT_MS
} from '../utils/sessionStorage';

describe('sessionStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('saveSession', () => {
    it('saves session data to localStorage', () => {
      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      const stored = localStorage.getItem('party-popper-session');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.sessionId).toBe('abc123');
      expect(parsed.gameCode).toBe('WXYZ');
      expect(parsed.playerName).toBe('Alice');
    });

    it('includes timestamp when saving', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      const parsed = JSON.parse(localStorage.getItem('party-popper-session')!);
      expect(parsed.timestamp).toBe(now);
    });
  });

  describe('getSession', () => {
    it('returns null when no session exists', () => {
      expect(getSession()).toBeNull();
    });

    it('returns session data when valid session exists', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      const session = getSession();
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe('abc123');
    });

    it('returns null for expired session (older than 5 minutes)', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      // Advance time past timeout
      vi.setSystemTime(now + SESSION_TIMEOUT_MS + 1000);

      expect(getSession()).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes session from localStorage', () => {
      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      clearSession();

      expect(localStorage.getItem('party-popper-session')).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('returns true for fresh session', () => {
      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      expect(isSessionValid()).toBe(true);
    });

    it('returns false for expired session', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      vi.setSystemTime(now + SESSION_TIMEOUT_MS + 1000);

      expect(isSessionValid()).toBe(false);
    });

    it('returns false when no session exists', () => {
      expect(isSessionValid()).toBe(false);
    });
  });
});
