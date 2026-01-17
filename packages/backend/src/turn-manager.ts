// packages/backend/src/turn-manager.ts
export type TeamId = 'A' | 'B';

export class TurnManager {
  private activeTeam: TeamId = 'A';

  getActiveTeam(): TeamId {
    return this.activeTeam;
  }

  nextTurn(): TeamId {
    this.activeTeam = this.activeTeam === 'A' ? 'B' : 'A';
    return this.activeTeam;
  }

  setActiveTeam(team: TeamId): void {
    this.activeTeam = team;
  }

  isTeamsTurn(team: TeamId): boolean {
    return this.activeTeam === team;
  }
}
