# Design: Minimal Playable Gameplay Loop

**Date:** 2026-01-17
**Status:** Approved
**Approach:** Thin vertical slice - build minimal end-to-end flow, iterate later

## Overview

Implement the core gameplay loop to make Party Popper playable. This design covers the minimal viable flow: start round → show song → submit answer → score → next round → win condition.

**Design Decisions:**
- Manual round progression (host clicks "Next Round" button)
- Binary scoring (all fields correct = 1 point, otherwise 0 points)
- Simple exact-match validation (case-insensitive)
- Skip advanced features for v1 (veto, tiebreaker, fuzzy matching, timeline sorting)

## Game Flow

```
Game starts → Round 1 begins (Team A's turn)
→ Team A submits answer
→ Host sees result, clicks "Next Round"
→ Round 2 begins (Team B's turn)
→ Repeat until target score reached
→ Victory screen
```

## State Structure

### Round Phases

Each round has three states:
1. **`guessing`** - Song displayed, active team can submit
2. **`reveal`** - Correct answer shown, score displayed
3. **`waiting`** - Host must click "Next Round" to continue

### Data Models

```typescript
interface Round {
  song: Song;                    // Current song being played
  activeTeam: 'A' | 'B';         // Whose turn it is
  phase: 'guessing' | 'reveal' | 'waiting';
  startedAt: number;             // Timestamp when round started
  endsAt: number;                // startedAt + timer duration (60s)
  currentAnswer: Answer | null;  // Submitted answer (if any)
  result: RoundResult | null;    // Scoring result (if answer submitted)
}

interface Answer {
  artist: string;
  title: string;
  year: number;
  submittedBy: string;           // Player ID who submitted
}

interface RoundResult {
  correct: boolean;              // Binary: all fields match
  earnedPoints: number;          // 0 or 1
}
```

## WebSocket Messages

### Backend → Clients

```typescript
{ type: 'round_started', payload: { round: Round } }
{ type: 'answer_submitted', payload: { answer: Answer, teamId: 'A'|'B' } }
{ type: 'round_result', payload: { result: RoundResult, teamId: 'A'|'B' } }
{ type: 'game_won', payload: { winner: 'A'|'B', finalScore: { A: number, B: number } } }
```

### Clients → Backend

```typescript
{ type: 'submit_answer', payload: { artist: string, title: string, year: number } }
{ type: 'next_round' }  // Host only
```

## Backend Implementation

### 1. Modify `start_game` Handler

After transitioning to 'playing' status:
- Immediately call `startRound()` to begin first round
- First round is always Team A's turn

### 2. Add `startRound()` Method

```typescript
async startRound(): Promise<void> {
  // Get next song from pool
  const song = await this.getNextSong();
  if (!song) {
    // No songs left - end game as draw
    return this.endGameDraw();
  }

  // Determine active team (alternates each round)
  const activeTeam = this.getNextActiveTeam();

  // Create round
  const round: Round = {
    song,
    activeTeam,
    phase: 'guessing',
    startedAt: Date.now(),
    endsAt: Date.now() + 60000,  // 60 seconds
    currentAnswer: null,
    result: null,
  };

  this.state.currentRound = round;
  await this.persistState();

  // Broadcast to all clients
  this.broadcast({ type: 'round_started', payload: { round } });
}
```

### 3. Add `submit_answer` Handler

```typescript
case 'submit_answer':
  // Validate it's the active team's turn
  const round = this.state.currentRound;
  if (!round || round.phase !== 'guessing') {
    return this.sendToWs(ws, { type: 'error', payload: { message: 'Not in guessing phase' } });
  }

  // Find player and validate they're on active team
  const player = this.findPlayerBySession(sessionId);
  if (!player || player.team !== round.activeTeam) {
    return this.sendToWs(ws, { type: 'error', payload: { message: 'Not your turn' } });
  }

  // Store answer
  const answer: Answer = {
    artist: payload.artist,
    title: payload.title,
    year: payload.year,
    submittedBy: player.id,
  };
  round.currentAnswer = answer;

  // Broadcast answer submitted
  this.broadcast({ type: 'answer_submitted', payload: { answer, teamId: round.activeTeam } });

  // Validate answer (case-insensitive exact match)
  const correct =
    answer.artist.toLowerCase() === round.song.artist.toLowerCase() &&
    answer.title.toLowerCase() === round.song.title.toLowerCase() &&
    answer.year === round.song.year;

  // Store result
  round.result = {
    correct,
    earnedPoints: correct ? 1 : 0,
  };

  // Transition to reveal phase
  round.phase = 'reveal';
  await this.persistState();

  // Broadcast result
  this.broadcast({ type: 'round_result', payload: { result: round.result, teamId: round.activeTeam } });

  // Auto-transition to waiting after 3 seconds
  setTimeout(() => {
    if (this.state.currentRound === round) {
      round.phase = 'waiting';
      this.persistState();
      this.broadcast({ type: 'state_sync', payload: { gameState: this.state } });
    }
  }, 3000);
  break;
```

### 4. Add `next_round` Handler (Host Only)

```typescript
case 'next_round':
  // Validate sender is host (check via tags or special flag)
  const isHost = this.ctx.getTags(ws).includes('host');
  if (!isHost) {
    return this.sendToWs(ws, { type: 'error', payload: { message: 'Only host can advance rounds' } });
  }

  const currentRound = this.state.currentRound;
  if (!currentRound || currentRound.phase !== 'waiting') {
    return this.sendToWs(ws, { type: 'error', payload: { message: 'Not in waiting phase' } });
  }

  // If answer was correct, add song to timeline
  if (currentRound.result?.correct) {
    const team = this.state.teams[currentRound.activeTeam];
    team.timeline.push({
      song: currentRound.song,
      earnedPoints: 1,
    });
    team.score += 1;
  }

  // Check win condition
  const targetScore = this.state.settings.targetScore || 10;
  const winningTeam = this.state.teams.A.score >= targetScore ? 'A' :
                       this.state.teams.B.score >= targetScore ? 'B' : null;

  if (winningTeam) {
    // Game won!
    await this.transitionTo('finished');
    this.broadcast({
      type: 'game_won',
      payload: {
        winner: winningTeam,
        finalScore: {
          A: this.state.teams.A.score,
          B: this.state.teams.B.score,
        },
      },
    });
  } else {
    // Start next round
    await this.startRound();
  }
  break;
```

## Host UI (Playing Screen)

**Layout:**
```
┌─────────────────────────────────────┐
│  Team A: 3  |  Team B: 2            │  ← ScoreBoard
├─────────────────────────────────────┤
│         [QR Code]                   │  ← RoundDisplay
│       Team A's Turn                 │
│         Timer: 0:45                 │
├─────────────────────────────────────┤
│  Answer: The Beatles - Hey Jude...  │  ← AnswerDisplay (typing)
├─────────────────────────────────────┤
│  Team A Timeline | Team B Timeline  │  ← TimelineDisplay
│  1968: Hey Jude  | 1975: Bohemian.. │
├─────────────────────────────────────┤
│         [Next Round Button]         │  ← Shown in 'waiting' phase
└─────────────────────────────────────┘
```

**Components Used:**
- `ScoreBoard` - Shows current scores
- `RoundDisplay` - QR code, timer, team turn indicator
- `AnswerDisplay` - Shows submitted answer
- `TimelineDisplay` - Both teams' timelines
- Button to trigger `next_round` message

**Message Handlers:**
```typescript
case 'round_started':
  syncState(message.payload.round);
  break;

case 'answer_submitted':
  // Update UI to show answer
  break;

case 'round_result':
  // Show result (correct/incorrect)
  break;

case 'game_won':
  // Transition to victory screen
  break;
```

## Player UI (Playing Screen)

**Conditional Display:**
- **If your team's turn:**
  - Show `AnswerForm` (artist/title/year inputs + submit button)
- **If opponent's turn:**
  - Show "Team B is guessing..." message
  - Disable inputs
- **After submit:**
  - Show `AnswerFeedback` (correct/incorrect)

**Message Handlers:**
```typescript
case 'round_started':
  // Reset form, show inputs if your turn
  setCurrentRound(message.payload.round);
  break;

case 'round_result':
  // Show feedback
  setResult(message.payload.result);
  break;
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No songs left in pool | End game as draw (rare with 100 songs) |
| Timeout without answer | Auto-fail, go to 'waiting' phase |
| Multiple submits in same round | Only accept first answer per round |
| Host disconnects | Game pauses (can resume on reconnect) |
| Player on active team disconnects | Round continues (teammates can still answer) |

## What's Intentionally Skipped (v1)

To keep the initial implementation simple, these features are deferred:

- ✗ Veto token system
- ✗ Tiebreaker rounds
- ✗ Real-time typing indicators
- ✗ Timeline chronological sorting/insertion
- ✗ Fuzzy text matching (artist/title)
- ✗ Year tolerance (±1 year)
- ✗ Partial credit scoring

These will be added in subsequent iterations once the core loop is validated.

## Implementation Checklist

**Backend:**
- [ ] Update Round interface in shared types
- [ ] Add `startRound()` method to Game class
- [ ] Modify `start_game` handler to call `startRound()`
- [ ] Add `submit_answer` message handler
- [ ] Add `next_round` message handler
- [ ] Add helper method for team alternation

**Host Frontend:**
- [ ] Create `GameplayScreen` component
- [ ] Wire up `RoundDisplay`, `ScoreBoard`, `TimelineDisplay`, `AnswerDisplay`
- [ ] Add "Next Round" button (visible in 'waiting' phase)
- [ ] Add message handlers: `round_started`, `answer_submitted`, `round_result`, `game_won`
- [ ] Replace placeholder screen in App.tsx with GameplayScreen

**Player Frontend:**
- [ ] Create playing screen conditional logic
- [ ] Integrate `AnswerForm` component
- [ ] Add turn detection (show form only on your turn)
- [ ] Integrate `AnswerFeedback` component
- [ ] Add message handlers: `round_started`, `round_result`
- [ ] Replace placeholder screen in App.tsx with gameplay UI

## Success Criteria

A complete game can be played:
1. Host starts game → Round 1 begins with Team A
2. Team A players submit answer → Result shown
3. Host clicks "Next Round" → Team B's turn
4. Continue until one team reaches target score (default: 10)
5. Victory screen displays winner

**Testing Scenarios:**
- Correct answer → team scores, timeline updated
- Wrong answer → team doesn't score, no timeline change
- Alternating teams → Team A, Team B, Team A, Team B...
- Win condition → Game ends when score >= 10
- Multiple players on same team → any can submit first
