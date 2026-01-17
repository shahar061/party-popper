// packages/backend/src/veto-resolver.ts
import type { Song, Answer, VetoChallenge } from '@party-popper/shared';

export interface VetoResolution {
  vetoSuccessful: boolean;
  stealOpportunity: boolean;
  penaltyTeam: 'A' | 'B' | null;
  reason: string;
}

export class VetoResolver {
  private normalize(text: string): string {
    return text.toLowerCase().trim().replace(/^the\s+/i, '');
  }

  private isFieldCorrect(
    answer: Answer,
    song: Song,
    field: 'artist' | 'title' | 'year'
  ): boolean {
    switch (field) {
      case 'artist':
        return this.normalize(answer.artist) === this.normalize(song.artist);
      case 'title':
        return this.normalize(answer.title) === this.normalize(song.title);
      case 'year':
        return Math.abs(answer.year - song.year) <= 1;
      default:
        return false;
    }
  }

  resolveVeto(
    answer: Answer,
    song: Song,
    veto: VetoChallenge
  ): VetoResolution {
    const fieldWasCorrect = this.isFieldCorrect(answer, song, veto.challengedField);

    if (fieldWasCorrect) {
      return {
        vetoSuccessful: false,
        stealOpportunity: false,
        penaltyTeam: null,
        reason: `The ${veto.challengedField} was correct. Veto failed.`
      };
    }

    return {
      vetoSuccessful: true,
      stealOpportunity: true,
      penaltyTeam: null,
      reason: `The ${veto.challengedField} was incorrect. ${veto.challengingTeam === 'A' ? 'Team A' : 'Team B'} gets a steal opportunity!`
    };
  }
}
