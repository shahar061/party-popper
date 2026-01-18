// packages/backend/src/answer-validator.ts
import type { Song } from '@party-popper/shared';

export interface AnswerInput {
  artist: string;
  title: string;
  year: number;
}

export interface ValidationResult {
  artistCorrect: boolean;
  titleCorrect: boolean;
  yearScore: number; // 0, 0.5, or 1
  totalScore: number;
}

export class AnswerValidator {
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/^the\s+/i, '');
  }

  validateArtist(submittedArtist: string, song: Song): boolean {
    return this.normalize(submittedArtist) === this.normalize(song.artist);
  }

  validateTitle(submittedTitle: string, song: Song): boolean {
    return this.normalize(submittedTitle) === this.normalize(song.title);
  }

  validateYear(submittedYear: number, song: Song): number {
    const diff = Math.abs(submittedYear - song.year);
    if (diff === 0) return 1;
    if (diff === 1) return 0.5;
    return 0;
  }

  validateAnswer(answer: AnswerInput, song: Song): ValidationResult {
    const artistCorrect = this.validateArtist(answer.artist, song);
    const titleCorrect = this.validateTitle(answer.title, song);
    const yearScore = this.validateYear(answer.year, song);

    const totalScore =
      (artistCorrect ? 1 : 0) +
      (titleCorrect ? 1 : 0) +
      yearScore;

    return {
      artistCorrect,
      titleCorrect,
      yearScore,
      totalScore
    };
  }
}
