// packages/backend/src/__tests__/scoring-system.test.ts
import { describe, it, expect } from 'vitest';
import { ScoringSystem } from '../scoring-system';
import type { ValidationResult } from '../answer-validator';

describe('ScoringSystem', () => {
  const scoring = new ScoringSystem();

  describe('calculatePoints', () => {
    it('should award 1 point for correct artist', () => {
      const result: ValidationResult = {
        artistCorrect: true,
        titleCorrect: false,
        yearScore: 0,
        totalScore: 1
      };
      expect(scoring.calculatePoints(result)).toBe(1);
    });

    it('should award 1 point for correct title', () => {
      const result: ValidationResult = {
        artistCorrect: false,
        titleCorrect: true,
        yearScore: 0,
        totalScore: 1
      };
      expect(scoring.calculatePoints(result)).toBe(1);
    });

    it('should award 1 point for exact year', () => {
      const result: ValidationResult = {
        artistCorrect: false,
        titleCorrect: false,
        yearScore: 1,
        totalScore: 1
      };
      expect(scoring.calculatePoints(result)).toBe(1);
    });

    it('should award 0.5 points for close year', () => {
      const result: ValidationResult = {
        artistCorrect: false,
        titleCorrect: false,
        yearScore: 0.5,
        totalScore: 0.5
      };
      expect(scoring.calculatePoints(result)).toBe(0.5);
    });

    it('should sum all points for perfect answer', () => {
      const result: ValidationResult = {
        artistCorrect: true,
        titleCorrect: true,
        yearScore: 1,
        totalScore: 3
      };
      expect(scoring.calculatePoints(result)).toBe(3);
    });
  });

  describe('shouldAddToTimeline', () => {
    it('should add song if any points scored', () => {
      expect(scoring.shouldAddToTimeline(0.5)).toBe(true);
      expect(scoring.shouldAddToTimeline(1)).toBe(true);
      expect(scoring.shouldAddToTimeline(3)).toBe(true);
    });

    it('should not add song if zero points', () => {
      expect(scoring.shouldAddToTimeline(0)).toBe(false);
    });
  });
});
