// packages/backend/src/scoring-system.ts
import type { ValidationResult } from './answer-validator';

export class ScoringSystem {
  calculatePoints(validation: ValidationResult): number {
    return validation.totalScore;
  }

  shouldAddToTimeline(points: number): boolean {
    return points > 0;
  }
}
