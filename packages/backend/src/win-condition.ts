// packages/backend/src/win-condition.ts
import type { Team } from '@party-popper/shared';

export interface WinCheckResult {
  hasWinner: boolean;
  winner: 'A' | 'B' | null;
  isTie: boolean;
}

export class WinConditionChecker {
  checkWinner(
    teams: { A: Team; B: Team },
    targetScore: number
  ): WinCheckResult {
    const scoreA = this.getTeamScore(teams.A);
    const scoreB = this.getTeamScore(teams.B);

    const aReached = scoreA >= targetScore;
    const bReached = scoreB >= targetScore;

    if (aReached && bReached) {
      return { hasWinner: false, winner: null, isTie: true };
    }

    if (aReached) {
      return { hasWinner: true, winner: 'A', isTie: false };
    }

    if (bReached) {
      return { hasWinner: true, winner: 'B', isTie: false };
    }

    return { hasWinner: false, winner: null, isTie: false };
  }

  getTeamScore(team: Team): number {
    return team.timeline.length;
  }
}
