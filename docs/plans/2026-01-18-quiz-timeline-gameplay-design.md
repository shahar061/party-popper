# Design: Quiz + Timeline Gameplay

**Date:** 2026-01-18
**Status:** Draft

## Overview

Replace the current free-form text input gameplay with a multiple-choice quiz followed by timeline placement. Teams earn tokens from correct quiz answers and spend them on veto challenges. First team to 10 songs on their timeline wins.

## Game Flow

Each round has 6 phases:

1. **Listening** - QR code displayed, host scans to play song via Spotify
2. **Quiz** - Active team sees 4 artist + 4 song title options, selects both
3. **Placement** - Active team places song on their timeline (tap between songs)
4. **Veto Window** - Other team can spend a token to challenge
5. **Veto Placement** - If veto used, veto team places their guess
6. **Reveal** - Correct answer shown, song added to appropriate timeline or discarded

## Scoring & Win Condition

- **Tokens**: Correctly answering BOTH quiz questions (artist AND song) earns 1 token
- **Timeline**: Correct placement adds song to team's timeline
- **Win**: First team to 10 songs on their timeline wins

## Token System

- Teams start with 0 tokens
- Correct quiz (both artist AND song) = +1 token
- Using veto = -1 token
- Tokens enable strategic veto challenges

## Veto Resolution

After active team places the song:
1. Other team has 10 seconds to decide
2. If they have tokens and think placement is wrong, they can challenge
3. Veto team must place the song in a DIFFERENT position
4. **Veto correct**: Song goes to veto team's timeline
5. **Veto wrong**: Song discarded (neither team gets it)
6. **No veto**: Original placement evaluated - correct = added, wrong = discarded

## Player Mobile UI

### Quiz Phase

```
┌─────────────────────────────┐
│     Who sings this?         │
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │ Beatles │ │ Queen   │   │
│  └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐   │
│  │ ABBA    │ │ Bowie   │   │
│  └─────────┘ └─────────┘   │
│                             │
│     What's the song?        │
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │ Song A  │ │ Song B  │   │
│  └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐   │
│  │ Song C  │ │ Song D  │   │
│  └─────────┘ └─────────┘   │
│                             │
│      [ Submit Answer ]      │
└─────────────────────────────┘
```

- Both selections required before Submit enables
- Selected options highlighted
- Timer visible
- Non-active team sees waiting screen

### Timeline Placement

```
┌─────────────────────────────┐
│   Place the song on your    │
│         timeline            │
│                             │
│  ┌─ tap here ─┐             │
│  │            │             │
│  ├────────────┤             │
│  │ 1975       │             │
│  │ Bohemian   │             │
│  ├─ tap here ─┤             │
│  │ 1982       │             │
│  │ Thriller   │             │
│  ├─ tap here ─┤             │
│  │            │             │
│  └────────────┘             │
│                             │
│      Timer: 0:15            │
└─────────────────────────────┘
```

- Previously placed songs show year + name (already revealed)
- Current song identity hidden until reveal
- Tappable gaps between existing songs

### Veto Window (Defending Team)

```
┌─────────────────────────────┐
│   VETO OPPORTUNITY!         │
│                             │
│   Team A placed the song    │
│   between 1975 and 1982     │
│                             │
│   You have 1 token          │
│                             │
│  ┌───────────────────────┐  │
│  │   [ Use Veto Token ]  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      [ Pass ]         │  │
│  └───────────────────────┘  │
│                             │
│      Timer: 0:10            │
└─────────────────────────────┘
```

## Host TV Display

### During Quiz/Placement

```
┌─────────────────────────────────────────────────────────┐
│  Team A: 3 songs  [2 tokens]  │  Team B: 2 songs  [1]  │
├─────────────────────────────────────────────────────────┤
│                    [QR CODE]                            │
│                  Team A's Turn                          │
│                    0:45                                 │
├─────────────────────────────────────────────────────────┤
│   Team A Timeline      │      Team B Timeline          │
│   ┌──────────────┐     │      ┌──────────────┐         │
│   │ 1975 Bohemian│     │      │ 1980 Another │         │
│   │ 1982 Thriller│     │      │ 1985 Take On │         │
│   │ 1991 Smells  │     │      │              │         │
│   └──────────────┘     │      └──────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### During Veto Window

```
┌─────────────────────────────────────────────────────────┐
│                   VETO WINDOW                           │
│                                                         │
│        Team A placed the song between                   │
│           1982 and 1991                                 │
│                                                         │
│        Team B: Will you challenge?                      │
│                    0:10                                 │
└─────────────────────────────────────────────────────────┘
```

### During Reveal

```
┌─────────────────────────────────────────────────────────┐
│                   REVEAL                                │
│                                                         │
│              "Hey Jude" - The Beatles                   │
│                     1968                                │
│                                                         │
│           Team A guessed: 1975-1982  X                  │
│                                                         │
│           Song discarded!                               │
└─────────────────────────────────────────────────────────┘
```

## Data Model

### Round Phases

```typescript
type RoundPhase =
  | 'listening'      // QR scan, waiting for song to play
  | 'quiz'           // Multiple choice artist + song
  | 'placement'      // Timeline placement by active team
  | 'veto_window'    // Other team decides to challenge
  | 'veto_placement' // Veto team places their guess
  | 'reveal';        // Show correct answer, update timelines
```

### Quiz Types

```typescript
interface QuizOptions {
  artists: string[];    // 4 options, 1 correct
  songTitles: string[]; // 4 options, 1 correct
}

interface QuizAnswer {
  selectedArtist: string;
  selectedSongTitle: string;
  correct: boolean;  // Both must match
}
```

### Timeline Placement

```typescript
interface TimelinePlacement {
  position: number;  // Index where song would be inserted
  teamId: 'A' | 'B';
}
```

### Updated Team

```typescript
interface Team {
  name: string;
  players: Player[];
  timeline: TimelineSong[];  // Sorted by year
  tokens: number;            // Earned from correct quizzes
}
```

## WebSocket Messages

### Client → Server

```typescript
{ type: 'submit_quiz', payload: { artist: string, songTitle: string } }
{ type: 'submit_placement', payload: { position: number } }
{ type: 'use_veto' }
{ type: 'pass_veto' }
{ type: 'submit_veto_placement', payload: { position: number } }
```

### Server → Client

```typescript
{ type: 'phase_changed', payload: { phase: RoundPhase, quizOptions?: QuizOptions } }
{ type: 'quiz_result', payload: { correct: boolean, earnedToken: boolean } }
{ type: 'placement_submitted', payload: { teamId: string, position: number } }
{ type: 'veto_initiated', payload: { teamId: string } }
{ type: 'round_result', payload: {
    song: Song,
    correctPosition: number,
    activeTeamCorrect: boolean,
    vetoTeamCorrect?: boolean,
    songAddedTo: 'A' | 'B' | null
  }
}
{ type: 'game_won', payload: { winner: 'A' | 'B' } }
```

## Timers

| Phase | Duration |
|-------|----------|
| Quiz | 45 seconds |
| Placement | 20 seconds |
| Veto Window | 10 seconds |
| Veto Placement | 15 seconds |

## Quiz Option Generation

Generate plausible wrong answers from the song pool:

```typescript
function generateQuizOptions(correctSong: Song, songPool: Song[]): QuizOptions {
  const otherSongs = songPool.filter(s => s.id !== correctSong.id);
  const shuffled = shuffle(otherSongs);

  const wrongArtists = shuffled.slice(0, 3).map(s => s.artist);
  const wrongTitles = shuffled.slice(3, 6).map(s => s.title);

  return {
    artists: shuffle([correctSong.artist, ...wrongArtists]),
    songTitles: shuffle([correctSong.title, ...wrongTitles])
  };
}
```

## Implementation Notes

### Changes from Current Implementation

1. Replace `AnswerForm` (free text) with `QuizForm` (multiple choice)
2. Add `TimelinePlacement` component for tap-to-place UI
3. Update round phases from `guessing | reveal | waiting` to new 6-phase model
4. Change `vetoTokens` to `tokens` (earned, not starting amount)
5. Add quiz option generation to backend
6. Update host display for new phases

### Edge Cases

- **Empty timeline**: First song always placed correctly (no wrong position possible)
- **Quiz timeout**: No answer = wrong, no token earned, still proceed to placement
- **Placement timeout**: Random placement chosen, or song discarded
- **Veto timeout**: Treated as "Pass"
- **Both teams at 9 songs**: If veto steals winning song, veto team wins
