// packages/backend/src/__tests__/veto-token-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { VetoTokenManager } from '../veto-token-manager';

describe('VetoTokenManager', () => {
  let manager: VetoTokenManager;

  beforeEach(() => {
    manager = new VetoTokenManager();
  });

  describe('initialization', () => {
    it('should start teams with 3 veto tokens each', () => {
      const tokens = manager.getTokens();
      expect(tokens.A).toBe(3);
      expect(tokens.B).toBe(3);
    });
  });

  describe('useToken', () => {
    it('should decrement token count when used', () => {
      manager.useToken('A');
      expect(manager.getTokens().A).toBe(2);
      expect(manager.getTokens().B).toBe(3);
    });

    it('should throw error when team has no tokens', () => {
      manager.useToken('A');
      manager.useToken('A');
      manager.useToken('A');
      expect(() => manager.useToken('A')).toThrow('Team A has no veto tokens');
    });
  });

  describe('canUseToken', () => {
    it('should return true when team has tokens', () => {
      expect(manager.canUseToken('A')).toBe(true);
    });

    it('should return false when team has no tokens', () => {
      manager.useToken('B');
      manager.useToken('B');
      manager.useToken('B');
      expect(manager.canUseToken('B')).toBe(false);
    });
  });

  describe('getTeamTokenCount', () => {
    it('should return specific team token count', () => {
      manager.useToken('A');
      expect(manager.getTeamTokenCount('A')).toBe(2);
      expect(manager.getTeamTokenCount('B')).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset all tokens to 3', () => {
      manager.useToken('A');
      manager.useToken('B');
      manager.useToken('B');
      manager.reset();
      expect(manager.getTokens()).toEqual({ A: 3, B: 3 });
    });
  });
});
