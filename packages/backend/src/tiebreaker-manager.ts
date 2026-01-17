// packages/backend/src/tiebreaker-manager.ts
import type { Song, Team } from '@party-popper/shared';

interface TiebreakerAnswer {
  artist: string;
  title: string;
  year: number;
  submittedAt: number;
}

export interface TiebreakerState {
  song: Song;
  isActive: boolean;
  teamASubmitted: boolean;
  teamBSubmitted: boolean;
  teamAAnswer?: TiebreakerAnswer;
  teamBAnswer?: TiebreakerAnswer;
  isComplete: boolean;
  winner: 'A' | 'B' | null;
}

export class TiebreakerManager {
  private state: TiebreakerState | null = null;

  shouldTriggerTiebreaker(
    teams: { A: Team; B: Team },
    targetScore: number
  ): boolean {
    const scoreA = teams.A.timeline.length;
    const scoreB = teams.B.timeline.length;

    if (scoreA !== scoreB) return false;
    if (scoreA < targetScore - 1) return false;

    return true;
  }

  startTiebreaker(song: Song): TiebreakerState {
    this.state = {
      song,
      isActive: true,
      teamASubmitted: false,
      teamBSubmitted: false,
      isComplete: false,
      winner: null
    };
    return this.state;
  }

  submitTiebreakerAnswer(
    team: 'A' | 'B',
    answer: { artist: string; title: string; year: number }
  ): TiebreakerState {
    if (!this.state || !this.state.isActive) {
      throw new Error('No active tiebreaker');
    }

    const tiebreakerAnswer: TiebreakerAnswer = {
      ...answer,
      submittedAt: Date.now()
    };

    if (team === 'A') {
      this.state.teamASubmitted = true;
      this.state.teamAAnswer = tiebreakerAnswer;
    } else {
      this.state.teamBSubmitted = true;
      this.state.teamBAnswer = tiebreakerAnswer;
    }

    if (this.state.teamASubmitted && this.state.teamBSubmitted) {
      this.state.isComplete = true;
      this.state.winner = this.determineWinner();
    }

    return { ...this.state };
  }

  private determineWinner(): 'A' | 'B' | null {
    if (!this.state || !this.state.teamAAnswer || !this.state.teamBAnswer) {
      return null;
    }

    const aCorrect = this.isAnswerCorrect(this.state.teamAAnswer);
    const bCorrect = this.isAnswerCorrect(this.state.teamBAnswer);

    if (aCorrect && !bCorrect) return 'A';
    if (bCorrect && !aCorrect) return 'B';

    if (aCorrect && bCorrect) {
      return this.state.teamAAnswer.submittedAt <= this.state.teamBAnswer.submittedAt
        ? 'A'
        : 'B';
    }

    return null;
  }

  private isAnswerCorrect(answer: TiebreakerAnswer): boolean {
    if (!this.state) return false;

    const song = this.state.song;
    const normalize = (s: string) => s.toLowerCase().trim().replace(/^the\s+/i, '');

    const artistMatch = normalize(answer.artist) === normalize(song.artist);
    const titleMatch = normalize(answer.title) === normalize(song.title);
    const yearMatch = Math.abs(answer.year - song.year) <= 1;

    return artistMatch && titleMatch && yearMatch;
  }

  getState(): TiebreakerState | null {
    return this.state ? { ...this.state } : null;
  }

  reset(): void {
    this.state = null;
  }
}
