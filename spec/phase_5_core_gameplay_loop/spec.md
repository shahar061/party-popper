# Phase 5: Core Gameplay Loop - Implementation Spec

## Overview

This phase implements the main game mechanics: playing songs, submitting answers, scoring, building timelines, and detecting win conditions. All tasks follow TDD methodology.

---

## Task gameplay-001: Backend - Implement round state machine

**Files:**
- Create: `packages/backend/src/round-state-machine.ts`
- Modify: `packages/backend/src/game-durable-object.ts`
- Test: `packages/backend/src/__tests__/round-state-machine.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/round-state-machine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoundStateMachine, RoundPhase } from '../round-state-machine';

describe('RoundStateMachine', () => {
  let machine: RoundStateMachine;
  const mockSong = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  beforeEach(() => {
    machine = new RoundStateMachine();
  });

  describe('startRound', () => {
    it('should initialize round in guessing phase', () => {
      const round = machine.startRound(mockSong, 'A', 60000);

      expect(round.phase).toBe('guessing');
      expect(round.song).toEqual(mockSong);
      expect(round.activeTeam).toBe('A');
      expect(round.currentAnswer).toBeNull();
      expect(round.vetoChallenge).toBeNull();
    });

    it('should set timer duration', () => {
      const round = machine.startRound(mockSong, 'A', 45000);

      expect(round.timerDuration).toBe(45000);
      expect(round.startedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('phase transitions', () => {
    it('should transition from guessing to reveal on submission', () => {
      machine.startRound(mockSong, 'A', 60000);

      const round = machine.submitAnswer({
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      });

      expect(round.phase).toBe('reveal');
    });

    it('should transition from guessing to reveal on timeout', () => {
      machine.startRound(mockSong, 'A', 60000);

      const round = machine.timeout();

      expect(round.phase).toBe('reveal');
      expect(round.currentAnswer).toBeNull();
    });

    it('should throw error if submitting answer in wrong phase', () => {
      machine.startRound(mockSong, 'A', 60000);
      machine.timeout(); // Move to reveal

      expect(() => machine.submitAnswer({
        artist: 'Queen',
        title: 'Test',
        year: 1975,
        submittedBy: 'player-1',
        submittedAt: Date.now()
      })).toThrow('Cannot submit answer in reveal phase');
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time in guessing phase', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      machine.startRound(mockSong, 'A', 60000);

      vi.setSystemTime(now + 30000);
      expect(machine.getRemainingTime()).toBe(30000);

      vi.useRealTimers();
    });

    it('should return 0 if time expired', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      machine.startRound(mockSong, 'A', 60000);

      vi.setSystemTime(now + 70000);
      expect(machine.getRemainingTime()).toBe(0);

      vi.useRealTimers();
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- round-state-machine`
Expected: FAIL with "Cannot find module '../round-state-machine'"

**Step 3: Implement**

```typescript
// packages/backend/src/round-state-machine.ts
import type { Song, Round, Answer, VetoChallenge } from '@party-popper/shared';

export type RoundPhase = 'guessing' | 'reveal';

export class RoundStateMachine {
  private round: Round | null = null;

  startRound(song: Song, activeTeam: 'A' | 'B', timerDuration: number): Round {
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
    const elapsed = Date.now() - this.round.startedAt;
    const remaining = this.round.timerDuration - elapsed;
    return Math.max(0, remaining);
  }

  getCurrentRound(): Round | null {
    return this.round;
  }

  endRound(): void {
    this.round = null;
  }
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- round-state-machine`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/round-state-machine.ts packages/backend/src/__tests__/round-state-machine.test.ts
git commit -m "feat(backend): implement round state machine with guessing/reveal phases"
```

---

## Task gameplay-002: Backend - Build answer submission and validation logic

**Files:**
- Create: `packages/backend/src/answer-validator.ts`
- Modify: `packages/backend/src/game-durable-object.ts`
- Test: `packages/backend/src/__tests__/answer-validator.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/answer-validator.test.ts
import { describe, it, expect } from 'vitest';
import { AnswerValidator } from '../answer-validator';
import type { Song } from '@party-popper/shared';

describe('AnswerValidator', () => {
  const validator = new AnswerValidator();
  const song: Song = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  describe('validateArtist', () => {
    it('should match exact artist name', () => {
      expect(validator.validateArtist('Queen', song)).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(validator.validateArtist('queen', song)).toBe(true);
      expect(validator.validateArtist('QUEEN', song)).toBe(true);
    });

    it('should ignore leading "The"', () => {
      const beatlesSong: Song = { ...song, artist: 'The Beatles' };
      expect(validator.validateArtist('Beatles', beatlesSong)).toBe(true);
      expect(validator.validateArtist('the beatles', beatlesSong)).toBe(true);
    });

    it('should reject incorrect artist', () => {
      expect(validator.validateArtist('Prince', song)).toBe(false);
    });

    it('should trim whitespace', () => {
      expect(validator.validateArtist('  Queen  ', song)).toBe(true);
    });
  });

  describe('validateTitle', () => {
    it('should match exact title', () => {
      expect(validator.validateTitle('Bohemian Rhapsody', song)).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(validator.validateTitle('bohemian rhapsody', song)).toBe(true);
    });

    it('should reject incorrect title', () => {
      expect(validator.validateTitle('We Will Rock You', song)).toBe(false);
    });
  });

  describe('validateYear', () => {
    it('should return 1 for exact year match', () => {
      expect(validator.validateYear(1975, song)).toBe(1);
    });

    it('should return 0.5 for +/- 1 year', () => {
      expect(validator.validateYear(1974, song)).toBe(0.5);
      expect(validator.validateYear(1976, song)).toBe(0.5);
    });

    it('should return 0 for more than 1 year off', () => {
      expect(validator.validateYear(1973, song)).toBe(0);
      expect(validator.validateYear(1980, song)).toBe(0);
    });
  });

  describe('validateAnswer', () => {
    it('should return full validation result', () => {
      const result = validator.validateAnswer(
        { artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 },
        song
      );

      expect(result.artistCorrect).toBe(true);
      expect(result.titleCorrect).toBe(true);
      expect(result.yearScore).toBe(1);
      expect(result.totalScore).toBe(3);
    });

    it('should calculate partial scores', () => {
      const result = validator.validateAnswer(
        { artist: 'Wrong', title: 'Bohemian Rhapsody', year: 1976 },
        song
      );

      expect(result.artistCorrect).toBe(false);
      expect(result.titleCorrect).toBe(true);
      expect(result.yearScore).toBe(0.5);
      expect(result.totalScore).toBe(1.5);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- answer-validator`
Expected: FAIL with "Cannot find module '../answer-validator'"

**Step 3: Implement**

```typescript
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- answer-validator`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/answer-validator.ts packages/backend/src/__tests__/answer-validator.test.ts
git commit -m "feat(backend): add answer validation with fuzzy matching for artist/title"
```

---

## Task gameplay-003: Backend - Implement scoring system

**Files:**
- Create: `packages/backend/src/scoring-system.ts`
- Modify: `packages/backend/src/game-durable-object.ts`
- Test: `packages/backend/src/__tests__/scoring-system.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/scoring-system.test.ts
import { describe, it, expect } from 'vitest';
import { ScoringSystem } from '../scoring-system';
import type { ValidationResult } from '../answer-validator';

describe('ScoringSystem', () => {
  const scoring = new ScoringSystem();

  describe('calculatePoints', () => {
    it('should award 1 point for correct artist', () => {
      const result: ValidationResult = {
        artistCorrect: true,
        titleCorrect: false,
        yearScore: 0,
        totalScore: 1
      };
      expect(scoring.calculatePoints(result)).toBe(1);
    });

    it('should award 1 point for correct title', () => {
      const result: ValidationResult = {
        artistCorrect: false,
        titleCorrect: true,
        yearScore: 0,
        totalScore: 1
      };
      expect(scoring.calculatePoints(result)).toBe(1);
    });

    it('should award 1 point for exact year', () => {
      const result: ValidationResult = {
        artistCorrect: false,
        titleCorrect: false,
        yearScore: 1,
        totalScore: 1
      };
      expect(scoring.calculatePoints(result)).toBe(1);
    });

    it('should award 0.5 points for close year', () => {
      const result: ValidationResult = {
        artistCorrect: false,
        titleCorrect: false,
        yearScore: 0.5,
        totalScore: 0.5
      };
      expect(scoring.calculatePoints(result)).toBe(0.5);
    });

    it('should sum all points for perfect answer', () => {
      const result: ValidationResult = {
        artistCorrect: true,
        titleCorrect: true,
        yearScore: 1,
        totalScore: 3
      };
      expect(scoring.calculatePoints(result)).toBe(3);
    });
  });

  describe('shouldAddToTimeline', () => {
    it('should add song if any points scored', () => {
      expect(scoring.shouldAddToTimeline(0.5)).toBe(true);
      expect(scoring.shouldAddToTimeline(1)).toBe(true);
      expect(scoring.shouldAddToTimeline(3)).toBe(true);
    });

    it('should not add song if zero points', () => {
      expect(scoring.shouldAddToTimeline(0)).toBe(false);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- scoring-system`
Expected: FAIL with "Cannot find module '../scoring-system'"

**Step 3: Implement**

```typescript
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- scoring-system`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/scoring-system.ts packages/backend/src/__tests__/scoring-system.test.ts
git commit -m "feat(backend): implement scoring system with partial credit"
```

---

## Task gameplay-004: Backend - Add timeline management

**Files:**
- Create: `packages/backend/src/timeline-manager.ts`
- Test: `packages/backend/src/__tests__/timeline-manager.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/timeline-manager.test.ts
import { describe, it, expect } from 'vitest';
import { TimelineManager } from '../timeline-manager';
import type { Song, TimelineSong } from '@party-popper/shared';

describe('TimelineManager', () => {
  let manager: TimelineManager;

  const createSong = (year: number, title: string): Song => ({
    id: `song-${year}`,
    title,
    artist: 'Test Artist',
    year,
    spotifyUri: `spotify:track:${year}`,
    spotifyUrl: `https://open.spotify.com/track/${year}`
  });

  beforeEach(() => {
    manager = new TimelineManager();
  });

  describe('addSong', () => {
    it('should add first song to empty timeline', () => {
      const song = createSong(1985, 'Song A');
      const timeline = manager.addSong([], song, 2);

      expect(timeline).toHaveLength(1);
      expect(timeline[0].song).toEqual(song);
      expect(timeline[0].pointsEarned).toBe(2);
    });

    it('should insert songs in chronological order', () => {
      const song1990 = createSong(1990, 'Song 1990');
      const song1980 = createSong(1980, 'Song 1980');
      const song1985 = createSong(1985, 'Song 1985');

      let timeline = manager.addSong([], song1990, 1);
      timeline = manager.addSong(timeline, song1980, 2);
      timeline = manager.addSong(timeline, song1985, 3);

      expect(timeline[0].song.year).toBe(1980);
      expect(timeline[1].song.year).toBe(1985);
      expect(timeline[2].song.year).toBe(1990);
    });

    it('should handle songs with same year', () => {
      const songA = createSong(1985, 'Song A');
      const songB = createSong(1985, 'Song B');

      let timeline = manager.addSong([], songA, 1);
      timeline = manager.addSong(timeline, songB, 2);

      expect(timeline).toHaveLength(2);
      expect(timeline[0].song.year).toBe(1985);
      expect(timeline[1].song.year).toBe(1985);
    });
  });

  describe('isDuplicate', () => {
    it('should detect duplicate song', () => {
      const song = createSong(1985, 'Song A');
      const timeline: TimelineSong[] = [{ song, pointsEarned: 2, addedAt: Date.now() }];

      expect(manager.isDuplicate(timeline, song)).toBe(true);
    });

    it('should return false for new song', () => {
      const song1 = createSong(1985, 'Song A');
      const song2 = createSong(1990, 'Song B');
      const timeline: TimelineSong[] = [{ song: song1, pointsEarned: 2, addedAt: Date.now() }];

      expect(manager.isDuplicate(timeline, song2)).toBe(false);
    });
  });

  describe('getTimelineScore', () => {
    it('should return number of songs in timeline', () => {
      const song1 = createSong(1985, 'Song A');
      const song2 = createSong(1990, 'Song B');

      let timeline = manager.addSong([], song1, 2);
      timeline = manager.addSong(timeline, song2, 1);

      expect(manager.getTimelineScore(timeline)).toBe(2);
    });

    it('should return 0 for empty timeline', () => {
      expect(manager.getTimelineScore([])).toBe(0);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- timeline-manager`
Expected: FAIL with "Cannot find module '../timeline-manager'"

**Step 3: Implement**

```typescript
// packages/backend/src/timeline-manager.ts
import type { Song, TimelineSong } from '@party-popper/shared';

export class TimelineManager {
  addSong(timeline: TimelineSong[], song: Song, pointsEarned: number): TimelineSong[] {
    const newEntry: TimelineSong = {
      song,
      pointsEarned,
      addedAt: Date.now()
    };

    const newTimeline = [...timeline, newEntry];

    // Sort by year ascending
    newTimeline.sort((a, b) => a.song.year - b.song.year);

    return newTimeline;
  }

  isDuplicate(timeline: TimelineSong[], song: Song): boolean {
    return timeline.some(entry => entry.song.id === song.id);
  }

  getTimelineScore(timeline: TimelineSong[]): number {
    return timeline.length;
  }
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- timeline-manager`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/timeline-manager.ts packages/backend/src/__tests__/timeline-manager.test.ts
git commit -m "feat(backend): add timeline manager with chronological ordering"
```

---

## Task gameplay-005: Backend - Implement turn rotation

**Files:**
- Create: `packages/backend/src/turn-manager.ts`
- Test: `packages/backend/src/__tests__/turn-manager.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/turn-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TurnManager } from '../turn-manager';

describe('TurnManager', () => {
  let turnManager: TurnManager;

  beforeEach(() => {
    turnManager = new TurnManager();
  });

  describe('getActiveTeam', () => {
    it('should start with Team A', () => {
      expect(turnManager.getActiveTeam()).toBe('A');
    });
  });

  describe('nextTurn', () => {
    it('should alternate from A to B', () => {
      expect(turnManager.getActiveTeam()).toBe('A');
      turnManager.nextTurn();
      expect(turnManager.getActiveTeam()).toBe('B');
    });

    it('should alternate from B to A', () => {
      turnManager.nextTurn(); // A -> B
      turnManager.nextTurn(); // B -> A
      expect(turnManager.getActiveTeam()).toBe('A');
    });

    it('should continue alternating', () => {
      const sequence: string[] = [];
      for (let i = 0; i < 6; i++) {
        sequence.push(turnManager.getActiveTeam());
        turnManager.nextTurn();
      }
      expect(sequence).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
    });
  });

  describe('setActiveTeam', () => {
    it('should allow setting active team directly', () => {
      turnManager.setActiveTeam('B');
      expect(turnManager.getActiveTeam()).toBe('B');
    });
  });

  describe('isTeamsTurn', () => {
    it('should return true for active team', () => {
      expect(turnManager.isTeamsTurn('A')).toBe(true);
      expect(turnManager.isTeamsTurn('B')).toBe(false);
    });

    it('should update after turn change', () => {
      turnManager.nextTurn();
      expect(turnManager.isTeamsTurn('A')).toBe(false);
      expect(turnManager.isTeamsTurn('B')).toBe(true);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- turn-manager`
Expected: FAIL with "Cannot find module '../turn-manager'"

**Step 3: Implement**

```typescript
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- turn-manager`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/turn-manager.ts packages/backend/src/__tests__/turn-manager.test.ts
git commit -m "feat(backend): implement turn rotation between teams"
```

---

## Task gameplay-006: Backend - Add win condition detection

**Files:**
- Create: `packages/backend/src/win-condition.ts`
- Test: `packages/backend/src/__tests__/win-condition.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/win-condition.test.ts
import { describe, it, expect } from 'vitest';
import { WinConditionChecker } from '../win-condition';
import type { Team } from '@party-popper/shared';

describe('WinConditionChecker', () => {
  const checker = new WinConditionChecker();

  const createTeam = (timelineLength: number): Team => ({
    name: 'Test Team',
    players: [],
    timeline: Array(timelineLength).fill({
      song: { id: '1', title: 'Test', artist: 'Test', year: 2000, spotifyUri: '', spotifyUrl: '' },
      pointsEarned: 1,
      addedAt: Date.now()
    }),
    vetoTokens: 3,
    score: timelineLength
  });

  describe('checkWinner', () => {
    it('should return Team A as winner when A reaches target', () => {
      const teams = {
        A: createTeam(10),
        B: createTeam(5)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(true);
      expect(result.winner).toBe('A');
    });

    it('should return Team B as winner when B reaches target', () => {
      const teams = {
        A: createTeam(7),
        B: createTeam(10)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(true);
      expect(result.winner).toBe('B');
    });

    it('should return no winner when neither team reaches target', () => {
      const teams = {
        A: createTeam(5),
        B: createTeam(7)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(false);
      expect(result.winner).toBeNull();
    });

    it('should handle tie at target (both win simultaneously)', () => {
      const teams = {
        A: createTeam(10),
        B: createTeam(10)
      };

      const result = checker.checkWinner(teams, 10);

      expect(result.hasWinner).toBe(false);
      expect(result.isTie).toBe(true);
    });
  });

  describe('getTeamScore', () => {
    it('should return timeline length as score', () => {
      const team = createTeam(7);
      expect(checker.getTeamScore(team)).toBe(7);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- win-condition`
Expected: FAIL with "Cannot find module '../win-condition'"

**Step 3: Implement**

```typescript
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
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- win-condition`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/win-condition.ts packages/backend/src/__tests__/win-condition.test.ts
git commit -m "feat(backend): add win condition detection with tie handling"
```

---

## Task gameplay-007: Host - Build current round display with song QR code

**Files:**
- Create: `apps/host/src/components/RoundDisplay.tsx`
- Create: `apps/host/src/components/SongQRCode.tsx`
- Test: `apps/host/src/__tests__/RoundDisplay.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/RoundDisplay.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoundDisplay } from '../components/RoundDisplay';
import type { Round } from '@party-popper/shared';

describe('RoundDisplay', () => {
  const mockRound: Round = {
    song: {
      id: 'song-1',
      title: 'Hidden Song',
      artist: 'Hidden Artist',
      year: 1985,
      spotifyUri: 'spotify:track:abc123',
      spotifyUrl: 'https://open.spotify.com/track/abc123'
    },
    activeTeam: 'A',
    phase: 'guessing',
    startedAt: Date.now(),
    timerDuration: 60000,
    currentAnswer: null,
    vetoChallenge: null
  };

  it('should render QR code with Spotify deeplink', () => {
    render(<RoundDisplay round={mockRound} />);

    const qrCode = screen.getByTestId('song-qr-code');
    expect(qrCode).toBeInTheDocument();
  });

  it('should show timer countdown', () => {
    render(<RoundDisplay round={mockRound} />);

    expect(screen.getByTestId('round-timer')).toBeInTheDocument();
  });

  it('should hide song details during guessing phase', () => {
    render(<RoundDisplay round={mockRound} />);

    expect(screen.queryByText('Hidden Song')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden Artist')).not.toBeInTheDocument();
  });

  it('should show song details during reveal phase', () => {
    const revealRound = { ...mockRound, phase: 'reveal' as const };
    render(<RoundDisplay round={revealRound} />);

    expect(screen.getByText('Hidden Song')).toBeInTheDocument();
    expect(screen.getByText('Hidden Artist')).toBeInTheDocument();
    expect(screen.getByText('1985')).toBeInTheDocument();
  });

  it('should display active team name', () => {
    render(<RoundDisplay round={mockRound} teamName="Team Alpha" />);

    expect(screen.getByText(/Team Alpha/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- RoundDisplay`
Expected: FAIL with "Cannot find module '../components/RoundDisplay'"

**Step 3: Implement**

```typescript
// apps/host/src/components/SongQRCode.tsx
import { QRCodeSVG } from 'qrcode.react';

interface SongQRCodeProps {
  spotifyUri: string;
  size?: number;
}

export function SongQRCode({ spotifyUri, size = 200 }: SongQRCodeProps) {
  return (
    <div data-testid="song-qr-code" className="bg-white p-4 rounded-lg inline-block">
      <QRCodeSVG
        value={spotifyUri}
        size={size}
        level="M"
        includeMargin={false}
      />
    </div>
  );
}
```

```typescript
// apps/host/src/components/RoundDisplay.tsx
import { useState, useEffect } from 'react';
import type { Round } from '@party-popper/shared';
import { SongQRCode } from './SongQRCode';

interface RoundDisplayProps {
  round: Round;
  teamName?: string;
}

export function RoundDisplay({ round, teamName = 'Current Team' }: RoundDisplayProps) {
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const elapsed = Date.now() - round.startedAt;
      const remaining = Math.max(0, round.timerDuration - elapsed);
      setRemainingTime(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [round.startedAt, round.timerDuration]);

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const isRevealed = round.phase === 'reveal';

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-2xl font-bold text-white">
        {teamName}'s Turn
      </div>

      <SongQRCode spotifyUri={round.song.spotifyUri} size={250} />

      <div
        data-testid="round-timer"
        className="text-6xl font-mono font-bold text-white"
      >
        {formatTime(remainingTime)}
      </div>

      {isRevealed && (
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold text-white">
            {round.song.title}
          </div>
          <div className="text-2xl text-gray-300">
            {round.song.artist}
          </div>
          <div className="text-xl text-yellow-400">
            {round.song.year}
          </div>
        </div>
      )}

      {!isRevealed && (
        <div className="text-xl text-gray-400">
          Scan to play the song!
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- RoundDisplay`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/RoundDisplay.tsx apps/host/src/components/SongQRCode.tsx apps/host/src/__tests__/RoundDisplay.test.tsx
git commit -m "feat(host): add round display with Spotify QR code and timer"
```

---

## Task gameplay-008: Host - Create answer input area showing team submission

**Files:**
- Create: `apps/host/src/components/AnswerDisplay.tsx`
- Test: `apps/host/src/__tests__/AnswerDisplay.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/AnswerDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerDisplay } from '../components/AnswerDisplay';

describe('AnswerDisplay', () => {
  it('should show current team name prominently', () => {
    render(
      <AnswerDisplay
        teamName="Team Alpha"
        artist=""
        title=""
        year={null}
      />
    );

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Alpha')).toHaveClass('text-3xl');
  });

  it('should display artist field', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist="Queen"
        title=""
        year={null}
      />
    );

    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('Artist')).toBeInTheDocument();
  });

  it('should display title field', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title="Bohemian Rhapsody"
        year={null}
      />
    );

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('should display year field', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title=""
        year={1975}
      />
    );

    expect(screen.getByText('1975')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
  });

  it('should show placeholder when fields are empty', () => {
    render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title=""
        year={null}
      />
    );

    const placeholders = screen.getAllByText('...');
    expect(placeholders.length).toBeGreaterThanOrEqual(3);
  });

  it('should update in real-time', () => {
    const { rerender } = render(
      <AnswerDisplay
        teamName="Team A"
        artist=""
        title=""
        year={null}
      />
    );

    rerender(
      <AnswerDisplay
        teamName="Team A"
        artist="Que"
        title=""
        year={null}
      />
    );

    expect(screen.getByText('Que')).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- AnswerDisplay`
Expected: FAIL with "Cannot find module '../components/AnswerDisplay'"

**Step 3: Implement**

```typescript
// apps/host/src/components/AnswerDisplay.tsx
interface AnswerDisplayProps {
  teamName: string;
  artist: string;
  title: string;
  year: number | null;
}

export function AnswerDisplay({ teamName, artist, title, year }: AnswerDisplayProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl">
      <h2 className="text-3xl font-bold text-white text-center mb-6">
        {teamName}
      </h2>

      <div className="space-y-4">
        <AnswerField label="Artist" value={artist} />
        <AnswerField label="Title" value={title} />
        <AnswerField label="Year" value={year !== null ? String(year) : ''} />
      </div>
    </div>
  );
}

interface AnswerFieldProps {
  label: string;
  value: string;
}

function AnswerField({ label, value }: AnswerFieldProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-400 text-lg w-20">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-lg px-4 py-3 min-h-[48px]">
        <span className="text-2xl text-white font-medium">
          {value || '...'}
        </span>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- AnswerDisplay`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/AnswerDisplay.tsx apps/host/src/__tests__/AnswerDisplay.test.tsx
git commit -m "feat(host): add answer display showing team submission"
```

---

## Task gameplay-009: Host - Implement real-time typing indicators

**Files:**
- Create: `apps/host/src/components/TypingIndicator.tsx`
- Modify: `apps/host/src/components/AnswerDisplay.tsx`
- Test: `apps/host/src/__tests__/TypingIndicator.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/TypingIndicator.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TypingIndicator } from '../components/TypingIndicator';

describe('TypingIndicator', () => {
  it('should animate characters appearing', async () => {
    vi.useFakeTimers();

    render(<TypingIndicator text="Queen" animate={true} />);

    // Initially shows partial text
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    // Full text should eventually appear
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText('Queen')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('should show full text immediately when animate is false', () => {
    render(<TypingIndicator text="Queen" animate={false} />);

    expect(screen.getByText('Queen')).toBeInTheDocument();
  });

  it('should show cursor when typing', () => {
    render(<TypingIndicator text="Que" animate={true} isTyping={true} />);

    expect(screen.getByTestId('typing-cursor')).toBeInTheDocument();
  });

  it('should hide cursor when not typing', () => {
    render(<TypingIndicator text="Queen" animate={false} isTyping={false} />);

    expect(screen.queryByTestId('typing-cursor')).not.toBeInTheDocument();
  });

  it('should apply gameshow effect class', () => {
    render(<TypingIndicator text="Queen" animate={true} />);

    const container = screen.getByTestId('typing-indicator');
    expect(container).toHaveClass('font-mono');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- TypingIndicator`
Expected: FAIL with "Cannot find module '../components/TypingIndicator'"

**Step 3: Implement**

```typescript
// apps/host/src/components/TypingIndicator.tsx
import { useState, useEffect } from 'react';

interface TypingIndicatorProps {
  text: string;
  animate?: boolean;
  isTyping?: boolean;
}

export function TypingIndicator({
  text,
  animate = true,
  isTyping = false
}: TypingIndicatorProps) {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text);
      return;
    }

    // Animate new characters
    if (text.length > displayedText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, 30);
      return () => clearTimeout(timeout);
    } else if (text.length < displayedText.length) {
      setDisplayedText(text);
    }
  }, [text, displayedText, animate]);

  return (
    <span
      data-testid="typing-indicator"
      className="font-mono text-2xl text-white tracking-wide"
    >
      {displayedText || text}
      {isTyping && (
        <span
          data-testid="typing-cursor"
          className="inline-block w-0.5 h-6 bg-yellow-400 ml-1 animate-pulse"
        />
      )}
    </span>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- TypingIndicator`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/TypingIndicator.tsx apps/host/src/__tests__/TypingIndicator.test.tsx
git commit -m "feat(host): add typing indicator with gameshow animation effect"
```

---

## Task gameplay-010: Host - Build timeline visualization

**Files:**
- Create: `apps/host/src/components/TimelineDisplay.tsx`
- Test: `apps/host/src/__tests__/TimelineDisplay.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/TimelineDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineDisplay } from '../components/TimelineDisplay';
import type { TimelineSong } from '@party-popper/shared';

describe('TimelineDisplay', () => {
  const createTimelineSong = (year: number, title: string, artist: string): TimelineSong => ({
    song: {
      id: `song-${year}`,
      title,
      artist,
      year,
      spotifyUri: `spotify:track:${year}`,
      spotifyUrl: `https://open.spotify.com/track/${year}`
    },
    pointsEarned: 2,
    addedAt: Date.now()
  });

  const teamATimeline: TimelineSong[] = [
    createTimelineSong(1975, 'Bohemian Rhapsody', 'Queen'),
    createTimelineSong(1985, 'Take On Me', 'a-ha'),
  ];

  const teamBTimeline: TimelineSong[] = [
    createTimelineSong(1980, 'Another One Bites the Dust', 'Queen'),
  ];

  it('should render two columns for teams', () => {
    render(
      <TimelineDisplay
        teamATimeline={teamATimeline}
        teamBTimeline={teamBTimeline}
        teamAName="Team Alpha"
        teamBName="Team Beta"
      />
    );

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
  });

  it('should display songs in chronological order', () => {
    render(
      <TimelineDisplay
        teamATimeline={teamATimeline}
        teamBTimeline={teamBTimeline}
        teamAName="Team A"
        teamBName="Team B"
      />
    );

    const teamAColumn = screen.getByTestId('timeline-team-a');
    const songs = teamAColumn.querySelectorAll('[data-testid="timeline-song"]');

    expect(songs[0]).toHaveTextContent('1975');
    expect(songs[1]).toHaveTextContent('1985');
  });

  it('should show year, title, and artist for each song', () => {
    render(
      <TimelineDisplay
        teamATimeline={teamATimeline}
        teamBTimeline={teamBTimeline}
        teamAName="Team A"
        teamBName="Team B"
      />
    );

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('1975')).toBeInTheDocument();
  });

  it('should show empty state when timeline is empty', () => {
    render(
      <TimelineDisplay
        teamATimeline={[]}
        teamBTimeline={[]}
        teamAName="Team A"
        teamBName="Team B"
      />
    );

    expect(screen.getAllByText('No songs yet')).toHaveLength(2);
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- TimelineDisplay`
Expected: FAIL with "Cannot find module '../components/TimelineDisplay'"

**Step 3: Implement**

```typescript
// apps/host/src/components/TimelineDisplay.tsx
import type { TimelineSong } from '@party-popper/shared';

interface TimelineDisplayProps {
  teamATimeline: TimelineSong[];
  teamBTimeline: TimelineSong[];
  teamAName: string;
  teamBName: string;
}

export function TimelineDisplay({
  teamATimeline,
  teamBTimeline,
  teamAName,
  teamBName
}: TimelineDisplayProps) {
  return (
    <div className="grid grid-cols-2 gap-8 w-full max-w-6xl">
      <TimelineColumn
        timeline={teamATimeline}
        teamName={teamAName}
        testId="timeline-team-a"
      />
      <TimelineColumn
        timeline={teamBTimeline}
        teamName={teamBName}
        testId="timeline-team-b"
      />
    </div>
  );
}

interface TimelineColumnProps {
  timeline: TimelineSong[];
  teamName: string;
  testId: string;
}

function TimelineColumn({ timeline, teamName, testId }: TimelineColumnProps) {
  return (
    <div data-testid={testId} className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-2xl font-bold text-white mb-4 text-center">
        {teamName}
      </h3>

      {timeline.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No songs yet</p>
      ) : (
        <div className="space-y-3">
          {timeline.map((entry, index) => (
            <div
              key={entry.song.id}
              data-testid="timeline-song"
              className="bg-gray-700 rounded-lg p-3 flex items-center gap-4"
            >
              <span className="text-yellow-400 font-bold text-xl min-w-[60px]">
                {entry.song.year}
              </span>
              <div className="flex-1">
                <div className="text-white font-medium">
                  {entry.song.title}
                </div>
                <div className="text-gray-400 text-sm">
                  {entry.song.artist}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- TimelineDisplay`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/TimelineDisplay.tsx apps/host/src/__tests__/TimelineDisplay.test.tsx
git commit -m "feat(host): add side-by-side timeline visualization"
```

---

## Task gameplay-011: Host - Create round result reveal animation

**Files:**
- Create: `apps/host/src/components/RoundResult.tsx`
- Test: `apps/host/src/__tests__/RoundResult.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/RoundResult.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RoundResult } from '../components/RoundResult';
import type { Song, ValidationResult } from '@party-popper/shared';

describe('RoundResult', () => {
  const mockSong: Song = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  const mockValidation: ValidationResult = {
    artistCorrect: true,
    titleCorrect: true,
    yearScore: 1,
    totalScore: 3
  };

  it('should reveal correct answer dramatically', () => {
    render(
      <RoundResult
        song={mockSong}
        validation={mockValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('1975')).toBeInTheDocument();
  });

  it('should show points awarded with animation', () => {
    render(
      <RoundResult
        song={mockSong}
        validation={mockValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByTestId('points-animation')).toHaveClass('animate-bounce');
  });

  it('should indicate which parts were correct', () => {
    const partialValidation: ValidationResult = {
      artistCorrect: true,
      titleCorrect: false,
      yearScore: 0.5,
      totalScore: 1.5
    };

    render(
      <RoundResult
        song={mockSong}
        validation={partialValidation}
        teamName="Team Alpha"
      />
    );

    const artistBadge = screen.getByTestId('result-artist');
    const titleBadge = screen.getByTestId('result-title');
    const yearBadge = screen.getByTestId('result-year');

    expect(artistBadge).toHaveClass('bg-green-500');
    expect(titleBadge).toHaveClass('bg-red-500');
    expect(yearBadge).toHaveClass('bg-yellow-500');
  });

  it('should show song added message when points scored', () => {
    render(
      <RoundResult
        song={mockSong}
        validation={mockValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText(/added to timeline/i)).toBeInTheDocument();
  });

  it('should show no points message when zero scored', () => {
    const zeroValidation: ValidationResult = {
      artistCorrect: false,
      titleCorrect: false,
      yearScore: 0,
      totalScore: 0
    };

    render(
      <RoundResult
        song={mockSong}
        validation={zeroValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText(/no points/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- RoundResult`
Expected: FAIL with "Cannot find module '../components/RoundResult'"

**Step 3: Implement**

```typescript
// apps/host/src/components/RoundResult.tsx
import type { Song } from '@party-popper/shared';

interface ValidationResult {
  artistCorrect: boolean;
  titleCorrect: boolean;
  yearScore: number;
  totalScore: number;
}

interface RoundResultProps {
  song: Song;
  validation: ValidationResult;
  teamName: string;
}

export function RoundResult({ song, validation, teamName }: RoundResultProps) {
  const { artistCorrect, titleCorrect, yearScore, totalScore } = validation;

  const getYearBadgeColor = () => {
    if (yearScore === 1) return 'bg-green-500';
    if (yearScore === 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 animate-fade-in">
      <h2 className="text-2xl text-gray-300">{teamName}'s Answer</h2>

      <div className="text-center space-y-4">
        <div className="text-5xl font-bold text-white">
          {song.title}
        </div>
        <div className="text-3xl text-gray-300">
          {song.artist}
        </div>
        <div className="text-4xl text-yellow-400 font-bold">
          {song.year}
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        <ResultBadge
          testId="result-artist"
          label="Artist"
          correct={artistCorrect}
        />
        <ResultBadge
          testId="result-title"
          label="Title"
          correct={titleCorrect}
        />
        <div
          data-testid="result-year"
          className={`px-4 py-2 rounded-full text-white font-bold ${getYearBadgeColor()}`}
        >
          Year {yearScore === 1 ? '✓' : yearScore === 0.5 ? '~' : '✗'}
        </div>
      </div>

      <div
        data-testid="points-animation"
        className="text-6xl font-bold text-green-400 animate-bounce"
      >
        +{totalScore}
      </div>

      {totalScore > 0 ? (
        <p className="text-xl text-green-400">Song added to timeline!</p>
      ) : (
        <p className="text-xl text-red-400">No points scored</p>
      )}
    </div>
  );
}

interface ResultBadgeProps {
  testId: string;
  label: string;
  correct: boolean;
}

function ResultBadge({ testId, label, correct }: ResultBadgeProps) {
  return (
    <div
      data-testid={testId}
      className={`px-4 py-2 rounded-full text-white font-bold ${
        correct ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      {label} {correct ? '✓' : '✗'}
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- RoundResult`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/RoundResult.tsx apps/host/src/__tests__/RoundResult.test.tsx
git commit -m "feat(host): add round result reveal with animations"
```

---

## Task gameplay-012: Host - Add score display and turn indicator

**Files:**
- Create: `apps/host/src/components/ScoreBoard.tsx`
- Test: `apps/host/src/__tests__/ScoreBoard.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/__tests__/ScoreBoard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBoard } from '../components/ScoreBoard';

describe('ScoreBoard', () => {
  it('should show score prominently for each team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should highlight active team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    const teamASection = screen.getByTestId('score-team-a');
    expect(teamASection).toHaveClass('ring-4');
  });

  it('should show turn indicator arrow for active team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="B"
        targetScore={10}
      />
    );

    const turnIndicator = screen.getByTestId('turn-indicator-b');
    expect(turnIndicator).toBeInTheDocument();
  });

  it('should show target score', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('should apply glow effect to active team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    const teamASection = screen.getByTestId('score-team-a');
    expect(teamASection).toHaveClass('shadow-glow');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- ScoreBoard`
Expected: FAIL with "Cannot find module '../components/ScoreBoard'"

**Step 3: Implement**

```typescript
// apps/host/src/components/ScoreBoard.tsx
interface ScoreBoardProps {
  teamAScore: number;
  teamBScore: number;
  teamAName: string;
  teamBName: string;
  activeTeam: 'A' | 'B';
  targetScore: number;
}

export function ScoreBoard({
  teamAScore,
  teamBScore,
  teamAName,
  teamBName,
  activeTeam,
  targetScore
}: ScoreBoardProps) {
  return (
    <div className="flex items-center justify-center gap-8">
      <TeamScore
        testId="score-team-a"
        name={teamAName}
        score={teamAScore}
        isActive={activeTeam === 'A'}
        showIndicator={activeTeam === 'A'}
        indicatorTestId="turn-indicator-a"
      />

      <div className="text-center">
        <div className="text-gray-400 text-lg">First to</div>
        <div className="text-4xl font-bold text-white">{targetScore}</div>
      </div>

      <TeamScore
        testId="score-team-b"
        name={teamBName}
        score={teamBScore}
        isActive={activeTeam === 'B'}
        showIndicator={activeTeam === 'B'}
        indicatorTestId="turn-indicator-b"
      />
    </div>
  );
}

interface TeamScoreProps {
  testId: string;
  name: string;
  score: number;
  isActive: boolean;
  showIndicator: boolean;
  indicatorTestId: string;
}

function TeamScore({
  testId,
  name,
  score,
  isActive,
  showIndicator,
  indicatorTestId
}: TeamScoreProps) {
  return (
    <div
      data-testid={testId}
      className={`
        relative bg-gray-800 rounded-xl p-6 min-w-[200px] text-center
        transition-all duration-300
        ${isActive ? 'ring-4 ring-yellow-400 shadow-glow' : ''}
      `}
    >
      {showIndicator && (
        <div
          data-testid={indicatorTestId}
          className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 text-3xl animate-bounce"
        >
          ▼
        </div>
      )}

      <div className="text-xl text-gray-300 mb-2">{name}</div>
      <div className="text-6xl font-bold text-white">{score}</div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- ScoreBoard`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/host/src/components/ScoreBoard.tsx apps/host/src/__tests__/ScoreBoard.test.tsx
git commit -m "feat(host): add score display with turn indicator"
```

---

## Task gameplay-013: Player - Build answer submission form

**Files:**
- Create: `apps/player/src/components/AnswerForm.tsx`
- Test: `apps/player/src/__tests__/AnswerForm.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/AnswerForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerForm } from '../components/AnswerForm';

describe('AnswerForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnTyping = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnTyping.mockClear();
  });

  it('should render artist text input', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    expect(screen.getByLabelText(/artist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist/i)).toHaveAttribute('type', 'text');
  });

  it('should render title text input', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('should render year number input with valid range', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    const yearInput = screen.getByLabelText(/year/i);
    expect(yearInput).toHaveAttribute('type', 'number');
    expect(yearInput).toHaveAttribute('min', '1950');
    expect(yearInput).toHaveAttribute('max', '2030');
  });

  it('should render submit button', () => {
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should call onSubmit with form values', async () => {
    const user = userEvent.setup();
    render(<AnswerForm onSubmit={mockOnSubmit} onTyping={mockOnTyping} />);

    await user.type(screen.getByLabelText(/artist/i), 'Queen');
    await user.type(screen.getByLabelText(/title/i), 'Bohemian Rhapsody');
    await user.type(screen.getByLabelText(/year/i), '1975');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      artist: 'Queen',
      title: 'Bohemian Rhapsody',
      year: 1975
    });
  });

  it('should show loading state when isSubmitting is true', () => {
    render(
      <AnswerForm
        onSubmit={mockOnSubmit}
        onTyping={mockOnTyping}
        isSubmitting={true}
      />
    );

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText(/submitting/i)).toBeInTheDocument();
  });

  it('should disable form when disabled prop is true', () => {
    render(
      <AnswerForm
        onSubmit={mockOnSubmit}
        onTyping={mockOnTyping}
        disabled={true}
      />
    );

    expect(screen.getByLabelText(/artist/i)).toBeDisabled();
    expect(screen.getByLabelText(/title/i)).toBeDisabled();
    expect(screen.getByLabelText(/year/i)).toBeDisabled();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- AnswerForm`
Expected: FAIL with "Cannot find module '../components/AnswerForm'"

**Step 3: Implement**

```typescript
// apps/player/src/components/AnswerForm.tsx
import { useState, FormEvent } from 'react';

interface AnswerFormData {
  artist: string;
  title: string;
  year: number;
}

interface AnswerFormProps {
  onSubmit: (data: AnswerFormData) => void;
  onTyping: (field: string, value: string) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function AnswerForm({
  onSubmit,
  onTyping,
  isSubmitting = false,
  disabled = false
}: AnswerFormProps) {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (artist && title && year) {
      onSubmit({
        artist,
        title,
        year: parseInt(year, 10)
      });
    }
  };

  const handleArtistChange = (value: string) => {
    setArtist(value);
    onTyping('artist', value);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    onTyping('title', value);
  };

  const handleYearChange = (value: string) => {
    setYear(value);
    onTyping('year', value);
  };

  const isDisabled = disabled || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="artist" className="block text-lg font-medium text-white mb-2">
          Artist
        </label>
        <input
          id="artist"
          type="text"
          value={artist}
          onChange={(e) => handleArtistChange(e.target.value)}
          disabled={isDisabled}
          className="w-full px-4 py-3 text-lg rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none disabled:opacity-50"
          placeholder="Enter artist name"
        />
      </div>

      <div>
        <label htmlFor="title" className="block text-lg font-medium text-white mb-2">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={isDisabled}
          className="w-full px-4 py-3 text-lg rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none disabled:opacity-50"
          placeholder="Enter song title"
        />
      </div>

      <div>
        <label htmlFor="year" className="block text-lg font-medium text-white mb-2">
          Year
        </label>
        <input
          id="year"
          type="number"
          min="1950"
          max="2030"
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          disabled={isDisabled}
          className="w-full px-4 py-3 text-lg rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-yellow-400 focus:outline-none disabled:opacity-50"
          placeholder="Enter release year"
        />
      </div>

      <button
        type="submit"
        disabled={isDisabled || !artist || !title || !year}
        className="w-full py-4 text-xl font-bold rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Answer'}
      </button>
    </form>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- AnswerForm`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/AnswerForm.tsx apps/player/src/__tests__/AnswerForm.test.tsx
git commit -m "feat(player): add answer submission form with validation"
```

---

## Task gameplay-014: Player - Implement typing broadcast

**Files:**
- Create: `apps/player/src/hooks/useTypingBroadcast.ts`
- Test: `apps/player/src/__tests__/useTypingBroadcast.test.ts`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/useTypingBroadcast.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingBroadcast } from '../hooks/useTypingBroadcast';

describe('useTypingBroadcast', () => {
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockSendMessage.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send TYPING message on input change', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, true)
    );

    act(() => {
      result.current.broadcastTyping('artist', 'Que');
    });

    vi.advanceTimersByTime(100);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'typing',
      payload: { field: 'artist', value: 'Que' }
    });
  });

  it('should debounce to max 10 messages per second', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, true)
    );

    // Rapid typing
    act(() => {
      result.current.broadcastTyping('artist', 'Q');
      result.current.broadcastTyping('artist', 'Qu');
      result.current.broadcastTyping('artist', 'Que');
      result.current.broadcastTyping('artist', 'Quee');
      result.current.broadcastTyping('artist', 'Queen');
    });

    vi.advanceTimersByTime(100);

    // Should only send one message (debounced)
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'typing',
      payload: { field: 'artist', value: 'Queen' }
    });
  });

  it('should not send when player is not on active team', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, false)
    );

    act(() => {
      result.current.broadcastTyping('artist', 'Queen');
    });

    vi.advanceTimersByTime(100);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should send immediately after debounce period', () => {
    const { result } = renderHook(() =>
      useTypingBroadcast(mockSendMessage, true)
    );

    act(() => {
      result.current.broadcastTyping('artist', 'Q');
    });
    vi.advanceTimersByTime(100);

    act(() => {
      result.current.broadcastTyping('artist', 'Queen');
    });
    vi.advanceTimersByTime(100);

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- useTypingBroadcast`
Expected: FAIL with "Cannot find module '../hooks/useTypingBroadcast'"

**Step 3: Implement**

```typescript
// apps/player/src/hooks/useTypingBroadcast.ts
import { useCallback, useRef } from 'react';

interface TypingMessage {
  type: 'typing';
  payload: {
    field: string;
    value: string;
  };
}

type SendMessageFn = (message: TypingMessage) => void;

export function useTypingBroadcast(
  sendMessage: SendMessageFn,
  isActiveTeam: boolean
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentRef = useRef<number>(0);

  const broadcastTyping = useCallback((field: string, value: string) => {
    if (!isActiveTeam) {
      return;
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const now = Date.now();
    const timeSinceLastSend = now - lastSentRef.current;
    const minInterval = 100; // 10 messages per second max

    if (timeSinceLastSend >= minInterval) {
      // Send immediately
      sendMessage({
        type: 'typing',
        payload: { field, value }
      });
      lastSentRef.current = now;
    } else {
      // Debounce
      timeoutRef.current = setTimeout(() => {
        sendMessage({
          type: 'typing',
          payload: { field, value }
        });
        lastSentRef.current = Date.now();
      }, minInterval - timeSinceLastSend);
    }
  }, [sendMessage, isActiveTeam]);

  return { broadcastTyping };
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- useTypingBroadcast`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/hooks/useTypingBroadcast.ts apps/player/src/__tests__/useTypingBroadcast.test.ts
git commit -m "feat(player): add debounced typing broadcast hook"
```

---

## Task gameplay-015: Player - Add turn awareness

**Files:**
- Create: `apps/player/src/components/TurnStatus.tsx`
- Test: `apps/player/src/__tests__/TurnStatus.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/TurnStatus.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TurnStatus } from '../components/TurnStatus';

describe('TurnStatus', () => {
  it('should show active state when it is teams turn', () => {
    render(<TurnStatus isMyTurn={true} teamName="Team Alpha" />);

    expect(screen.getByText(/your turn/i)).toBeInTheDocument();
    expect(screen.getByTestId('turn-status')).toHaveClass('bg-green-500');
  });

  it('should show waiting state when it is not teams turn', () => {
    render(<TurnStatus isMyTurn={false} teamName="Team Alpha" />);

    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    expect(screen.getByTestId('turn-status')).toHaveClass('bg-gray-600');
  });

  it('should display team name', () => {
    render(<TurnStatus isMyTurn={true} teamName="Team Alpha" />);

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
  });

  it('should have visual distinction between states', () => {
    const { rerender } = render(<TurnStatus isMyTurn={true} teamName="Team A" />);
    const activeElement = screen.getByTestId('turn-status');

    rerender(<TurnStatus isMyTurn={false} teamName="Team A" />);
    const waitingElement = screen.getByTestId('turn-status');

    expect(activeElement.className).not.toBe(waitingElement.className);
  });

  it('should show opponent team name when waiting', () => {
    render(
      <TurnStatus
        isMyTurn={false}
        teamName="Team Alpha"
        opponentTeamName="Team Beta"
      />
    );

    expect(screen.getByText(/Team Beta/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- TurnStatus`
Expected: FAIL with "Cannot find module '../components/TurnStatus'"

**Step 3: Implement**

```typescript
// apps/player/src/components/TurnStatus.tsx
interface TurnStatusProps {
  isMyTurn: boolean;
  teamName: string;
  opponentTeamName?: string;
}

export function TurnStatus({
  isMyTurn,
  teamName,
  opponentTeamName = 'Other team'
}: TurnStatusProps) {
  return (
    <div
      data-testid="turn-status"
      className={`
        w-full py-4 px-6 rounded-lg text-center transition-all duration-300
        ${isMyTurn ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'}
      `}
    >
      <div className="text-lg font-medium">{teamName}</div>

      {isMyTurn ? (
        <div className="text-2xl font-bold mt-1">
          It's Your Turn!
        </div>
      ) : (
        <div className="text-xl mt-1">
          Waiting for {opponentTeamName}...
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- TurnStatus`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/TurnStatus.tsx apps/player/src/__tests__/TurnStatus.test.tsx
git commit -m "feat(player): add turn awareness status component"
```

---

## Task gameplay-016: Player - Create answer confirmation and feedback UI

**Files:**
- Create: `apps/player/src/components/AnswerFeedback.tsx`
- Test: `apps/player/src/__tests__/AnswerFeedback.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/AnswerFeedback.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerFeedback } from '../components/AnswerFeedback';

describe('AnswerFeedback', () => {
  it('should show submission confirmed with checkmark', () => {
    render(
      <AnswerFeedback
        status="submitted"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }}
      />
    );

    expect(screen.getByTestId('checkmark')).toBeInTheDocument();
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
  });

  it('should show result after reveal - correct', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }}
        result={{ correct: true, pointsEarned: 3 }}
      />
    );

    expect(screen.getByText(/correct/i)).toBeInTheDocument();
    expect(screen.getByTestId('feedback-container')).toHaveClass('bg-green-500');
  });

  it('should show result after reveal - incorrect', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Wrong', title: 'Wrong', year: 2000 }}
        result={{ correct: false, pointsEarned: 0 }}
      />
    );

    expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByTestId('feedback-container')).toHaveClass('bg-red-500');
  });

  it('should display points earned', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1976 }}
        result={{ correct: true, pointsEarned: 2.5 }}
      />
    );

    expect(screen.getByText('+2.5')).toBeInTheDocument();
  });

  it('should show submitted answer details', () => {
    render(
      <AnswerFeedback
        status="submitted"
        answer={{ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }}
      />
    );

    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('1975')).toBeInTheDocument();
  });

  it('should show partial points message', () => {
    render(
      <AnswerFeedback
        status="revealed"
        answer={{ artist: 'Queen', title: 'Wrong', year: 1975 }}
        result={{ correct: true, pointsEarned: 2 }}
      />
    );

    expect(screen.getByText(/partial/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- AnswerFeedback`
Expected: FAIL with "Cannot find module '../components/AnswerFeedback'"

**Step 3: Implement**

```typescript
// apps/player/src/components/AnswerFeedback.tsx
interface Answer {
  artist: string;
  title: string;
  year: number;
}

interface Result {
  correct: boolean;
  pointsEarned: number;
}

interface AnswerFeedbackProps {
  status: 'submitted' | 'revealed';
  answer: Answer;
  result?: Result;
}

export function AnswerFeedback({ status, answer, result }: AnswerFeedbackProps) {
  const isRevealed = status === 'revealed';
  const isCorrect = result?.correct ?? false;
  const points = result?.pointsEarned ?? 0;
  const isPartial = isCorrect && points > 0 && points < 3;

  const getBackgroundClass = () => {
    if (!isRevealed) return 'bg-blue-500';
    if (points === 0) return 'bg-red-500';
    return 'bg-green-500';
  };

  return (
    <div
      data-testid="feedback-container"
      className={`
        w-full p-6 rounded-xl text-white text-center
        ${getBackgroundClass()}
      `}
    >
      {!isRevealed ? (
        <>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span data-testid="checkmark" className="text-3xl">✓</span>
            <span className="text-xl font-bold">Answer Submitted!</span>
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold mb-2">
            {points > 0 ? (
              isPartial ? 'Partial Correct!' : 'Correct!'
            ) : (
              'Incorrect'
            )}
          </div>
          <div className="text-4xl font-bold mb-4">
            +{points}
          </div>
        </>
      )}

      <div className="bg-black/20 rounded-lg p-4 mt-4">
        <div className="text-sm opacity-75 mb-1">Your Answer</div>
        <div className="font-medium">{answer.artist}</div>
        <div className="font-medium">{answer.title}</div>
        <div className="font-medium">{answer.year}</div>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- AnswerFeedback`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/AnswerFeedback.tsx apps/player/src/__tests__/AnswerFeedback.test.tsx
git commit -m "feat(player): add answer confirmation and feedback UI"
```

---

## Task gameplay-017: Test full gameplay loop with multiple players

**Files:**
- Create: `packages/backend/src/__tests__/integration/gameplay-loop.test.ts`
- Test: Integration test file

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/integration/gameplay-loop.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Full Gameplay Loop Integration', () => {
  let worker: UnstableDevWorker;

  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterEach(async () => {
    await worker.stop();
  });

  it('should complete a full game: create, join, play rounds, win', async () => {
    // Step 1: Create game
    const createRes = await worker.fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic', targetScore: 2 })
    });
    const { joinCode, wsUrl } = await createRes.json();
    expect(joinCode).toMatch(/^[A-Z0-9]{4}$/);

    // Step 2: Connect host via WebSocket
    const hostWs = new WebSocket(wsUrl);
    await waitForOpen(hostWs);

    const hostMessages: any[] = [];
    hostWs.onmessage = (e) => hostMessages.push(JSON.parse(e.data));

    // Step 3: Join players
    const player1Ws = await connectPlayer(wsUrl, 'Player 1', 'A');
    const player2Ws = await connectPlayer(wsUrl, 'Player 2', 'B');

    // Wait for join confirmations
    await waitForMessage(hostMessages, 'player_joined');
    await waitForMessage(hostMessages, 'player_joined');

    // Step 4: Start game
    hostWs.send(JSON.stringify({ type: 'start_game' }));
    await waitForMessage(hostMessages, 'round_started');

    // Step 5: Team A submits answer
    player1Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }
    }));

    const roundResult1 = await waitForMessage(hostMessages, 'round_result');
    expect(roundResult1.payload.score).toBeGreaterThan(0);

    // Step 6: Next round, Team B's turn
    hostWs.send(JSON.stringify({ type: 'next_round' }));
    await waitForMessage(hostMessages, 'round_started');

    // Step 7: Team B submits answer
    player2Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'a-ha', title: 'Take On Me', year: 1985 }
    }));

    await waitForMessage(hostMessages, 'round_result');

    // Step 8: Continue until someone wins
    hostWs.send(JSON.stringify({ type: 'next_round' }));
    await waitForMessage(hostMessages, 'round_started');

    player1Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Michael Jackson', title: 'Thriller', year: 1982 }
    }));

    // Step 9: Check for game over
    const gameOver = await waitForMessage(hostMessages, 'game_over', 5000);
    expect(gameOver.payload.winner).toBe('A');

    // Cleanup
    hostWs.close();
    player1Ws.close();
    player2Ws.close();
  });

  it('should handle turn rotation correctly', async () => {
    const createRes = await worker.fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic', targetScore: 5 })
    });
    const { wsUrl } = await createRes.json();

    const hostWs = new WebSocket(wsUrl);
    await waitForOpen(hostWs);

    const messages: any[] = [];
    hostWs.onmessage = (e) => messages.push(JSON.parse(e.data));

    const player1Ws = await connectPlayer(wsUrl, 'P1', 'A');
    const player2Ws = await connectPlayer(wsUrl, 'P2', 'B');

    await waitForMessage(messages, 'player_joined');
    await waitForMessage(messages, 'player_joined');

    hostWs.send(JSON.stringify({ type: 'start_game' }));

    const round1 = await waitForMessage(messages, 'round_started');
    expect(round1.payload.activeTeam).toBe('A');

    // Submit and go to next round
    player1Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Test', title: 'Test', year: 2000 }
    }));
    await waitForMessage(messages, 'round_result');

    hostWs.send(JSON.stringify({ type: 'next_round' }));

    const round2 = await waitForMessage(messages, 'round_started');
    expect(round2.payload.activeTeam).toBe('B');

    hostWs.close();
    player1Ws.close();
    player2Ws.close();
  });

  it('should reject answer from wrong team', async () => {
    const createRes = await worker.fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic', targetScore: 5 })
    });
    const { wsUrl } = await createRes.json();

    const hostWs = new WebSocket(wsUrl);
    await waitForOpen(hostWs);

    const messages: any[] = [];
    hostWs.onmessage = (e) => messages.push(JSON.parse(e.data));

    const player1Ws = await connectPlayer(wsUrl, 'P1', 'A');
    const player2Ws = await connectPlayer(wsUrl, 'P2', 'B');

    await waitForMessage(messages, 'player_joined');
    await waitForMessage(messages, 'player_joined');

    hostWs.send(JSON.stringify({ type: 'start_game' }));
    await waitForMessage(messages, 'round_started');

    // Team B tries to submit during Team A's turn
    const player2Messages: any[] = [];
    player2Ws.onmessage = (e) => player2Messages.push(JSON.parse(e.data));

    player2Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Test', title: 'Test', year: 2000 }
    }));

    const error = await waitForMessage(player2Messages, 'error');
    expect(error.payload.code).toBe('NOT_YOUR_TURN');

    hostWs.close();
    player1Ws.close();
    player2Ws.close();
  });
});

// Helper functions
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
    } else {
      ws.onopen = () => resolve();
    }
  });
}

async function connectPlayer(wsUrl: string, name: string, team: 'A' | 'B'): Promise<WebSocket> {
  const ws = new WebSocket(wsUrl);
  await waitForOpen(ws);
  ws.send(JSON.stringify({ type: 'join', payload: { playerName: name, team } }));
  return ws;
}

function waitForMessage(messages: any[], type: string, timeout = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const msg = messages.find(m => m.type === type);
      if (msg) {
        clearInterval(checkInterval);
        resolve(msg);
      }
    }, 50);

    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);
  });
}
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- gameplay-loop`
Expected: FAIL (tests require full backend implementation)

**Step 3: Implement**

This test validates the integration of all gameplay components. The implementation requires:
1. All backend modules from gameplay-001 through gameplay-006 working together
2. WebSocket message routing in the Durable Object
3. Game state management

The test will pass once all backend tasks are complete and integrated.

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter backend test -- gameplay-loop`
Expected: PASS (after all backend integration complete)

**Step 5: Commit**

```bash
git add packages/backend/src/__tests__/integration/gameplay-loop.test.ts
git commit -m "test(backend): add full gameplay loop integration tests"
```

---

## Summary

Phase 5 contains 17 tasks implementing the core gameplay loop:

| Task ID | Description | Agent |
|---------|-------------|-------|
| gameplay-001 | Round state machine | backend-engineer |
| gameplay-002 | Answer validation | backend-engineer |
| gameplay-003 | Scoring system | backend-engineer |
| gameplay-004 | Timeline management | backend-engineer |
| gameplay-005 | Turn rotation | backend-engineer |
| gameplay-006 | Win condition | backend-engineer |
| gameplay-007 | Round display with QR | frontend-engineer |
| gameplay-008 | Answer display | frontend-engineer |
| gameplay-009 | Typing indicators | frontend-engineer |
| gameplay-010 | Timeline visualization | frontend-engineer |
| gameplay-011 | Round result animation | frontend-engineer |
| gameplay-012 | Score display | frontend-engineer |
| gameplay-013 | Answer form | frontend-engineer |
| gameplay-014 | Typing broadcast | frontend-engineer |
| gameplay-015 | Turn awareness | frontend-engineer |
| gameplay-016 | Answer feedback | frontend-engineer |
| gameplay-017 | Integration tests | automation-developer |

All tasks follow TDD methodology with clear acceptance criteria.
