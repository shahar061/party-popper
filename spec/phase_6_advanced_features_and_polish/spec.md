# Phase 6: Advanced Features and Polish - Implementation Spec

## Overview

Phase 6 completes the P0 feature set with veto system, tiebreaker, Custom mode, and polish. This phase builds on the core gameplay loop from Phase 5.

**Prerequisites**: Phase 5 complete (core gameplay working end-to-end)

---

## Task advanced-001: Backend - Implement veto token system (3 tokens per team)

**Files:**
- Create: `packages/backend/src/veto-token-manager.ts`
- Test: `packages/backend/src/__tests__/veto-token-manager.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/veto-token-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { VetoTokenManager } from '../veto-token-manager';

describe('VetoTokenManager', () => {
  let manager: VetoTokenManager;

  beforeEach(() => {
    manager = new VetoTokenManager();
  });

  describe('initialization', () => {
    it('should start teams with 3 veto tokens each', () => {
      const tokens = manager.getTokens();
      expect(tokens.A).toBe(3);
      expect(tokens.B).toBe(3);
    });
  });

  describe('useToken', () => {
    it('should decrement token count when used', () => {
      manager.useToken('A');
      expect(manager.getTokens().A).toBe(2);
      expect(manager.getTokens().B).toBe(3);
    });

    it('should throw error when team has no tokens', () => {
      manager.useToken('A');
      manager.useToken('A');
      manager.useToken('A');
      expect(() => manager.useToken('A')).toThrow('Team A has no veto tokens');
    });
  });

  describe('canUseToken', () => {
    it('should return true when team has tokens', () => {
      expect(manager.canUseToken('A')).toBe(true);
    });

    it('should return false when team has no tokens', () => {
      manager.useToken('B');
      manager.useToken('B');
      manager.useToken('B');
      expect(manager.canUseToken('B')).toBe(false);
    });
  });

  describe('getTeamTokenCount', () => {
    it('should return specific team token count', () => {
      manager.useToken('A');
      expect(manager.getTeamTokenCount('A')).toBe(2);
      expect(manager.getTeamTokenCount('B')).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset all tokens to 3', () => {
      manager.useToken('A');
      manager.useToken('B');
      manager.useToken('B');
      manager.reset();
      expect(manager.getTokens()).toEqual({ A: 3, B: 3 });
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- veto-token-manager`
Expected: FAIL with "Cannot find module '../veto-token-manager'"

**Step 3: Implement**

```typescript
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- veto-token-manager`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/veto-token-manager.ts packages/backend/src/__tests__/veto-token-manager.test.ts
git commit -m "feat(backend): implement veto token system with 3 tokens per team"
```

---

## Task advanced-002: Backend - Add veto window phase after answer submission

**Files:**
- Modify: `packages/backend/src/round-state-machine.ts`
- Test: `packages/backend/src/__tests__/round-state-machine-veto.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/round-state-machine-veto.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoundStateMachine } from '../round-state-machine';

describe('RoundStateMachine - Veto Phase', () => {
  let machine: RoundStateMachine;
  const mockSong = {
    id: 'song-1',
    title: 'Test Song',
    artist: 'Test Artist',
    year: 1985,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  beforeEach(() => {
    machine = new RoundStateMachine();
  });

  describe('veto window transition', () => {
    it('should transition from guessing to veto_window on submission', () => {
      machine.startRound(mockSong, 'A', 60000);

      const round = machine.submitAnswer({
        artist: 'Test Artist',
        title: 'Test Song',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      expect(round.phase).toBe('veto_window');
    });

    it('should set veto window duration to 15 seconds', () => {
      machine.startRound(mockSong, 'A', 60000);
      machine.submitAnswer({
        artist: 'Test',
        title: 'Test',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      expect(machine.getVetoWindowRemaining()).toBeLessThanOrEqual(15000);
      expect(machine.getVetoWindowRemaining()).toBeGreaterThan(0);
    });

    it('should transition from veto_window to reveal when window expires', () => {
      vi.useFakeTimers();
      machine.startRound(mockSong, 'A', 60000);
      machine.submitAnswer({
        artist: 'Test',
        title: 'Test',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      vi.advanceTimersByTime(15000);
      const round = machine.expireVetoWindow();

      expect(round.phase).toBe('reveal');
      vi.useRealTimers();
    });

    it('should allow veto during veto_window phase', () => {
      machine.startRound(mockSong, 'A', 60000);
      machine.submitAnswer({
        artist: 'Test',
        title: 'Test',
        year: 1985,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      const round = machine.initiateVeto('B', 'year');

      expect(round.vetoChallenge).toEqual({
        challengingTeam: 'B',
        challengedField: 'year'
      });
    });

    it('should throw error if veto attempted in wrong phase', () => {
      machine.startRound(mockSong, 'A', 60000);

      expect(() => machine.initiateVeto('B', 'year'))
        .toThrow('Cannot veto in guessing phase');
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- round-state-machine-veto`
Expected: FAIL with test failures

**Step 3: Implement**

```typescript
// packages/backend/src/round-state-machine.ts
import type { Song, Round, Answer, VetoChallenge } from '@party-popper/shared';

export type RoundPhase = 'guessing' | 'veto_window' | 'reveal';

const VETO_WINDOW_DURATION = 15000; // 15 seconds

export class RoundStateMachine {
  private round: Round | null = null;
  private vetoWindowStartedAt: number | null = null;

  startRound(song: Song, activeTeam: 'A' | 'B', timerDuration: number): Round {
    this.vetoWindowStartedAt = null;
    this.round = {
      song,
      activeTeam,
      phase: 'guessing',
      startedAt: Date.now(),
      timerDuration,
      currentAnswer: null,
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
    const elapsed = Date.now() - this.round.startedAt;
    const remaining = this.round.timerDuration - elapsed;
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- round-state-machine-veto`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/round-state-machine.ts packages/backend/src/__tests__/round-state-machine-veto.test.ts
git commit -m "feat(backend): add veto window phase with 15-second duration"
```

---

## Task advanced-003: Backend - Handle veto resolution (steal or penalty)

**Files:**
- Create: `packages/backend/src/veto-resolver.ts`
- Test: `packages/backend/src/__tests__/veto-resolver.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/veto-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { VetoResolver } from '../veto-resolver';
import type { Song, Answer, VetoChallenge } from '@party-popper/shared';

describe('VetoResolver', () => {
  const resolver = new VetoResolver();

  const song: Song = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  describe('resolveVeto', () => {
    it('should grant steal opportunity when veto is correct (answer was wrong)', () => {
      const answer: Answer = {
        artist: 'Wrong Artist',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'artist'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(true);
      expect(result.stealOpportunity).toBe(true);
      expect(result.penaltyTeam).toBeNull();
    });

    it('should penalize vetoing team when veto is incorrect (answer was correct)', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'artist'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(false);
      expect(result.stealOpportunity).toBe(false);
      expect(result.penaltyTeam).toBeNull(); // Only token loss, no additional penalty
    });

    it('should handle year veto with exact match', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'year'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(false);
    });

    it('should handle year veto when off by more than 1', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1980,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'year'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(true);
      expect(result.stealOpportunity).toBe(true);
    });

    it('should treat close year (+/- 1) as correct for veto purposes', () => {
      const answer: Answer = {
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1976,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      };
      const veto: VetoChallenge = {
        challengingTeam: 'B',
        challengedField: 'year'
      };

      const result = resolver.resolveVeto(answer, song, veto);

      expect(result.vetoSuccessful).toBe(false);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- veto-resolver`
Expected: FAIL with "Cannot find module '../veto-resolver'"

**Step 3: Implement**

```typescript
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- veto-resolver`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/veto-resolver.ts packages/backend/src/__tests__/veto-resolver.test.ts
git commit -m "feat(backend): add veto resolution with steal opportunity logic"
```

---

## Task advanced-004: Backend - Implement tiebreaker round logic

**Files:**
- Create: `packages/backend/src/tiebreaker-manager.ts`
- Test: `packages/backend/src/__tests__/tiebreaker-manager.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/tiebreaker-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TiebreakerManager } from '../tiebreaker-manager';
import type { Team, Song } from '@party-popper/shared';

describe('TiebreakerManager', () => {
  let manager: TiebreakerManager;

  const createTeam = (score: number): Team => ({
    name: 'Test Team',
    players: [{ id: 'p1', name: 'Player', connected: true, lastSeen: Date.now() }],
    timeline: Array(score).fill({
      song: { id: '1', title: 'Test', artist: 'Test', year: 2000, spotifyUri: '', spotifyUrl: '' },
      pointsEarned: 1,
      addedAt: Date.now()
    }),
    vetoTokens: 3,
    score
  });

  const mockSong: Song = {
    id: 'tiebreaker-song',
    title: 'Tiebreaker Song',
    artist: 'Test Artist',
    year: 1990,
    spotifyUri: 'spotify:track:tie',
    spotifyUrl: 'https://open.spotify.com/track/tie'
  };

  beforeEach(() => {
    manager = new TiebreakerManager();
  });

  describe('shouldTriggerTiebreaker', () => {
    it('should trigger when both teams at target-1 and scores equal', () => {
      const teams = { A: createTeam(9), B: createTeam(9) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(true);
    });

    it('should not trigger when scores are not equal', () => {
      const teams = { A: createTeam(9), B: createTeam(8) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(false);
    });

    it('should not trigger when neither team near target', () => {
      const teams = { A: createTeam(5), B: createTeam(5) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(false);
    });

    it('should trigger when both at target (simultaneous win scenario)', () => {
      const teams = { A: createTeam(10), B: createTeam(10) };
      expect(manager.shouldTriggerTiebreaker(teams, 10)).toBe(true);
    });
  });

  describe('startTiebreaker', () => {
    it('should create tiebreaker round with same song for both teams', () => {
      const tiebreaker = manager.startTiebreaker(mockSong);

      expect(tiebreaker.song).toEqual(mockSong);
      expect(tiebreaker.isActive).toBe(true);
      expect(tiebreaker.teamASubmitted).toBe(false);
      expect(tiebreaker.teamBSubmitted).toBe(false);
    });
  });

  describe('submitTiebreakerAnswer', () => {
    it('should record answer and timestamp for team', () => {
      manager.startTiebreaker(mockSong);

      const result = manager.submitTiebreakerAnswer('A', {
        artist: 'Test Artist',
        title: 'Tiebreaker Song',
        year: 1990
      });

      expect(result.teamASubmitted).toBe(true);
      expect(result.teamAAnswer).toBeDefined();
    });

    it('should determine winner when both teams submit', () => {
      manager.startTiebreaker(mockSong);

      manager.submitTiebreakerAnswer('A', {
        artist: 'Test Artist',
        title: 'Tiebreaker Song',
        year: 1990
      });

      const result = manager.submitTiebreakerAnswer('B', {
        artist: 'Wrong',
        title: 'Wrong',
        year: 2000
      });

      expect(result.isComplete).toBe(true);
      expect(result.winner).toBe('A');
    });

    it('should award win to first correct answer', () => {
      manager.startTiebreaker(mockSong);

      // Team B submits first but wrong
      manager.submitTiebreakerAnswer('B', {
        artist: 'Wrong',
        title: 'Wrong',
        year: 2000
      });

      // Team A submits later but correct
      const result = manager.submitTiebreakerAnswer('A', {
        artist: 'Test Artist',
        title: 'Tiebreaker Song',
        year: 1990
      });

      expect(result.winner).toBe('A');
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- tiebreaker-manager`
Expected: FAIL with "Cannot find module '../tiebreaker-manager'"

**Step 3: Implement**

```typescript
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- tiebreaker-manager`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/tiebreaker-manager.ts packages/backend/src/__tests__/tiebreaker-manager.test.ts
git commit -m "feat(backend): implement tiebreaker round with simultaneous play"
```

---

## Task advanced-005: Backend - Build Custom mode song entry and validation

**Files:**
- Create: `packages/backend/src/custom-song-manager.ts`
- Test: `packages/backend/src/__tests__/custom-song-manager.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/custom-song-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CustomSongManager } from '../custom-song-manager';

describe('CustomSongManager', () => {
  let manager: CustomSongManager;

  beforeEach(() => {
    manager = new CustomSongManager();
  });

  describe('addSong', () => {
    it('should add valid song to pool', () => {
      const song = manager.addSong({
        title: 'Custom Song',
        artist: 'Custom Artist',
        year: 2020,
        spotifyId: '4uLU6hMCjMI75M1A2tKUQC'
      });

      expect(song.id).toBeDefined();
      expect(song.title).toBe('Custom Song');
      expect(song.spotifyUri).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
    });

    it('should validate Spotify ID format', () => {
      expect(() => manager.addSong({
        title: 'Song',
        artist: 'Artist',
        year: 2020,
        spotifyId: 'invalid-id!'
      })).toThrow('Invalid Spotify ID format');
    });

    it('should accept Spotify URL and extract ID', () => {
      const song = manager.addSong({
        title: 'Song',
        artist: 'Artist',
        year: 2020,
        spotifyId: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123'
      });

      expect(song.spotifyUri).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
    });

    it('should require year between 1900 and current year + 1', () => {
      expect(() => manager.addSong({
        title: 'Song',
        artist: 'Artist',
        year: 1800,
        spotifyId: '4uLU6hMCjMI75M1A2tKUQC'
      })).toThrow('Invalid year');
    });
  });

  describe('getSongPool', () => {
    it('should return all added songs', () => {
      manager.addSong({ title: 'Song 1', artist: 'Artist', year: 2020, spotifyId: 'abc123def456ghi' });
      manager.addSong({ title: 'Song 2', artist: 'Artist', year: 2021, spotifyId: 'xyz789abc123def' });

      const pool = manager.getSongPool();
      expect(pool).toHaveLength(2);
    });
  });

  describe('removeSong', () => {
    it('should remove song by id', () => {
      const song = manager.addSong({ title: 'Song', artist: 'Artist', year: 2020, spotifyId: 'abc123def456ghi' });
      manager.removeSong(song.id);

      expect(manager.getSongPool()).toHaveLength(0);
    });
  });

  describe('hasMinimumSongs', () => {
    it('should return false when below minimum', () => {
      manager.addSong({ title: 'Song', artist: 'Artist', year: 2020, spotifyId: 'abc123def456ghi' });
      expect(manager.hasMinimumSongs(10)).toBe(false);
    });

    it('should return true when at or above minimum', () => {
      for (let i = 0; i < 10; i++) {
        manager.addSong({ title: `Song ${i}`, artist: 'Artist', year: 2020, spotifyId: `abc123def456gh${i}` });
      }
      expect(manager.hasMinimumSongs(10)).toBe(true);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- custom-song-manager`
Expected: FAIL with "Cannot find module '../custom-song-manager'"

**Step 3: Implement**

```typescript
// packages/backend/src/custom-song-manager.ts
import type { Song } from '@party-popper/shared';

interface CustomSongInput {
  title: string;
  artist: string;
  year: number;
  spotifyId: string;
}

export class CustomSongManager {
  private songs: Song[] = [];
  private idCounter = 0;

  addSong(input: CustomSongInput): Song {
    const spotifyId = this.extractSpotifyId(input.spotifyId);
    this.validateSpotifyId(spotifyId);
    this.validateYear(input.year);

    const song: Song = {
      id: `custom-${++this.idCounter}`,
      title: input.title.trim(),
      artist: input.artist.trim(),
      year: input.year,
      spotifyUri: `spotify:track:${spotifyId}`,
      spotifyUrl: `https://open.spotify.com/track/${spotifyId}`
    };

    this.songs.push(song);
    return song;
  }

  private extractSpotifyId(input: string): string {
    const urlMatch = input.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    return input;
  }

  private validateSpotifyId(id: string): void {
    const validPattern = /^[a-zA-Z0-9]{15,25}$/;
    if (!validPattern.test(id)) {
      throw new Error('Invalid Spotify ID format');
    }
  }

  private validateYear(year: number): void {
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear + 1) {
      throw new Error('Invalid year');
    }
  }

  removeSong(id: string): void {
    this.songs = this.songs.filter(song => song.id !== id);
  }

  getSongPool(): Song[] {
    return [...this.songs];
  }

  hasMinimumSongs(minimum: number): boolean {
    return this.songs.length >= minimum;
  }

  clear(): void {
    this.songs = [];
    this.idCounter = 0;
  }
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- custom-song-manager`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/custom-song-manager.ts packages/backend/src/__tests__/custom-song-manager.test.ts
git commit -m "feat(backend): add custom song manager with Spotify URL validation"
```

---

## Task advanced-006: Host - Create veto challenge UI with timer countdown

**Files:**
- Create: `apps/host/src/components/VetoWindow.tsx`
- Test: `apps/host/src/__tests__/VetoWindow.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/VetoWindow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VetoWindow } from '../components/VetoWindow';

describe('VetoWindow', () => {
  it('should render veto window overlay', () => {
    render(
      <VetoWindow
        remainingTime={15000}
        vetoingTeam="B"
        isActive={true}
      />
    );

    expect(screen.getByTestId('veto-window')).toBeInTheDocument();
  });

  it('should show countdown timer', () => {
    render(
      <VetoWindow
        remainingTime={10000}
        vetoingTeam="B"
        isActive={true}
      />
    );

    expect(screen.getByTestId('veto-countdown')).toHaveTextContent('10');
  });

  it('should show which team can veto', () => {
    render(
      <VetoWindow
        remainingTime={15000}
        vetoingTeam="B"
        teamBName="The Challengers"
        isActive={true}
      />
    );

    expect(screen.getByText(/The Challengers/)).toBeInTheDocument();
    expect(screen.getByText(/can challenge/i)).toBeInTheDocument();
  });

  it('should have dramatic tension animation', () => {
    render(
      <VetoWindow
        remainingTime={5000}
        vetoingTeam="B"
        isActive={true}
      />
    );

    const countdown = screen.getByTestId('veto-countdown');
    expect(countdown).toHaveClass('animate-pulse');
  });

  it('should not render when inactive', () => {
    render(
      <VetoWindow
        remainingTime={15000}
        vetoingTeam="B"
        isActive={false}
      />
    );

    expect(screen.queryByTestId('veto-window')).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VetoWindow`
Expected: FAIL with "Cannot find module '../components/VetoWindow'"

**Step 3: Implement**

```typescript
// apps/host/src/components/VetoWindow.tsx
interface VetoWindowProps {
  remainingTime: number;
  vetoingTeam: 'A' | 'B';
  teamAName?: string;
  teamBName?: string;
  isActive: boolean;
}

export function VetoWindow({
  remainingTime,
  vetoingTeam,
  teamAName = 'Team A',
  teamBName = 'Team B',
  isActive
}: VetoWindowProps) {
  if (!isActive) return null;

  const seconds = Math.ceil(remainingTime / 1000);
  const teamName = vetoingTeam === 'A' ? teamAName : teamBName;
  const isUrgent = seconds <= 5;

  return (
    <div
      data-testid="veto-window"
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
    >
      <div className="bg-gray-900 rounded-3xl p-12 text-center border-4 border-yellow-500 shadow-2xl shadow-yellow-500/20">
        <div className="text-2xl text-yellow-400 uppercase tracking-wider mb-4">
          Veto Challenge Window
        </div>

        <div className="text-xl text-gray-300 mb-8">
          <span className="font-bold text-white">{teamName}</span> can challenge the answer!
        </div>

        <div
          data-testid="veto-countdown"
          className={`text-9xl font-bold text-white mb-8 ${isUrgent ? 'animate-pulse text-red-500' : ''}`}
        >
          {seconds}
        </div>

        <div className="text-lg text-gray-400">
          seconds remaining
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-8 rounded-full transition-all duration-300 ${
                i < seconds ? 'bg-yellow-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VetoWindow`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/VetoWindow.tsx apps/host/src/__tests__/VetoWindow.test.tsx
git commit -m "feat(host): add veto challenge overlay with countdown timer"
```

---

## Task advanced-007: Host - Display veto token counts for both teams

**Files:**
- Create: `apps/host/src/components/VetoTokenDisplay.tsx`
- Test: `apps/host/src/__tests__/VetoTokenDisplay.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/VetoTokenDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VetoTokenDisplay } from '../components/VetoTokenDisplay';

describe('VetoTokenDisplay', () => {
  it('should show 3 token icons per team', () => {
    render(<VetoTokenDisplay teamATokens={3} teamBTokens={3} />);

    const teamATokens = screen.getAllByTestId(/team-a-token/);
    const teamBTokens = screen.getAllByTestId(/team-b-token/);

    expect(teamATokens).toHaveLength(3);
    expect(teamBTokens).toHaveLength(3);
  });

  it('should dim used tokens', () => {
    render(<VetoTokenDisplay teamATokens={1} teamBTokens={2} />);

    const teamATokens = screen.getAllByTestId(/team-a-token/);

    expect(teamATokens[0]).toHaveClass('opacity-100');
    expect(teamATokens[1]).toHaveClass('opacity-30');
    expect(teamATokens[2]).toHaveClass('opacity-30');
  });

  it('should show team names', () => {
    render(
      <VetoTokenDisplay
        teamATokens={3}
        teamBTokens={3}
        teamAName="Alpha"
        teamBName="Beta"
      />
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('should show remaining count', () => {
    render(<VetoTokenDisplay teamATokens={2} teamBTokens={1} />);

    expect(screen.getByTestId('team-a-count')).toHaveTextContent('2');
    expect(screen.getByTestId('team-b-count')).toHaveTextContent('1');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VetoTokenDisplay`
Expected: FAIL with "Cannot find module '../components/VetoTokenDisplay'"

**Step 3: Implement**

```typescript
// apps/host/src/components/VetoTokenDisplay.tsx
interface VetoTokenDisplayProps {
  teamATokens: number;
  teamBTokens: number;
  teamAName?: string;
  teamBName?: string;
}

const MAX_TOKENS = 3;

function TokenIcon({ active, testId }: { active: boolean; testId: string }) {
  return (
    <div
      data-testid={testId}
      className={`w-8 h-8 rounded-full border-2 border-yellow-500 flex items-center justify-center transition-opacity ${
        active ? 'opacity-100 bg-yellow-500' : 'opacity-30 bg-transparent'
      }`}
    >
      <svg
        className={`w-5 h-5 ${active ? 'text-black' : 'text-yellow-500'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM6.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM10 15a5 5 0 01-4.546-2.916.5.5 0 01.908-.417A4 4 0 0010 14a4 4 0 003.638-2.333.5.5 0 11.908.417A5 5 0 0110 15z" />
      </svg>
    </div>
  );
}

export function VetoTokenDisplay({
  teamATokens,
  teamBTokens,
  teamAName = 'Team A',
  teamBName = 'Team B'
}: VetoTokenDisplayProps) {
  return (
    <div className="flex justify-between items-center bg-gray-800 rounded-xl p-4">
      {/* Team A */}
      <div className="flex items-center gap-4">
        <div className="text-lg font-semibold text-blue-400">{teamAName}</div>
        <div className="flex gap-2">
          {Array.from({ length: MAX_TOKENS }).map((_, i) => (
            <TokenIcon
              key={`a-${i}`}
              active={i < teamATokens}
              testId={`team-a-token-${i}`}
            />
          ))}
        </div>
        <div data-testid="team-a-count" className="text-sm text-gray-400">
          {teamATokens}
        </div>
      </div>

      <div className="text-gray-500 text-sm">Veto Tokens</div>

      {/* Team B */}
      <div className="flex items-center gap-4">
        <div data-testid="team-b-count" className="text-sm text-gray-400">
          {teamBTokens}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: MAX_TOKENS }).map((_, i) => (
            <TokenIcon
              key={`b-${i}`}
              active={i < teamBTokens}
              testId={`team-b-token-${i}`}
            />
          ))}
        </div>
        <div className="text-lg font-semibold text-orange-400">{teamBName}</div>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VetoTokenDisplay`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/VetoTokenDisplay.tsx apps/host/src/__tests__/VetoTokenDisplay.test.tsx
git commit -m "feat(host): add veto token display with visual indicators"
```

---

## Task advanced-008: Host - Build veto result animation

**Files:**
- Create: `apps/host/src/components/VetoResult.tsx`
- Test: `apps/host/src/__tests__/VetoResult.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/VetoResult.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VetoResult } from '../components/VetoResult';

describe('VetoResult', () => {
  it('should show steal opportunity on successful veto', () => {
    render(
      <VetoResult
        success={true}
        challengingTeam="B"
        teamName="The Challengers"
      />
    );

    expect(screen.getByText(/steal opportunity/i)).toBeInTheDocument();
    expect(screen.getByText(/The Challengers/)).toBeInTheDocument();
  });

  it('should show failed message on unsuccessful veto', () => {
    render(
      <VetoResult
        success={false}
        challengingTeam="B"
        teamName="The Challengers"
      />
    );

    expect(screen.getByText(/challenge failed/i)).toBeInTheDocument();
  });

  it('should show token lost indicator', () => {
    render(
      <VetoResult
        success={false}
        challengingTeam="B"
        teamName="The Challengers"
      />
    );

    expect(screen.getByText(/token lost/i)).toBeInTheDocument();
  });

  it('should have success animation class when successful', () => {
    render(
      <VetoResult
        success={true}
        challengingTeam="A"
        teamName="Team A"
      />
    );

    const container = screen.getByTestId('veto-result');
    expect(container).toHaveClass('border-green-500');
  });

  it('should have failure animation class when unsuccessful', () => {
    render(
      <VetoResult
        success={false}
        challengingTeam="A"
        teamName="Team A"
      />
    );

    const container = screen.getByTestId('veto-result');
    expect(container).toHaveClass('border-red-500');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VetoResult`
Expected: FAIL with "Cannot find module '../components/VetoResult'"

**Step 3: Implement**

```typescript
// apps/host/src/components/VetoResult.tsx
interface VetoResultProps {
  success: boolean;
  challengingTeam: 'A' | 'B';
  teamName: string;
}

export function VetoResult({ success, challengingTeam, teamName }: VetoResultProps) {
  return (
    <div
      data-testid="veto-result"
      className={`fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fadeIn`}
    >
      <div
        className={`bg-gray-900 rounded-3xl p-16 text-center border-4 ${
          success ? 'border-green-500 shadow-green-500/30' : 'border-red-500 shadow-red-500/30'
        } shadow-2xl`}
      >
        {success ? (
          <>
            <div className="text-6xl mb-6">🎯</div>
            <div className="text-4xl font-bold text-green-400 mb-4">
              STEAL OPPORTUNITY!
            </div>
            <div className="text-2xl text-white mb-2">
              <span className="font-bold">{teamName}</span> challenged correctly!
            </div>
            <div className="text-xl text-gray-400">
              Answer the song to steal the point
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-6">❌</div>
            <div className="text-4xl font-bold text-red-400 mb-4">
              CHALLENGE FAILED
            </div>
            <div className="text-2xl text-white mb-2">
              The answer was correct
            </div>
            <div className="text-xl text-yellow-400 flex items-center justify-center gap-2">
              <span>🪙</span>
              <span>Token lost</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VetoResult`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/VetoResult.tsx apps/host/src/__tests__/VetoResult.test.tsx
git commit -m "feat(host): add veto result animation for steal/failure"
```

---

## Task advanced-009: Host - Implement tiebreaker screen

**Files:**
- Create: `apps/host/src/components/TiebreakerScreen.tsx`
- Test: `apps/host/src/__tests__/TiebreakerScreen.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/TiebreakerScreen.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TiebreakerScreen } from '../components/TiebreakerScreen';

describe('TiebreakerScreen', () => {
  const mockSong = {
    id: 'tie-1',
    title: 'Tiebreaker Song',
    artist: 'Artist',
    year: 1990,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  it('should highlight both teams as active', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={false}
        teamBSubmitted={false}
      />
    );

    expect(screen.getByTestId('team-a-panel')).toHaveClass('border-blue-500');
    expect(screen.getByTestId('team-b-panel')).toHaveClass('border-orange-500');
  });

  it('should show race-style UI with both answer areas', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={false}
        teamBSubmitted={false}
      />
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText(/tiebreaker/i)).toBeInTheDocument();
  });

  it('should show submitted indicator when team submits', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={true}
        teamBSubmitted={false}
      />
    );

    expect(screen.getByTestId('team-a-submitted')).toBeInTheDocument();
    expect(screen.queryByTestId('team-b-submitted')).not.toBeInTheDocument();
  });

  it('should show winner announcement when complete', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={true}
        teamBSubmitted={true}
        winner="A"
      />
    );

    expect(screen.getByText(/Alpha wins/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- TiebreakerScreen`
Expected: FAIL with "Cannot find module '../components/TiebreakerScreen'"

**Step 3: Implement**

```typescript
// apps/host/src/components/TiebreakerScreen.tsx
import type { Song } from '@party-popper/shared';
import { SongQRCode } from './SongQRCode';

interface TiebreakerScreenProps {
  song: Song;
  teamAName: string;
  teamBName: string;
  teamASubmitted: boolean;
  teamBSubmitted: boolean;
  winner?: 'A' | 'B' | null;
}

export function TiebreakerScreen({
  song,
  teamAName,
  teamBName,
  teamASubmitted,
  teamBSubmitted,
  winner
}: TiebreakerScreenProps) {
  const winnerName = winner === 'A' ? teamAName : winner === 'B' ? teamBName : null;

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="text-center mb-8">
        <div className="text-4xl font-bold text-yellow-400 animate-pulse">
          ⚡ TIEBREAKER ⚡
        </div>
        <div className="text-xl text-gray-400 mt-2">
          First correct answer wins!
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <SongQRCode spotifyUri={song.spotifyUri} size={200} />
      </div>

      <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Team A Panel */}
        <div
          data-testid="team-a-panel"
          className="bg-gray-800 rounded-2xl p-6 border-4 border-blue-500"
        >
          <div className="text-2xl font-bold text-blue-400 mb-4">{teamAName}</div>
          {teamASubmitted ? (
            <div data-testid="team-a-submitted" className="text-green-400 text-xl flex items-center gap-2">
              <span>✓</span> Answer Submitted
            </div>
          ) : (
            <div className="text-gray-400 text-xl animate-pulse">
              Waiting for answer...
            </div>
          )}
        </div>

        {/* Team B Panel */}
        <div
          data-testid="team-b-panel"
          className="bg-gray-800 rounded-2xl p-6 border-4 border-orange-500"
        >
          <div className="text-2xl font-bold text-orange-400 mb-4">{teamBName}</div>
          {teamBSubmitted ? (
            <div data-testid="team-b-submitted" className="text-green-400 text-xl flex items-center gap-2">
              <span>✓</span> Answer Submitted
            </div>
          ) : (
            <div className="text-gray-400 text-xl animate-pulse">
              Waiting for answer...
            </div>
          )}
        </div>
      </div>

      {/* Winner Announcement */}
      {winner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl mb-8">🏆</div>
            <div className="text-6xl font-bold text-yellow-400 mb-4">
              {winnerName} WINS!
            </div>
            <div className="text-2xl text-white">
              Tiebreaker Champion
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- TiebreakerScreen`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/TiebreakerScreen.tsx apps/host/src/__tests__/TiebreakerScreen.test.tsx
git commit -m "feat(host): add tiebreaker screen with dual team display"
```

---

## Task advanced-010: Host - Create victory celebration screen

**Files:**
- Create: `apps/host/src/components/VictoryScreen.tsx`
- Test: `apps/host/src/__tests__/VictoryScreen.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/VictoryScreen.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VictoryScreen } from '../components/VictoryScreen';

describe('VictoryScreen', () => {
  const mockTimeline = [
    { song: { id: '1', title: 'Song 1', artist: 'Artist 1', year: 1985, spotifyUri: '', spotifyUrl: '' }, pointsEarned: 2, addedAt: Date.now() },
    { song: { id: '2', title: 'Song 2', artist: 'Artist 2', year: 1990, spotifyUri: '', spotifyUrl: '' }, pointsEarned: 3, addedAt: Date.now() }
  ];

  it('should display winning team prominently', () => {
    render(
      <VictoryScreen
        winnerName="The Champions"
        winnerTeam="A"
        teamAScore={10}
        teamBScore={7}
        teamATimeline={mockTimeline}
        teamBTimeline={[]}
      />
    );

    expect(screen.getByText('The Champions')).toBeInTheDocument();
    expect(screen.getByText(/winner/i)).toBeInTheDocument();
  });

  it('should show final scores', () => {
    render(
      <VictoryScreen
        winnerName="Team A"
        winnerTeam="A"
        teamAScore={10}
        teamBScore={7}
        teamATimeline={mockTimeline}
        teamBTimeline={[]}
      />
    );

    expect(screen.getByTestId('final-score-a')).toHaveTextContent('10');
    expect(screen.getByTestId('final-score-b')).toHaveTextContent('7');
  });

  it('should display timelines for both teams', () => {
    render(
      <VictoryScreen
        winnerName="Team A"
        winnerTeam="A"
        teamAScore={2}
        teamBScore={1}
        teamATimeline={mockTimeline}
        teamBTimeline={[mockTimeline[0]]}
      />
    );

    expect(screen.getByText('Song 1')).toBeInTheDocument();
    expect(screen.getByText('Song 2')).toBeInTheDocument();
  });

  it('should have confetti/celebration class', () => {
    render(
      <VictoryScreen
        winnerName="Team A"
        winnerTeam="A"
        teamAScore={10}
        teamBScore={7}
        teamATimeline={[]}
        teamBTimeline={[]}
      />
    );

    expect(screen.getByTestId('victory-screen')).toHaveClass('victory-celebration');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VictoryScreen`
Expected: FAIL with "Cannot find module '../components/VictoryScreen'"

**Step 3: Implement**

```typescript
// apps/host/src/components/VictoryScreen.tsx
import type { TimelineSong } from '@party-popper/shared';

interface VictoryScreenProps {
  winnerName: string;
  winnerTeam: 'A' | 'B';
  teamAScore: number;
  teamBScore: number;
  teamATimeline: TimelineSong[];
  teamBTimeline: TimelineSong[];
  teamAName?: string;
  teamBName?: string;
}

export function VictoryScreen({
  winnerName,
  winnerTeam,
  teamAScore,
  teamBScore,
  teamATimeline,
  teamBTimeline,
  teamAName = 'Team A',
  teamBName = 'Team B'
}: VictoryScreenProps) {
  const winnerColor = winnerTeam === 'A' ? 'text-blue-400' : 'text-orange-400';

  return (
    <div
      data-testid="victory-screen"
      className="min-h-screen bg-gray-900 p-8 victory-celebration relative overflow-hidden"
    >
      {/* Confetti background effect */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#3b82f6', '#f97316', '#eab308', '#22c55e', '#ef4444'][i % 5],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random()}s`
            }}
          />
        ))}
      </div>

      {/* Winner Announcement */}
      <div className="text-center mb-12 relative z-10">
        <div className="text-8xl mb-4">🏆</div>
        <div className="text-3xl text-yellow-400 uppercase tracking-wider mb-2">
          Winner
        </div>
        <div className={`text-6xl font-bold ${winnerColor}`}>
          {winnerName}
        </div>
      </div>

      {/* Final Scores */}
      <div className="flex justify-center gap-16 mb-12 relative z-10">
        <div className="text-center">
          <div className="text-xl text-blue-400 mb-2">{teamAName}</div>
          <div
            data-testid="final-score-a"
            className={`text-6xl font-bold ${winnerTeam === 'A' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            {teamAScore}
          </div>
        </div>
        <div className="text-4xl text-gray-500 self-center">vs</div>
        <div className="text-center">
          <div className="text-xl text-orange-400 mb-2">{teamBName}</div>
          <div
            data-testid="final-score-b"
            className={`text-6xl font-bold ${winnerTeam === 'B' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            {teamBScore}
          </div>
        </div>
      </div>

      {/* Timelines */}
      <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto relative z-10">
        <div className="bg-gray-800/80 rounded-xl p-6">
          <h3 className="text-xl font-bold text-blue-400 mb-4">{teamAName}'s Timeline</h3>
          <div className="space-y-2">
            {teamATimeline.map((entry) => (
              <div key={entry.song.id} className="flex justify-between text-gray-300">
                <span>{entry.song.title}</span>
                <span className="text-gray-500">{entry.song.year}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/80 rounded-xl p-6">
          <h3 className="text-xl font-bold text-orange-400 mb-4">{teamBName}'s Timeline</h3>
          <div className="space-y-2">
            {teamBTimeline.map((entry) => (
              <div key={entry.song.id} className="flex justify-between text-gray-300">
                <span>{entry.song.title}</span>
                <span className="text-gray-500">{entry.song.year}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- VictoryScreen`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/VictoryScreen.tsx apps/host/src/__tests__/VictoryScreen.test.tsx
git commit -m "feat(host): add victory celebration screen with confetti"
```

---

I need to continue with the remaining tasks. Let me add the rest of the spec.
