// packages/backend/src/veto-token-manager.ts
export type TeamId = 'A' | 'B';

const INITIAL_TOKENS = 3;

export class VetoTokenManager {
  private tokens: Record<TeamId, number> = {
    A: INITIAL_TOKENS,
    B: INITIAL_TOKENS
  };

  getTokens(): Record<TeamId, number> {
    return { ...this.tokens };
  }

  getTeamTokenCount(team: TeamId): number {
    return this.tokens[team];
  }

  canUseToken(team: TeamId): boolean {
    return this.tokens[team] > 0;
  }

  useToken(team: TeamId): void {
    if (!this.canUseToken(team)) {
      throw new Error(`Team ${team} has no veto tokens`);
    }
    this.tokens[team]--;
  }

  reset(): void {
    this.tokens = { A: INITIAL_TOKENS, B: INITIAL_TOKENS };
  }
}
