// packages/backend/src/round-state-machine.ts
import type { Song, Round, Answer, RoundPhase } from '@party-popper/shared';

const VETO_WINDOW_DURATION = 15000; // 15 seconds

export class RoundStateMachine {
  private round: Round | null = null;
  private vetoWindowStartedAt: number | null = null;

  startRound(song: Song, activeTeam: 'A' | 'B', roundNumber: number, timerDuration: number): Round {
    const now = Date.now();
    this.vetoWindowStartedAt = null;
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
    this.round.phase = 'veto_window';
    this.vetoWindowStartedAt = Date.now();
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

  initiateVeto(challengingTeam: 'A' | 'B', challengedField: 'artist' | 'title' | 'year'): Round {
    if (!this.round) {
      throw new Error('No round in progress');
    }
    if (this.round.phase !== 'veto_window') {
      throw new Error(`Cannot veto in ${this.round.phase} phase`);
    }

    this.round.vetoChallenge = {
      challengingTeam,
      challengedField
    };
    this.round.phase = 'reveal';
    return this.round;
  }

  expireVetoWindow(): Round {
    if (!this.round) {
      throw new Error('No round in progress');
    }
    if (this.round.phase !== 'veto_window') {
      throw new Error(`Cannot expire veto window in ${this.round.phase} phase`);
    }

    this.round.phase = 'reveal';
    return this.round;
  }

  getVetoWindowRemaining(): number {
    if (!this.vetoWindowStartedAt || this.round?.phase !== 'veto_window') {
      return 0;
    }
    const elapsed = Date.now() - this.vetoWindowStartedAt;
    return Math.max(0, VETO_WINDOW_DURATION - elapsed);
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
    this.vetoWindowStartedAt = null;
  }
}
