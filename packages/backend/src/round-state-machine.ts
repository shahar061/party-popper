// packages/backend/src/round-state-machine.ts
import type { Song, Round, Answer, RoundPhase } from '@party-popper/shared';

export class RoundStateMachine {
  private round: Round | null = null;

  startRound(song: Song, activeTeam: 'A' | 'B', roundNumber: number, timerDuration: number): Round {
    const now = Date.now();
    this.round = {
      number: roundNumber,
      song,
      activeTeam,
      phase: 'guessing',
      startedAt: now,
      endsAt: now + timerDuration,
      currentAnswer: null,
      typingState: null,
      vetoChallenge: null
    };
    return this.round;
  }

  submitAnswer(answer: Answer): Round {
    if (!this.round) {
      throw new Error('No round in progress');
    }
    if (this.round.phase !== 'guessing') {
      throw new Error(`Cannot submit answer in ${this.round.phase} phase`);
    }

    this.round.currentAnswer = answer;
    this.round.phase = 'reveal';
    return this.round;
  }

  timeout(): Round {
    if (!this.round) {
      throw new Error('No round in progress');
    }
    if (this.round.phase !== 'guessing') {
      throw new Error(`Cannot timeout in ${this.round.phase} phase`);
    }

    this.round.phase = 'reveal';
    return this.round;
  }

  getRemainingTime(): number {
    if (!this.round) {
      return 0;
    }
    const remaining = this.round.endsAt - Date.now();
    return Math.max(0, remaining);
  }

  getCurrentRound(): Round | null {
    return this.round;
  }

  endRound(): void {
    this.round = null;
  }
}
