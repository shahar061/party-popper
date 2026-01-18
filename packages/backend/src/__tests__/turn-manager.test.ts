// packages/backend/src/__tests__/turn-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TurnManager } from '../turn-manager';

describe('TurnManager', () => {
  let turnManager: TurnManager;

  beforeEach(() => {
    turnManager = new TurnManager();
  });

  describe('getActiveTeam', () => {
    it('should start with Team A', () => {
      expect(turnManager.getActiveTeam()).toBe('A');
    });
  });

  describe('nextTurn', () => {
    it('should alternate from A to B', () => {
      expect(turnManager.getActiveTeam()).toBe('A');
      turnManager.nextTurn();
      expect(turnManager.getActiveTeam()).toBe('B');
    });

    it('should alternate from B to A', () => {
      turnManager.nextTurn(); // A -> B
      turnManager.nextTurn(); // B -> A
      expect(turnManager.getActiveTeam()).toBe('A');
    });

    it('should continue alternating', () => {
      const sequence: string[] = [];
      for (let i = 0; i < 6; i++) {
        sequence.push(turnManager.getActiveTeam());
        turnManager.nextTurn();
      }
      expect(sequence).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
    });
  });

  describe('setActiveTeam', () => {
    it('should allow setting active team directly', () => {
      turnManager.setActiveTeam('B');
      expect(turnManager.getActiveTeam()).toBe('B');
    });
  });

  describe('isTeamsTurn', () => {
    it('should return true for active team', () => {
      expect(turnManager.isTeamsTurn('A')).toBe(true);
      expect(turnManager.isTeamsTurn('B')).toBe(false);
    });

    it('should update after turn change', () => {
      turnManager.nextTurn();
      expect(turnManager.isTeamsTurn('A')).toBe(false);
      expect(turnManager.isTeamsTurn('B')).toBe(true);
    });
  });
});
