# Quiz + Timeline Gameplay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace free-form text input with multiple-choice quiz followed by timeline placement, with a token-based veto system.

**Architecture:** 6-phase round system (listening → quiz → placement → veto_window → veto_placement → reveal). Quiz answers earn tokens (used for veto). Timeline placement determines if song is added. First team to 10 songs wins.

**Tech Stack:** React (Vite), TypeScript, Cloudflare Durable Objects, WebSockets, TailwindCSS

---

## Phase 1: Update Shared Types

### Task 1.1: Add Quiz Types to shared/types.ts

**Files:**
- Modify: `packages/shared/src/types.ts:73` (after RoundPhase)

**Step 1: Add new types after line 73**

Add after the existing `RoundPhase` type:

```typescript
// New 6-phase round system
export type NewRoundPhase =
  | 'listening'      // QR scan, waiting for song to play
  | 'quiz'           // Multiple choice artist + song
  | 'placement'      // Timeline placement by active team
  | 'veto_window'    // Other team decides to challenge
  | 'veto_placement' // Veto team places their guess
  | 'reveal';        // Show correct answer, update timelines

export interface QuizOptions {
  artists: string[];      // 4 options, 1 correct
  songTitles: string[];   // 4 options, 1 correct
  correctArtistIndex: number;
  correctTitleIndex: number;
}

export interface QuizAnswer {
  selectedArtistIndex: number;
  selectedTitleIndex: number;
  correct: boolean;  // Both must match
}

export interface TimelinePlacement {
  position: number;  // Index where song would be inserted (0 = before first, etc.)
  placedAt: number;  // Timestamp
}

export interface VetoDecision {
  used: boolean;
  decidedAt: number;
}

export interface VetoPlacement {
  position: number;
  placedAt: number;
}
```

**Step 2: Update Round interface**

Modify the `Round` interface (around line 61-71) to support both old and new phases:

```typescript
export interface Round {
  number: number;
  song: Song;
  activeTeam: 'A' | 'B';
  phase: RoundPhase | NewRoundPhase;
  startedAt: number;
  endsAt: number;
  // Old fields (deprecated but kept for compatibility)
  currentAnswer: Answer | null;
  typingState?: TypingState | null;
  vetoChallenge?: VetoChallenge | null;
  // New quiz fields
  quizOptions?: QuizOptions;
  quizAnswer?: QuizAnswer;
  placement?: TimelinePlacement;
  vetoDecision?: VetoDecision;
  vetoPlacement?: VetoPlacement;
}
```

**Step 3: Update Team interface**

Change `vetoTokens` to `tokens` in Team interface (around line 30-36):

```typescript
export interface Team {
  name: string;
  players: Player[];
  timeline: TimelineSong[];
  tokens: number;  // Renamed from vetoTokens - earned from correct quizzes
  score: number;
}
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: Errors about `vetoTokens` usage (expected, will fix in later tasks)

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add quiz and timeline placement types

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Add Quiz Messages to shared/messages.ts

**Files:**
- Modify: `packages/shared/src/messages.ts`

**Step 1: Add new client message types (after line 17)**

Add to `ClientMessageType` union:

```typescript
  | 'submit_quiz'
  | 'submit_placement'
  | 'use_veto'
  | 'pass_veto'
  | 'submit_veto_placement'
```

**Step 2: Add new client message interfaces (after line 110)**

```typescript
export interface SubmitQuizMessage {
  type: 'submit_quiz';
  payload: {
    artistIndex: number;
    titleIndex: number;
  };
}

export interface SubmitPlacementMessage {
  type: 'submit_placement';
  payload: {
    position: number;
  };
}

export interface PassVetoMessage {
  type: 'pass_veto';
}

export interface SubmitVetoPlacementMessage {
  type: 'submit_veto_placement';
  payload: {
    position: number;
  };
}
```

**Step 3: Update ClientMessage union (around line 23-35)**

Add to the union:

```typescript
  | SubmitQuizMessage
  | SubmitPlacementMessage
  | PassVetoMessage
  | SubmitVetoPlacementMessage
```

**Step 4: Add new server message types**

Add to `ServerMessage` union (around line 115-132):

```typescript
  | PhaseChangedMessage
  | QuizResultMessage
  | PlacementSubmittedMessage
  | VetoWindowOpenMessage
  | VetoDecisionMessage
  | NewRoundResultMessage
  | GameWonMessage
```

**Step 5: Add new server message interfaces (after line 263)**

```typescript
export interface PhaseChangedMessage {
  type: 'phase_changed';
  payload: {
    phase: string;
    quizOptions?: QuizOptions;
    endsAt: number;
  };
}

export interface QuizResultMessage {
  type: 'quiz_result';
  payload: {
    correct: boolean;
    earnedToken: boolean;
    correctArtist: string;
    correctTitle: string;
  };
}

export interface PlacementSubmittedMessage {
  type: 'placement_submitted';
  payload: {
    teamId: 'A' | 'B';
    position: number;
    timelineSongCount: number;
  };
}

export interface VetoWindowOpenMessage {
  type: 'veto_window_open';
  payload: {
    vetoTeamId: 'A' | 'B';
    activeTeamPlacement: number;
    tokensAvailable: number;
    endsAt: number;
  };
}

export interface VetoDecisionMessage {
  type: 'veto_decision';
  payload: {
    used: boolean;
    vetoTeamId: 'A' | 'B';
  };
}

export interface NewRoundResultMessage {
  type: 'new_round_result';
  payload: {
    song: Song;
    correctYear: number;
    activeTeamPlacement: number;
    activeTeamCorrect: boolean;
    vetoUsed: boolean;
    vetoTeamPlacement?: number;
    vetoTeamCorrect?: boolean;
    songAddedTo: 'A' | 'B' | null;
    updatedTeams: {
      A: { timeline: TimelineSong[]; tokens: number };
      B: { timeline: TimelineSong[]; tokens: number };
    };
  };
}

export interface GameWonMessage {
  type: 'game_won';
  payload: {
    winner: 'A' | 'B';
    finalTeams: {
      A: { timeline: TimelineSong[]; tokens: number };
      B: { timeline: TimelineSong[]; tokens: number };
    };
  };
}
```

**Step 6: Run TypeScript check**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: Pass (imports may show warnings that will resolve after rebuilding)

**Step 7: Commit**

```bash
git add packages/shared/src/messages.ts
git commit -m "feat(shared): add quiz and timeline WebSocket messages

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Update GameSettings and Constants

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Update GameSettings interface (around line 24-28)**

```typescript
export interface GameSettings {
  targetScore: number;
  quizTimeSeconds: number;      // Was roundTimeSeconds
  placementTimeSeconds: number;
  vetoWindowSeconds: number;
  vetoPlacementSeconds: number;
}
```

**Step 2: Update DEFAULT_SETTINGS (around line 122-127)**

```typescript
export const DEFAULT_SETTINGS: GameSettings = {
  targetScore: 10,
  quizTimeSeconds: 45,
  placementTimeSeconds: 20,
  vetoWindowSeconds: 10,
  vetoPlacementSeconds: 15,
};
```

**Step 3: Update GAME_CONSTANTS (around line 131-137)**

```typescript
export const GAME_CONSTANTS = {
  MAX_PLAYERS_PER_TEAM: 5,
  MIN_PLAYERS_PER_TEAM: 1,
  INITIAL_TOKENS: 0,  // Was INITIAL_VETO_TOKENS: 3
  RECONNECTION_WINDOW_MS: 5 * 60 * 1000,
  JOIN_CODE_LENGTH: 4,
} as const;
```

**Step 4: Rebuild shared package**

Run: `npx tsc --build packages/shared`
Expected: Pass

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): update settings for quiz timeline gameplay

- quizTimeSeconds: 45s
- placementTimeSeconds: 20s
- vetoWindowSeconds: 10s
- vetoPlacementSeconds: 15s
- Teams start with 0 tokens (earned from quiz)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Backend Quiz Logic

### Task 2.1: Create Quiz Option Generator

**Files:**
- Create: `packages/backend/src/quiz-generator.ts`
- Test: `packages/backend/src/__tests__/quiz-generator.test.ts`

**Step 1: Write the failing test**

Create `packages/backend/src/__tests__/quiz-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateQuizOptions } from '../quiz-generator';
import type { Song } from '@party-popper/shared';

describe('generateQuizOptions', () => {
  const correctSong: Song = {
    id: '1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:1',
    spotifyUrl: 'https://open.spotify.com/track/1',
  };

  const songPool: Song[] = [
    correctSong,
    { id: '2', title: 'Hey Jude', artist: 'The Beatles', year: 1968, spotifyUri: 'spotify:track:2', spotifyUrl: 'https://open.spotify.com/track/2' },
    { id: '3', title: 'Thriller', artist: 'Michael Jackson', year: 1982, spotifyUri: 'spotify:track:3', spotifyUrl: 'https://open.spotify.com/track/3' },
    { id: '4', title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, spotifyUri: 'spotify:track:4', spotifyUrl: 'https://open.spotify.com/track/4' },
    { id: '5', title: 'Like a Rolling Stone', artist: 'Bob Dylan', year: 1965, spotifyUri: 'spotify:track:5', spotifyUrl: 'https://open.spotify.com/track/5' },
    { id: '6', title: 'Imagine', artist: 'John Lennon', year: 1971, spotifyUri: 'spotify:track:6', spotifyUrl: 'https://open.spotify.com/track/6' },
    { id: '7', title: 'Stairway to Heaven', artist: 'Led Zeppelin', year: 1971, spotifyUri: 'spotify:track:7', spotifyUrl: 'https://open.spotify.com/track/7' },
  ];

  it('returns 4 artist options including the correct one', () => {
    const result = generateQuizOptions(correctSong, songPool);
    expect(result.artists).toHaveLength(4);
    expect(result.artists).toContain('Queen');
  });

  it('returns 4 song title options including the correct one', () => {
    const result = generateQuizOptions(correctSong, songPool);
    expect(result.songTitles).toHaveLength(4);
    expect(result.songTitles).toContain('Bohemian Rhapsody');
  });

  it('includes correct artist and title indices', () => {
    const result = generateQuizOptions(correctSong, songPool);
    expect(result.artists[result.correctArtistIndex]).toBe('Queen');
    expect(result.songTitles[result.correctTitleIndex]).toBe('Bohemian Rhapsody');
  });

  it('does not duplicate artists or titles', () => {
    const result = generateQuizOptions(correctSong, songPool);
    const uniqueArtists = new Set(result.artists);
    const uniqueTitles = new Set(result.songTitles);
    expect(uniqueArtists.size).toBe(4);
    expect(uniqueTitles.size).toBe(4);
  });

  it('handles small song pool gracefully', () => {
    const smallPool = songPool.slice(0, 3);
    const result = generateQuizOptions(correctSong, smallPool);
    expect(result.artists.length).toBeGreaterThanOrEqual(1);
    expect(result.songTitles.length).toBeGreaterThanOrEqual(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run packages/backend/src/__tests__/quiz-generator.test.ts`
Expected: FAIL with "Cannot find module '../quiz-generator'"

**Step 3: Write minimal implementation**

Create `packages/backend/src/quiz-generator.ts`:

```typescript
import type { Song, QuizOptions } from '@party-popper/shared';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateQuizOptions(correctSong: Song, songPool: Song[]): QuizOptions {
  // Filter out the correct song and get unique artists/titles
  const otherSongs = songPool.filter(s => s.id !== correctSong.id);
  const shuffled = shuffleArray(otherSongs);

  // Get unique artists (excluding correct)
  const uniqueArtists = new Set<string>();
  for (const song of shuffled) {
    if (song.artist !== correctSong.artist) {
      uniqueArtists.add(song.artist);
    }
    if (uniqueArtists.size >= 3) break;
  }

  // Get unique titles (excluding correct)
  const uniqueTitles = new Set<string>();
  for (const song of shuffled) {
    if (song.title !== correctSong.title) {
      uniqueTitles.add(song.title);
    }
    if (uniqueTitles.size >= 3) break;
  }

  // Build options arrays
  const wrongArtists = Array.from(uniqueArtists).slice(0, 3);
  const wrongTitles = Array.from(uniqueTitles).slice(0, 3);

  // Combine with correct answer and shuffle
  const artists = shuffleArray([correctSong.artist, ...wrongArtists]);
  const songTitles = shuffleArray([correctSong.title, ...wrongTitles]);

  // Find correct indices
  const correctArtistIndex = artists.indexOf(correctSong.artist);
  const correctTitleIndex = songTitles.indexOf(correctSong.title);

  return {
    artists,
    songTitles,
    correctArtistIndex,
    correctTitleIndex,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run packages/backend/src/__tests__/quiz-generator.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add packages/backend/src/quiz-generator.ts packages/backend/src/__tests__/quiz-generator.test.ts
git commit -m "feat(backend): add quiz option generator

Generates 4 artist and 4 song title options with
shuffled positions and correct answer indices.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.2: Create Timeline Placement Validator

**Files:**
- Create: `packages/backend/src/placement-validator.ts`
- Test: `packages/backend/src/__tests__/placement-validator.test.ts`

**Step 1: Write the failing test**

Create `packages/backend/src/__tests__/placement-validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validatePlacement, getCorrectPosition } from '../placement-validator';
import type { TimelineSong } from '@party-popper/shared';

describe('validatePlacement', () => {
  const makeTimelineSong = (year: number): TimelineSong => ({
    id: `song-${year}`,
    title: `Song ${year}`,
    artist: 'Artist',
    year,
    spotifyUri: `spotify:track:${year}`,
    spotifyUrl: `https://open.spotify.com/track/${year}`,
    addedAt: Date.now(),
    pointsEarned: 1,
  });

  it('returns true for correct placement in empty timeline', () => {
    const timeline: TimelineSong[] = [];
    const songYear = 1980;
    const position = 0;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns true for correct placement at beginning', () => {
    const timeline = [makeTimelineSong(1980), makeTimelineSong(1990)];
    const songYear = 1970;
    const position = 0;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns true for correct placement in middle', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1990)];
    const songYear = 1980;
    const position = 1;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns true for correct placement at end', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1980)];
    const songYear = 1990;
    const position = 2;
    expect(validatePlacement(timeline, songYear, position)).toBe(true);
  });

  it('returns false for incorrect placement', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1990)];
    const songYear = 1980;
    const position = 0; // Should be 1
    expect(validatePlacement(timeline, songYear, position)).toBe(false);
  });

  it('returns false for placement at wrong end', () => {
    const timeline = [makeTimelineSong(1980)];
    const songYear = 1970;
    const position = 1; // Should be 0
    expect(validatePlacement(timeline, songYear, position)).toBe(false);
  });
});

describe('getCorrectPosition', () => {
  const makeTimelineSong = (year: number): TimelineSong => ({
    id: `song-${year}`,
    title: `Song ${year}`,
    artist: 'Artist',
    year,
    spotifyUri: `spotify:track:${year}`,
    spotifyUrl: `https://open.spotify.com/track/${year}`,
    addedAt: Date.now(),
    pointsEarned: 1,
  });

  it('returns 0 for empty timeline', () => {
    expect(getCorrectPosition([], 1980)).toBe(0);
  });

  it('returns 0 for song before all others', () => {
    const timeline = [makeTimelineSong(1980), makeTimelineSong(1990)];
    expect(getCorrectPosition(timeline, 1970)).toBe(0);
  });

  it('returns middle position for song between others', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1990)];
    expect(getCorrectPosition(timeline, 1980)).toBe(1);
  });

  it('returns end position for song after all others', () => {
    const timeline = [makeTimelineSong(1970), makeTimelineSong(1980)];
    expect(getCorrectPosition(timeline, 1990)).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run packages/backend/src/__tests__/placement-validator.test.ts`
Expected: FAIL with "Cannot find module '../placement-validator'"

**Step 3: Write minimal implementation**

Create `packages/backend/src/placement-validator.ts`:

```typescript
import type { TimelineSong } from '@party-popper/shared';

/**
 * Validates if a song placement is correct.
 * Position 0 means before the first song, position N means after the Nth song.
 */
export function validatePlacement(
  timeline: TimelineSong[],
  songYear: number,
  position: number
): boolean {
  // Empty timeline - any position 0 is correct
  if (timeline.length === 0) {
    return position === 0;
  }

  // Get the years of songs before and after the position
  const yearBefore = position > 0 ? timeline[position - 1].year : -Infinity;
  const yearAfter = position < timeline.length ? timeline[position].year : Infinity;

  // Song year must be >= year before and <= year after
  return songYear >= yearBefore && songYear <= yearAfter;
}

/**
 * Gets the correct position for a song in the timeline.
 * Returns the index where the song should be inserted.
 */
export function getCorrectPosition(timeline: TimelineSong[], songYear: number): number {
  if (timeline.length === 0) {
    return 0;
  }

  // Find first song with year > songYear
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].year > songYear) {
      return i;
    }
  }

  // Song is after all existing songs
  return timeline.length;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run packages/backend/src/__tests__/placement-validator.test.ts`
Expected: PASS (10 tests)

**Step 5: Commit**

```bash
git add packages/backend/src/placement-validator.ts packages/backend/src/__tests__/placement-validator.test.ts
git commit -m "feat(backend): add timeline placement validator

Validates if a song is placed in correct chronological position.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.3: Create Round Phase Manager

**Files:**
- Create: `packages/backend/src/round-phase-manager.ts`
- Test: `packages/backend/src/__tests__/round-phase-manager.test.ts`

**Step 1: Write the failing test**

Create `packages/backend/src/__tests__/round-phase-manager.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RoundPhaseManager, PHASE_DURATIONS } from '../round-phase-manager';
import type { GameSettings } from '@party-popper/shared';

describe('RoundPhaseManager', () => {
  const settings: GameSettings = {
    targetScore: 10,
    quizTimeSeconds: 45,
    placementTimeSeconds: 20,
    vetoWindowSeconds: 10,
    vetoPlacementSeconds: 15,
  };

  describe('getNextPhase', () => {
    it('listening -> quiz', () => {
      expect(RoundPhaseManager.getNextPhase('listening')).toBe('quiz');
    });

    it('quiz -> placement', () => {
      expect(RoundPhaseManager.getNextPhase('quiz')).toBe('placement');
    });

    it('placement -> veto_window', () => {
      expect(RoundPhaseManager.getNextPhase('placement')).toBe('veto_window');
    });

    it('veto_window -> veto_placement when veto used', () => {
      expect(RoundPhaseManager.getNextPhase('veto_window', true)).toBe('veto_placement');
    });

    it('veto_window -> reveal when veto not used', () => {
      expect(RoundPhaseManager.getNextPhase('veto_window', false)).toBe('reveal');
    });

    it('veto_placement -> reveal', () => {
      expect(RoundPhaseManager.getNextPhase('veto_placement')).toBe('reveal');
    });

    it('reveal -> null (end of round)', () => {
      expect(RoundPhaseManager.getNextPhase('reveal')).toBeNull();
    });
  });

  describe('getPhaseDuration', () => {
    it('returns correct quiz duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('quiz', settings)).toBe(45000);
    });

    it('returns correct placement duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('placement', settings)).toBe(20000);
    });

    it('returns correct veto_window duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('veto_window', settings)).toBe(10000);
    });

    it('returns correct veto_placement duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('veto_placement', settings)).toBe(15000);
    });

    it('returns 0 for listening phase', () => {
      expect(RoundPhaseManager.getPhaseDuration('listening', settings)).toBe(0);
    });

    it('returns 0 for reveal phase', () => {
      expect(RoundPhaseManager.getPhaseDuration('reveal', settings)).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run packages/backend/src/__tests__/round-phase-manager.test.ts`
Expected: FAIL with "Cannot find module '../round-phase-manager'"

**Step 3: Write minimal implementation**

Create `packages/backend/src/round-phase-manager.ts`:

```typescript
import type { GameSettings, NewRoundPhase } from '@party-popper/shared';

export const PHASE_DURATIONS = {
  listening: 0,  // No timer - waits for QR scan
  quiz: 'quizTimeSeconds',
  placement: 'placementTimeSeconds',
  veto_window: 'vetoWindowSeconds',
  veto_placement: 'vetoPlacementSeconds',
  reveal: 0,  // No timer - host advances
} as const;

export class RoundPhaseManager {
  /**
   * Get the next phase in the round sequence.
   * @param currentPhase Current phase
   * @param vetoUsed Whether veto was used (only relevant for veto_window)
   * @returns Next phase or null if round is complete
   */
  static getNextPhase(
    currentPhase: NewRoundPhase,
    vetoUsed?: boolean
  ): NewRoundPhase | null {
    switch (currentPhase) {
      case 'listening':
        return 'quiz';
      case 'quiz':
        return 'placement';
      case 'placement':
        return 'veto_window';
      case 'veto_window':
        return vetoUsed ? 'veto_placement' : 'reveal';
      case 'veto_placement':
        return 'reveal';
      case 'reveal':
        return null;
      default:
        return null;
    }
  }

  /**
   * Get the duration of a phase in milliseconds.
   */
  static getPhaseDuration(phase: NewRoundPhase, settings: GameSettings): number {
    switch (phase) {
      case 'quiz':
        return settings.quizTimeSeconds * 1000;
      case 'placement':
        return settings.placementTimeSeconds * 1000;
      case 'veto_window':
        return settings.vetoWindowSeconds * 1000;
      case 'veto_placement':
        return settings.vetoPlacementSeconds * 1000;
      default:
        return 0;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run packages/backend/src/__tests__/round-phase-manager.test.ts`
Expected: PASS (11 tests)

**Step 5: Commit**

```bash
git add packages/backend/src/round-phase-manager.ts packages/backend/src/__tests__/round-phase-manager.test.ts
git commit -m "feat(backend): add round phase manager

Manages 6-phase round transitions:
listening -> quiz -> placement -> veto_window -> reveal

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.4: Update Game.ts - Add Quiz Round Handlers

**Files:**
- Modify: `packages/backend/src/game.ts`

**Step 1: Add imports at top of file**

Add after existing imports (around line 4):

```typescript
import { generateQuizOptions } from './quiz-generator';
import { validatePlacement, getCorrectPosition } from './placement-validator';
import { RoundPhaseManager } from './round-phase-manager';
import type { NewRoundPhase, QuizOptions, TimelineSong } from '@party-popper/shared';
```

**Step 2: Update createEmptyTeam function**

Change `vetoTokens: 3` to `tokens: 0` (around line 29):

```typescript
function createEmptyTeam(name: string): Team {
  return {
    name,
    players: [],
    timeline: [],
    tokens: 0,  // Changed from vetoTokens: 3
    score: 0,
  };
}
```

**Step 3: Add new method startQuizRound**

Add after `startRound` method (around line 364):

```typescript
async startQuizRound(): Promise<{ success: boolean; error?: string }> {
  if (!this.state) {
    return { success: false, error: 'Game not initialized' };
  }

  if (this.state.status !== 'playing') {
    return { success: false, error: 'Game must be in playing state' };
  }

  // Pick next song
  if (this.state.songPool.length === 0) {
    return { success: false, error: 'No more songs available' };
  }

  const song = this.state.songPool.shift()!;
  this.state.playedSongs.push(song);

  // Determine active team (alternate based on round number)
  const roundNumber = this.state.playedSongs.length;
  const activeTeam: 'A' | 'B' = (roundNumber % 2 === 1) ? 'A' : 'B';

  // Generate quiz options
  const quizOptions = generateQuizOptions(song, [...this.state.songPool, ...this.state.playedSongs]);

  const now = Date.now();

  this.state.currentRound = {
    number: roundNumber,
    song,
    activeTeam,
    phase: 'listening' as NewRoundPhase,
    startedAt: now,
    endsAt: now + (365 * 24 * 60 * 60 * 1000), // Far future until QR scanned
    currentAnswer: null,
    quizOptions,
  };

  this.state.lastActivityAt = now;
  await this.persistState();

  return { success: true };
}
```

**Step 4: Add transitionToPhase method**

Add after startQuizRound:

```typescript
async transitionToPhase(phase: NewRoundPhase): Promise<void> {
  if (!this.state || !this.state.currentRound) return;

  const now = Date.now();
  const duration = RoundPhaseManager.getPhaseDuration(phase, this.state.settings);

  this.state.currentRound.phase = phase;
  this.state.currentRound.endsAt = duration > 0 ? now + duration : now + (365 * 24 * 60 * 60 * 1000);

  await this.persistState();

  // Broadcast phase change
  this.broadcast({
    type: 'phase_changed',
    payload: {
      phase,
      quizOptions: phase === 'quiz' ? this.state.currentRound.quizOptions : undefined,
      endsAt: this.state.currentRound.endsAt,
    },
  });
}
```

**Step 5: Add handleSubmitQuiz method**

```typescript
async handleSubmitQuiz(
  artistIndex: number,
  titleIndex: number,
  playerId: string
): Promise<{ success: boolean; correct: boolean; earnedToken: boolean }> {
  if (!this.state || !this.state.currentRound) {
    return { success: false, correct: false, earnedToken: false };
  }

  const round = this.state.currentRound;
  if (round.phase !== 'quiz') {
    return { success: false, correct: false, earnedToken: false };
  }

  const quizOptions = round.quizOptions;
  if (!quizOptions) {
    return { success: false, correct: false, earnedToken: false };
  }

  const artistCorrect = artistIndex === quizOptions.correctArtistIndex;
  const titleCorrect = titleIndex === quizOptions.correctTitleIndex;
  const bothCorrect = artistCorrect && titleCorrect;

  // Store answer
  round.quizAnswer = {
    selectedArtistIndex: artistIndex,
    selectedTitleIndex: titleIndex,
    correct: bothCorrect,
  };

  // Award token if both correct
  if (bothCorrect) {
    this.state.teams[round.activeTeam].tokens += 1;
  }

  await this.persistState();

  // Broadcast result
  this.broadcast({
    type: 'quiz_result',
    payload: {
      correct: bothCorrect,
      earnedToken: bothCorrect,
      correctArtist: quizOptions.artists[quizOptions.correctArtistIndex],
      correctTitle: quizOptions.songTitles[quizOptions.correctTitleIndex],
    },
  });

  // Transition to placement phase
  await this.transitionToPhase('placement');

  return { success: true, correct: bothCorrect, earnedToken: bothCorrect };
}
```

**Step 6: Add handleSubmitPlacement method**

```typescript
async handleSubmitPlacement(position: number, playerId: string): Promise<{ success: boolean }> {
  if (!this.state || !this.state.currentRound) {
    return { success: false };
  }

  const round = this.state.currentRound;
  if (round.phase !== 'placement') {
    return { success: false };
  }

  round.placement = {
    position,
    placedAt: Date.now(),
  };

  await this.persistState();

  // Broadcast placement
  this.broadcast({
    type: 'placement_submitted',
    payload: {
      teamId: round.activeTeam,
      position,
      timelineSongCount: this.state.teams[round.activeTeam].timeline.length,
    },
  });

  // Transition to veto window
  await this.transitionToPhase('veto_window');

  // Broadcast veto window info
  const vetoTeam = round.activeTeam === 'A' ? 'B' : 'A';
  this.broadcast({
    type: 'veto_window_open',
    payload: {
      vetoTeamId: vetoTeam,
      activeTeamPlacement: position,
      tokensAvailable: this.state.teams[vetoTeam].tokens,
      endsAt: this.state.currentRound.endsAt,
    },
  });

  return { success: true };
}
```

**Step 7: Add handleVetoDecision method**

```typescript
async handleVetoDecision(useVeto: boolean, playerId: string): Promise<{ success: boolean }> {
  if (!this.state || !this.state.currentRound) {
    return { success: false };
  }

  const round = this.state.currentRound;
  if (round.phase !== 'veto_window') {
    return { success: false };
  }

  const vetoTeam = round.activeTeam === 'A' ? 'B' : 'A';

  // Check if team has tokens
  if (useVeto && this.state.teams[vetoTeam].tokens < 1) {
    return { success: false };
  }

  round.vetoDecision = {
    used: useVeto,
    decidedAt: Date.now(),
  };

  // Deduct token if used
  if (useVeto) {
    this.state.teams[vetoTeam].tokens -= 1;
  }

  await this.persistState();

  // Broadcast decision
  this.broadcast({
    type: 'veto_decision',
    payload: {
      used: useVeto,
      vetoTeamId: vetoTeam,
    },
  });

  // Transition to next phase
  const nextPhase = RoundPhaseManager.getNextPhase('veto_window', useVeto);
  if (nextPhase) {
    await this.transitionToPhase(nextPhase);
  }

  return { success: true };
}
```

**Step 8: Add handleVetoPlacement method**

```typescript
async handleVetoPlacement(position: number, playerId: string): Promise<{ success: boolean }> {
  if (!this.state || !this.state.currentRound) {
    return { success: false };
  }

  const round = this.state.currentRound;
  if (round.phase !== 'veto_placement') {
    return { success: false };
  }

  // Veto placement must be different from active team's placement
  if (round.placement && position === round.placement.position) {
    return { success: false };
  }

  round.vetoPlacement = {
    position,
    placedAt: Date.now(),
  };

  await this.persistState();

  // Transition to reveal
  await this.transitionToPhase('reveal');

  return { success: true };
}
```

**Step 9: Add resolveRound method**

```typescript
async resolveRound(): Promise<{
  success: boolean;
  songAddedTo: 'A' | 'B' | null;
  gameFinished: boolean;
}> {
  if (!this.state || !this.state.currentRound) {
    return { success: false, songAddedTo: null, gameFinished: false };
  }

  const round = this.state.currentRound;
  const song = round.song;
  const activeTeam = round.activeTeam;
  const vetoTeam = activeTeam === 'A' ? 'B' : 'A';

  let songAddedTo: 'A' | 'B' | null = null;

  // Determine outcome
  const activeTeamTimeline = this.state.teams[activeTeam].timeline;
  const vetoTeamTimeline = this.state.teams[vetoTeam].timeline;

  const activeTeamCorrect = round.placement
    ? validatePlacement(activeTeamTimeline, song.year, round.placement.position)
    : false;

  const vetoUsed = round.vetoDecision?.used ?? false;
  const vetoTeamCorrect = round.vetoPlacement
    ? validatePlacement(vetoTeamTimeline, song.year, round.vetoPlacement.position)
    : false;

  if (vetoUsed) {
    // Veto was used
    if (vetoTeamCorrect) {
      // Veto team gets the song
      songAddedTo = vetoTeam;
      this.addSongToTimeline(vetoTeam, song, round.vetoPlacement!.position);
    }
    // If veto team wrong, song discarded (songAddedTo stays null)
  } else {
    // No veto
    if (activeTeamCorrect) {
      // Active team gets the song
      songAddedTo = activeTeam;
      this.addSongToTimeline(activeTeam, song, round.placement!.position);
    }
    // If active team wrong, song discarded
  }

  // Update score (score = timeline length)
  this.state.teams.A.score = this.state.teams.A.timeline.length;
  this.state.teams.B.score = this.state.teams.B.timeline.length;

  // Check win condition
  const gameFinished =
    this.state.teams.A.score >= this.state.settings.targetScore ||
    this.state.teams.B.score >= this.state.settings.targetScore;

  if (gameFinished) {
    this.state.status = 'finished';
  }

  // Broadcast result
  this.broadcast({
    type: 'new_round_result',
    payload: {
      song,
      correctYear: song.year,
      activeTeamPlacement: round.placement?.position ?? -1,
      activeTeamCorrect,
      vetoUsed,
      vetoTeamPlacement: round.vetoPlacement?.position,
      vetoTeamCorrect: vetoUsed ? vetoTeamCorrect : undefined,
      songAddedTo,
      updatedTeams: {
        A: { timeline: this.state.teams.A.timeline, tokens: this.state.teams.A.tokens },
        B: { timeline: this.state.teams.B.timeline, tokens: this.state.teams.B.tokens },
      },
    },
  });

  if (gameFinished) {
    const winner = this.state.teams.A.score >= this.state.settings.targetScore ? 'A' : 'B';
    this.broadcast({
      type: 'game_won',
      payload: {
        winner,
        finalTeams: {
          A: { timeline: this.state.teams.A.timeline, tokens: this.state.teams.A.tokens },
          B: { timeline: this.state.teams.B.timeline, tokens: this.state.teams.B.tokens },
        },
      },
    });
  }

  this.state.currentRound = null;
  await this.persistState();

  return { success: true, songAddedTo, gameFinished };
}

private addSongToTimeline(team: 'A' | 'B', song: Song, position: number): void {
  if (!this.state) return;

  const timelineSong: TimelineSong = {
    ...song,
    addedAt: Date.now(),
    pointsEarned: 1,
  };

  // Insert at correct position
  this.state.teams[team].timeline.splice(position, 0, timelineSong);

  // Sort by year to ensure correct order
  this.state.teams[team].timeline.sort((a, b) => a.year - b.year);
}
```

**Step 10: Update webSocketMessage handler**

Add new cases in the switch statement (around line 695-808):

```typescript
case 'submit_quiz':
  if (payload && payload.artistIndex !== undefined && payload.titleIndex !== undefined) {
    const sessionId = this.wsToPlayer.get(ws);
    const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
    if (player) {
      await this.handleSubmitQuiz(payload.artistIndex, payload.titleIndex, player.id);
    }
  }
  break;

case 'submit_placement':
  if (payload && payload.position !== undefined) {
    const sessionId = this.wsToPlayer.get(ws);
    const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
    if (player) {
      await this.handleSubmitPlacement(payload.position, player.id);
    }
  }
  break;

case 'use_veto':
  {
    const sessionId = this.wsToPlayer.get(ws);
    const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
    if (player) {
      await this.handleVetoDecision(true, player.id);
    }
  }
  break;

case 'pass_veto':
  {
    const sessionId = this.wsToPlayer.get(ws);
    const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
    if (player) {
      await this.handleVetoDecision(false, player.id);
    }
  }
  break;

case 'submit_veto_placement':
  if (payload && payload.position !== undefined) {
    const sessionId = this.wsToPlayer.get(ws);
    const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
    if (player) {
      await this.handleVetoPlacement(payload.position, player.id);
    }
  }
  break;
```

**Step 11: Update start_game case**

Replace the existing `start_game` case (around line 728-745) to use `startQuizRound`:

```typescript
case 'start_game':
  const transitionResult = await this.transitionTo('playing');
  if (transitionResult.success) {
    // Start first round with quiz system
    const roundResult = await this.startQuizRound();
    if (roundResult.success) {
      // Broadcast game started and new state with first round
      this.broadcast({ type: 'game_started', payload: {} });
      this.broadcast({
        type: 'state_sync',
        payload: { gameState: this.state }
      });
    } else {
      this.sendToWs(ws, { type: 'error', payload: { message: roundResult.error } });
    }
  } else {
    this.sendToWs(ws, { type: 'error', payload: { message: transitionResult.error } });
  }
  break;
```

**Step 12: Update next_round case**

Replace to use quiz system:

```typescript
case 'next_round':
  // If in reveal phase, resolve and start next round
  if (this.state?.currentRound?.phase === 'reveal') {
    const resolveResult = await this.resolveRound();
    if (resolveResult.success && !resolveResult.gameFinished) {
      const nextRoundResult = await this.startQuizRound();
      if (nextRoundResult.success) {
        this.broadcast({
          type: 'state_sync',
          payload: { gameState: this.state }
        });
      }
    }
  } else {
    // Legacy behavior for old rounds
    const completeResult = await this.completeRound();
    if (completeResult.success) {
      if (!completeResult.gameFinished) {
        const nextRoundResult = await this.startQuizRound();
        if (nextRoundResult.success) {
          this.broadcast({
            type: 'state_sync',
            payload: { gameState: this.state }
          });
        }
      }
    }
  }
  break;
```

**Step 13: Update QR scan handler to start quiz phase**

In the `/qr-scan` handler (around line 587-625), add quiz phase transition:

```typescript
// After updating endsAt, transition to quiz phase
if (this.state.currentRound.phase === 'listening') {
  await this.transitionToPhase('quiz');
}
```

**Step 14: Run TypeScript check**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`
Expected: Pass (or minor errors to fix)

**Step 15: Commit**

```bash
git add packages/backend/src/game.ts
git commit -m "feat(backend): add quiz round handlers

- startQuizRound: creates round with quiz options
- handleSubmitQuiz: validates answers, awards tokens
- handleSubmitPlacement: records timeline placement
- handleVetoDecision: processes veto use/pass
- handleVetoPlacement: records veto team placement
- resolveRound: determines winner, updates timelines

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Player Mobile UI

### Task 3.1: Create QuizForm Component

**Files:**
- Create: `apps/player/src/components/QuizForm.tsx`

**Step 1: Create the component**

```typescript
import { useState } from 'react';

interface QuizFormProps {
  artists: string[];
  songTitles: string[];
  onSubmit: (artistIndex: number, titleIndex: number) => void;
  disabled?: boolean;
  timeRemaining?: number;
}

export function QuizForm({
  artists,
  songTitles,
  onSubmit,
  disabled = false,
  timeRemaining,
}: QuizFormProps) {
  const [selectedArtist, setSelectedArtist] = useState<number | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<number | null>(null);

  const canSubmit = selectedArtist !== null && selectedTitle !== null && !disabled;

  const handleSubmit = () => {
    if (selectedArtist !== null && selectedTitle !== null) {
      onSubmit(selectedArtist, selectedTitle);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center">
          <span className="text-4xl font-mono font-bold text-yellow-400">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
      )}

      {/* Artist Selection */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-white text-center">Who sings this?</h3>
        <div className="grid grid-cols-2 gap-3">
          {artists.map((artist, index) => (
            <button
              key={index}
              onClick={() => setSelectedArtist(index)}
              disabled={disabled}
              className={`p-4 rounded-lg text-lg font-medium transition-all ${
                selectedArtist === index
                  ? 'bg-yellow-500 text-black ring-4 ring-yellow-300'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {artist}
            </button>
          ))}
        </div>
      </div>

      {/* Song Title Selection */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-white text-center">What's the song?</h3>
        <div className="grid grid-cols-2 gap-3">
          {songTitles.map((title, index) => (
            <button
              key={index}
              onClick={() => setSelectedTitle(index)}
              disabled={disabled}
              className={`p-4 rounded-lg text-lg font-medium transition-all ${
                selectedTitle === index
                  ? 'bg-yellow-500 text-black ring-4 ring-yellow-300'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-4 text-xl font-bold rounded-lg transition-colors ${
          canSubmit
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        Submit Answer
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/player/src/components/QuizForm.tsx
git commit -m "feat(player): add QuizForm component

4-option multiple choice for artist and song title.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.2: Create TimelinePlacement Component

**Files:**
- Create: `apps/player/src/components/TimelinePlacement.tsx`

**Step 1: Create the component**

```typescript
import type { TimelineSong } from '@party-popper/shared';

interface TimelinePlacementProps {
  timeline: TimelineSong[];
  onSelectPosition: (position: number) => void;
  selectedPosition: number | null;
  disabled?: boolean;
  timeRemaining?: number;
}

export function TimelinePlacement({
  timeline,
  onSelectPosition,
  selectedPosition,
  disabled = false,
  timeRemaining,
}: TimelinePlacementProps) {
  // Create slots: one before each song and one after the last
  const slots = timeline.length + 1;

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center">
          <span className="text-4xl font-mono font-bold text-yellow-400">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
      )}

      <h3 className="text-xl font-bold text-white text-center">
        Place the song on your timeline
      </h3>

      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        {timeline.length === 0 ? (
          /* Empty timeline - single tap area */
          <button
            onClick={() => onSelectPosition(0)}
            disabled={disabled}
            className={`w-full py-8 rounded-lg border-2 border-dashed transition-all ${
              selectedPosition === 0
                ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                : 'border-gray-600 text-gray-400 hover:border-gray-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Tap to place here
          </button>
        ) : (
          /* Timeline with songs */
          <>
            {/* Slot before first song */}
            <PlacementSlot
              position={0}
              isSelected={selectedPosition === 0}
              onSelect={() => onSelectPosition(0)}
              disabled={disabled}
              label="Before all songs"
            />

            {timeline.map((song, index) => (
              <div key={song.id}>
                {/* Song card */}
                <div className="bg-gray-700 rounded-lg p-3 flex items-center gap-4">
                  <span className="text-yellow-400 font-bold text-xl min-w-[60px]">
                    {song.year}
                  </span>
                  <div className="flex-1">
                    <div className="text-white font-medium">{song.title}</div>
                    <div className="text-gray-400 text-sm">{song.artist}</div>
                  </div>
                </div>

                {/* Slot after this song */}
                <PlacementSlot
                  position={index + 1}
                  isSelected={selectedPosition === index + 1}
                  onSelect={() => onSelectPosition(index + 1)}
                  disabled={disabled}
                  label={index === timeline.length - 1 ? 'After all songs' : undefined}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {selectedPosition !== null && (
        <div className="text-center text-green-400 font-medium">
          Position selected - waiting for confirmation...
        </div>
      )}
    </div>
  );
}

interface PlacementSlotProps {
  position: number;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
  label?: string;
}

function PlacementSlot({ position, isSelected, onSelect, disabled, label }: PlacementSlotProps) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full py-3 my-2 rounded-lg border-2 border-dashed transition-all text-sm ${
        isSelected
          ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400 font-medium'
          : 'border-gray-600 text-gray-500 hover:border-gray-500 hover:text-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isSelected ? '✓ Selected' : label || 'Tap to place here'}
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add apps/player/src/components/TimelinePlacement.tsx
git commit -m "feat(player): add TimelinePlacement component

Tap-between-songs interface for timeline placement.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.3: Create VetoDecision Component

**Files:**
- Create: `apps/player/src/components/VetoDecision.tsx`

**Step 1: Create the component**

```typescript
interface VetoDecisionProps {
  tokensAvailable: number;
  opponentPlacement: string; // e.g., "between 1975 and 1982"
  onUseVeto: () => void;
  onPass: () => void;
  disabled?: boolean;
  timeRemaining?: number;
}

export function VetoDecision({
  tokensAvailable,
  opponentPlacement,
  onUseVeto,
  onPass,
  disabled = false,
  timeRemaining,
}: VetoDecisionProps) {
  const canUseVeto = tokensAvailable > 0 && !disabled;

  return (
    <div className="w-full max-w-md space-y-6 text-center">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center">
          <span className="text-4xl font-mono font-bold text-red-400">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
      )}

      <div className="bg-red-900/30 border border-red-500 rounded-xl p-6 space-y-4">
        <h2 className="text-2xl font-bold text-red-400">VETO OPPORTUNITY!</h2>

        <p className="text-white text-lg">
          The other team placed the song {opponentPlacement}
        </p>

        <p className="text-yellow-400 font-medium">
          You have {tokensAvailable} token{tokensAvailable !== 1 ? 's' : ''}
        </p>

        <div className="space-y-3 pt-4">
          <button
            onClick={onUseVeto}
            disabled={!canUseVeto}
            className={`w-full py-4 text-xl font-bold rounded-lg transition-colors ${
              canUseVeto
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Use Veto Token
          </button>

          <button
            onClick={onPass}
            disabled={disabled}
            className="w-full py-4 text-xl font-bold rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          >
            Pass
          </button>
        </div>

        {tokensAvailable === 0 && (
          <p className="text-gray-400 text-sm">
            No tokens available - you must pass
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/player/src/components/VetoDecision.tsx
git commit -m "feat(player): add VetoDecision component

Veto window UI with token display and use/pass buttons.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.4: Update PlayingView with New Phases

**Files:**
- Modify: `apps/player/src/components/PlayingView.tsx`

**Step 1: Update imports**

```typescript
import { useState, useEffect } from 'react';
import type { GameState, NewRoundPhase, QuizOptions } from '@party-popper/shared';
import { Layout } from './Layout';
import { TurnStatus } from './TurnStatus';
import { QuizForm } from './QuizForm';
import { TimelinePlacement } from './TimelinePlacement';
import { VetoDecision } from './VetoDecision';
```

**Step 2: Update props interface**

```typescript
interface PlayingViewProps {
  gameState: GameState;
  playerId: string;
  onSubmitQuiz: (artistIndex: number, titleIndex: number) => void;
  onSubmitPlacement: (position: number) => void;
  onUseVeto: () => void;
  onPassVeto: () => void;
  onSubmitVetoPlacement: (position: number) => void;
  onReady: () => void;
  scanDetected: boolean;
}
```

**Step 3: Replace component body**

```typescript
export function PlayingView({
  gameState,
  playerId,
  onSubmitQuiz,
  onSubmitPlacement,
  onUseVeto,
  onPassVeto,
  onSubmitVetoPlacement,
  onReady,
  scanDetected,
}: PlayingViewProps) {
  const { currentRound, teams } = gameState;
  const [selectedPlacement, setSelectedPlacement] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Find which team the player is on
  const playerTeam = teams.A.players.find(p => p.id === playerId) ? 'A' : 'B';
  const myTeam = teams[playerTeam];
  const otherTeam = playerTeam === 'A' ? teams.B : teams.A;

  // Timer effect
  useEffect(() => {
    if (!currentRound) return;

    const updateTimer = () => {
      const remaining = Math.max(0, currentRound.endsAt - Date.now());
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [currentRound?.endsAt]);

  // Reset placement when phase changes
  useEffect(() => {
    setSelectedPlacement(null);
  }, [currentRound?.phase]);

  if (!currentRound) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Waiting for Round</h1>
            <p className="text-xl text-gray-300">The host will start the next round soon...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const isMyTurn = currentRound.activeTeam === playerTeam;
  const phase = currentRound.phase as NewRoundPhase;
  const isVetoTeam = !isMyTurn;

  const handlePlacementSelect = (position: number) => {
    setSelectedPlacement(position);
    onSubmitPlacement(position);
  };

  const handleVetoPlacementSelect = (position: number) => {
    setSelectedPlacement(position);
    onSubmitVetoPlacement(position);
  };

  // Get placement description for veto window
  const getPlacementDescription = (): string => {
    if (!currentRound.placement) return 'somewhere';
    const pos = currentRound.placement.position;
    const timeline = teams[currentRound.activeTeam].timeline;

    if (timeline.length === 0) return 'on an empty timeline';
    if (pos === 0) return `before ${timeline[0].year}`;
    if (pos >= timeline.length) return `after ${timeline[timeline.length - 1].year}`;
    return `between ${timeline[pos - 1].year} and ${timeline[pos].year}`;
  };

  return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        {/* Turn Status */}
        <TurnStatus
          isMyTurn={isMyTurn}
          teamName={myTeam.name}
          opponentTeamName={otherTeam.name}
        />

        {/* Token Display */}
        <div className="flex gap-4 text-lg">
          <span className="text-yellow-400">Your Tokens: {myTeam.tokens}</span>
        </div>

        {/* Phase-specific content */}
        {phase === 'listening' && isMyTurn && (
          <div className="text-center space-y-4">
            {scanDetected ? (
              <div className="text-xl text-green-400 font-semibold animate-pulse">
                Scan detected! Starting quiz...
              </div>
            ) : (
              <>
                <div className="text-xl text-white">
                  Scan the QR code on the TV to hear the song!
                </div>
                <button
                  onClick={onReady}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-lg transition-colors"
                >
                  Ready! I'm Listening
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'quiz' && isMyTurn && currentRound.quizOptions && (
          <QuizForm
            artists={currentRound.quizOptions.artists}
            songTitles={currentRound.quizOptions.songTitles}
            onSubmit={onSubmitQuiz}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.quizAnswer}
          />
        )}

        {phase === 'placement' && isMyTurn && (
          <TimelinePlacement
            timeline={myTeam.timeline}
            onSelectPosition={handlePlacementSelect}
            selectedPosition={selectedPlacement}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.placement}
          />
        )}

        {phase === 'veto_window' && isVetoTeam && (
          <VetoDecision
            tokensAvailable={myTeam.tokens}
            opponentPlacement={getPlacementDescription()}
            onUseVeto={onUseVeto}
            onPass={onPassVeto}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.vetoDecision}
          />
        )}

        {phase === 'veto_placement' && isVetoTeam && (
          <TimelinePlacement
            timeline={myTeam.timeline}
            onSelectPosition={handleVetoPlacementSelect}
            selectedPosition={selectedPlacement}
            timeRemaining={timeRemaining}
            disabled={!!currentRound.vetoPlacement}
          />
        )}

        {/* Waiting states */}
        {phase === 'listening' && !isMyTurn && (
          <div className="text-xl text-gray-300">{otherTeam.name} is listening...</div>
        )}

        {phase === 'quiz' && !isMyTurn && (
          <div className="text-xl text-gray-300">{otherTeam.name} is answering the quiz...</div>
        )}

        {phase === 'placement' && !isMyTurn && (
          <div className="text-xl text-gray-300">{otherTeam.name} is placing the song...</div>
        )}

        {phase === 'veto_window' && !isVetoTeam && (
          <div className="text-xl text-gray-300">Waiting for veto decision...</div>
        )}

        {phase === 'veto_placement' && !isVetoTeam && (
          <div className="text-xl text-gray-300">Veto team is placing...</div>
        )}

        {phase === 'reveal' && (
          <div className="text-center space-y-4">
            <div className="text-2xl text-white">Round Complete!</div>
            <div className="text-4xl font-bold text-yellow-400">{currentRound.song.title}</div>
            <div className="text-2xl text-gray-300">{currentRound.song.artist}</div>
            <div className="text-xl text-yellow-500">{currentRound.song.year}</div>
          </div>
        )}

        {/* Score Display */}
        <div className="flex gap-8 mt-8">
          <div className="text-center">
            <div className="text-lg text-gray-400">{myTeam.name}</div>
            <div className="text-4xl font-bold text-white">{myTeam.timeline.length}</div>
            <div className="text-sm text-gray-500">songs</div>
          </div>
          <div className="text-2xl text-gray-500">-</div>
          <div className="text-center">
            <div className="text-lg text-gray-400">{otherTeam.name}</div>
            <div className="text-4xl font-bold text-white">{otherTeam.timeline.length}</div>
            <div className="text-sm text-gray-500">songs</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit -p apps/player/tsconfig.json`
Expected: May have errors about App.tsx props - will fix next

**Step 5: Commit**

```bash
git add apps/player/src/components/PlayingView.tsx
git commit -m "feat(player): update PlayingView for quiz timeline phases

Handles all 6 phases: listening, quiz, placement,
veto_window, veto_placement, reveal.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.5: Update Player App.tsx

**Files:**
- Modify: `apps/player/src/App.tsx`

**Step 1: Update PlayingView usage**

Find the PlayingView component usage and update the props to match the new interface. Add new message handlers and callbacks.

This task involves:
1. Adding new WebSocket message handlers for quiz phases
2. Updating the onSubmit callbacks passed to PlayingView
3. Ensuring state is properly updated for new phase messages

The specific changes depend on the current App.tsx structure. Read the file and update accordingly.

**Step 2: Commit**

```bash
git add apps/player/src/App.tsx
git commit -m "feat(player): wire up quiz timeline handlers in App

Connect WebSocket messages to new PlayingView callbacks.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Host TV Display

### Task 4.1: Update RoundDisplay for Quiz Phases

**Files:**
- Modify: `apps/host/src/components/RoundDisplay.tsx`

**Step 1: Add phase-specific displays**

Update RoundDisplay to show different content based on phase:
- `listening`: QR code + "Waiting for scan"
- `quiz`: Timer + "Team X is answering"
- `placement`: Timer + "Team X is placing"
- `veto_window`: Veto countdown + "Team Y: Will you challenge?"
- `veto_placement`: Timer + "Team Y is placing veto"
- `reveal`: Song details + result

**Step 2: Commit**

```bash
git add apps/host/src/components/RoundDisplay.tsx
git commit -m "feat(host): update RoundDisplay for quiz phases

Shows phase-specific UI for all 6 round phases.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4.2: Create VetoWindowDisplay Component

**Files:**
- Create: `apps/host/src/components/VetoWindowDisplay.tsx`

**Step 1: Create the component**

```typescript
interface VetoWindowDisplayProps {
  activeTeamName: string;
  vetoTeamName: string;
  placement: string;
  timeRemaining: number;
}

export function VetoWindowDisplay({
  activeTeamName,
  vetoTeamName,
  placement,
  timeRemaining,
}: VetoWindowDisplayProps) {
  return (
    <div className="bg-red-900/30 border-4 border-red-500 rounded-2xl p-8 text-center space-y-6">
      <h2 className="text-4xl font-bold text-red-400 animate-pulse">
        VETO WINDOW
      </h2>

      <div className="space-y-4">
        <p className="text-2xl text-white">
          {activeTeamName} placed the song {placement}
        </p>

        <p className="text-3xl font-bold text-yellow-400">
          {vetoTeamName}: Will you challenge?
        </p>
      </div>

      <div className="text-6xl font-mono font-bold text-red-400">
        {Math.ceil(timeRemaining / 1000)}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/host/src/components/VetoWindowDisplay.tsx
git commit -m "feat(host): add VetoWindowDisplay component

Dramatic veto countdown UI for TV display.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4.3: Update TimelineDisplay with Token Count

**Files:**
- Modify: `apps/host/src/components/TimelineDisplay.tsx`

**Step 1: Add tokens prop and display**

Update the component to show token count alongside timeline.

**Step 2: Commit**

```bash
git add apps/host/src/components/TimelineDisplay.tsx
git commit -m "feat(host): show token count in TimelineDisplay

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4.4: Update GameplayScreen

**Files:**
- Modify: `apps/host/src/components/GameplayScreen.tsx`

**Step 1: Update to handle new phases**

Integrate new components and handle phase-specific layouts.

**Step 2: Commit**

```bash
git add apps/host/src/components/GameplayScreen.tsx
git commit -m "feat(host): update GameplayScreen for quiz phases

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Integration Testing

### Task 5.1: Test Full Game Flow

**Step 1: Start all services**

```bash
# Terminal 1 - Backend
cd packages/backend && npx wrangler dev

# Terminal 2 - Host
cd apps/host && npm run dev

# Terminal 3 - Player
cd apps/player && npm run dev
```

**Step 2: Manual test checklist**

- [ ] Create game on host
- [ ] Join game on 2 phones (one per team)
- [ ] Start game
- [ ] QR scan starts quiz phase
- [ ] Quiz answers submit correctly
- [ ] Token awarded for correct quiz
- [ ] Timeline placement UI works
- [ ] Veto window appears for other team
- [ ] Veto decision works (use/pass)
- [ ] Veto placement works
- [ ] Reveal shows correct answer
- [ ] Song added to correct timeline (or discarded)
- [ ] Win condition triggers at 10 songs

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete quiz timeline gameplay implementation

- 6-phase round system
- Multiple choice quiz
- Timeline placement
- Token-based veto system
- First to 10 songs wins

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan covers:

1. **Phase 1**: Shared types and messages (3 tasks)
2. **Phase 2**: Backend quiz logic (4 tasks)
3. **Phase 3**: Player mobile UI (5 tasks)
4. **Phase 4**: Host TV display (4 tasks)
5. **Phase 5**: Integration testing (1 task)

Total: ~17 discrete tasks, each with clear file paths, code, and commit messages.
