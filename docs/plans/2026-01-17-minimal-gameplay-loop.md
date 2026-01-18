# Minimal Gameplay Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the core gameplay loop - start round, submit answer, score, advance rounds, detect win condition.

**Architecture:** Thin vertical slice approach. Backend handles round state machine, answer validation, and scoring. Frontend wires existing UI components to WebSocket events. Manual round progression with host "Next Round" button.

**Tech Stack:** TypeScript, Cloudflare Workers/Durable Objects, React 18, WebSockets

**Design Reference:** `docs/plans/2026-01-17-minimal-gameplay-loop-design.md`

---

## Task 1: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add Round-related types**

Add these interfaces to `types.ts`:

```typescript
export type RoundPhase = 'guessing' | 'reveal' | 'waiting';

export interface Answer {
  artist: string;
  title: string;
  year: number;
  submittedBy: string;  // Player ID
  submittedAt: number;
}

export interface RoundResult {
  correct: boolean;
  earnedPoints: number;  // 0 or 1 for binary scoring
}

export interface Round {
  song: Song;
  activeTeam: 'A' | 'B';
  phase: RoundPhase;
  startedAt: number;
  endsAt: number;
  currentAnswer: Answer | null;
  result: RoundResult | null;
}

export interface TimelineSong {
  song: Song;
  earnedPoints: number;
}
```

**Step 2: Update Team interface**

Modify the `Team` interface to include timeline as array of TimelineSong:

```typescript
export interface Team {
  name: string;
  players: Player[];
  timeline: TimelineSong[];  // Add this
  vetoTokens: number;
  score: number;
}
```

**Step 3: Add new WebSocket message types**

```typescript
// Server -> Client messages
export interface RoundStartedMessage {
  type: 'round_started';
  payload: {
    round: Round;
  };
}

export interface AnswerSubmittedMessage {
  type: 'answer_submitted';
  payload: {
    answer: Answer;
    teamId: 'A' | 'B';
  };
}

export interface RoundResultMessage {
  type: 'round_result';
  payload: {
    result: RoundResult;
    teamId: 'A' | 'B';
  };
}

export interface GameWonMessage {
  type: 'game_won';
  payload: {
    winner: 'A' | 'B';
    finalScore: {
      A: number;
      B: number;
    };
  };
}

// Client -> Server messages
export interface SubmitAnswerMessage {
  type: 'submit_answer';
  payload: {
    artist: string;
    title: string;
    year: number;
  };
}

export interface NextRoundMessage {
  type: 'next_round';
}

// Update ServerMessage union type
export type ServerMessage =
  | StateSyncMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | TeamChangedMessage
  | SettingsUpdatedMessage
  | RoundStartedMessage
  | AnswerSubmittedMessage
  | RoundResultMessage
  | GameWonMessage
  | ErrorMessage;
```

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(types): add Round, Answer, RoundResult and gameplay message types"
```

---

## Task 2: Backend - Add Round Management Methods

**Files:**
- Modify: `packages/backend/src/game.ts`

**Step 1: Add startRound method**

Add this method to the `Game` class (after the `getNextSong` method):

```typescript
async startRound(): Promise<void> {
  if (!this.state) {
    throw new Error('Game not initialized');
  }

  // Get next song from pool
  const song = await this.getNextSong();
  if (!song) {
    // No songs left - could end as draw, but with 100 songs this is unlikely
    console.warn('No songs left in pool');
    return;
  }

  // Determine active team (alternates each round)
  const activeTeam = this.getNextActiveTeam();

  // Create round
  const round: Round = {
    song,
    activeTeam,
    phase: 'guessing',
    startedAt: Date.now(),
    endsAt: Date.now() + (this.state.settings.roundDuration || 60000),
    currentAnswer: null,
    result: null,
  };

  this.state.currentRound = round;
  await this.persistState();

  // Broadcast to all clients
  this.broadcast({
    type: 'round_started',
    payload: { round }
  });
}

private getNextActiveTeam(): 'A' | 'B' {
  if (!this.state || !this.state.currentRound) {
    // First round, Team A starts
    return 'A';
  }

  // Alternate teams
  return this.state.currentRound.activeTeam === 'A' ? 'B' : 'A';
}
```

**Step 2: Add validateAnswer method**

```typescript
private validateAnswer(answer: Answer, song: Song): RoundResult {
  const correct =
    answer.artist.toLowerCase().trim() === song.artist.toLowerCase().trim() &&
    answer.title.toLowerCase().trim() === song.title.toLowerCase().trim() &&
    answer.year === song.year;

  return {
    correct,
    earnedPoints: correct ? 1 : 0,
  };
}
```

**Step 3: Commit**

```bash
git add packages/backend/src/game.ts
git commit -m "feat(backend): add startRound and validateAnswer methods"
```

---

## Task 3: Backend - Add WebSocket Message Handlers

**Files:**
- Modify: `packages/backend/src/game.ts:webSocketMessage`

**Step 1: Modify start_game handler to start first round**

Find the `start_game` case in `webSocketMessage` and add `startRound()` call:

```typescript
case 'start_game':
  const transitionResult = await this.transitionTo('playing');
  if (transitionResult.success) {
    // Broadcast that game started
    this.broadcast({ type: 'game_started', payload: {} });

    // Also broadcast updated state so all clients get the new status
    this.broadcast({
      type: 'state_sync',
      payload: { gameState: this.state }
    });

    // Start the first round
    await this.startRound();
  } else {
    this.sendToWs(ws, { type: 'error', payload: { message: transitionResult.error } });
  }
  break;
```

**Step 2: Add submit_answer handler**

Add this case to the switch statement:

```typescript
case 'submit_answer': {
  if (!this.state || !this.state.currentRound) {
    this.sendToWs(ws, { type: 'error', payload: { message: 'No active round' } });
    break;
  }

  const round = this.state.currentRound;

  // Validate phase
  if (round.phase !== 'guessing') {
    this.sendToWs(ws, { type: 'error', payload: { message: 'Not in guessing phase' } });
    break;
  }

  // Check if answer already submitted
  if (round.currentAnswer) {
    this.sendToWs(ws, { type: 'error', payload: { message: 'Answer already submitted' } });
    break;
  }

  // Find player and validate they're on active team
  const sessionId = this.wsToPlayer.get(ws);
  if (!sessionId) {
    this.sendToWs(ws, { type: 'error', payload: { message: 'Session not found' } });
    break;
  }

  const player = this.findPlayerBySession(sessionId);
  if (!player || player.team !== round.activeTeam) {
    this.sendToWs(ws, { type: 'error', payload: { message: 'Not your turn' } });
    break;
  }

  // Store answer
  const answer: Answer = {
    artist: payload.artist,
    title: payload.title,
    year: payload.year,
    submittedBy: player.id,
    submittedAt: Date.now(),
  };
  round.currentAnswer = answer;

  // Broadcast answer submitted
  this.broadcast({
    type: 'answer_submitted',
    payload: { answer, teamId: round.activeTeam }
  });

  // Validate answer
  const result = this.validateAnswer(answer, round.song);
  round.result = result;

  // Transition to reveal phase
  round.phase = 'reveal';
  await this.persistState();

  // Broadcast result
  this.broadcast({
    type: 'round_result',
    payload: { result, teamId: round.activeTeam }
  });

  // Auto-transition to waiting after 3 seconds
  setTimeout(async () => {
    if (this.state && this.state.currentRound === round && round.phase === 'reveal') {
      round.phase = 'waiting';
      await this.persistState();
      this.broadcast({
        type: 'state_sync',
        payload: { gameState: this.state }
      });
    }
  }, 3000);
  break;
}
```

**Step 3: Add next_round handler**

```typescript
case 'next_round': {
  // Validate sender is host
  const tags = this.ctx.getTags(ws);
  const isHost = tags.includes('host');
  if (!isHost) {
    this.sendToWs(ws, { type: 'error', payload: { message: 'Only host can advance rounds' } });
    break;
  }

  if (!this.state || !this.state.currentRound) {
    this.sendToWs(ws, { type: 'error', payload: { message: 'No active round' } });
    break;
  }

  const currentRound = this.state.currentRound;

  // Validate phase
  if (currentRound.phase !== 'waiting') {
    this.sendToWs(ws, { type: 'error', payload: { message: 'Not in waiting phase' } });
    break;
  }

  // If answer was correct, add song to timeline and increment score
  if (currentRound.result?.correct) {
    const team = this.state.teams[currentRound.activeTeam];
    team.timeline.push({
      song: currentRound.song,
      earnedPoints: 1,
    });
    team.score += 1;
    await this.persistState();
  }

  // Check win condition
  const targetScore = this.state.settings.targetScore || 10;
  const teamAScore = this.state.teams.A.score;
  const teamBScore = this.state.teams.B.score;

  if (teamAScore >= targetScore || teamBScore >= targetScore) {
    // Game won!
    const winner = teamAScore >= targetScore ? 'A' : 'B';
    await this.transitionTo('finished');

    this.broadcast({
      type: 'game_won',
      payload: {
        winner,
        finalScore: {
          A: teamAScore,
          B: teamBScore,
        },
      },
    });
  } else {
    // Start next round
    await this.startRound();
  }
  break;
}
```

**Step 4: Commit**

```bash
git add packages/backend/src/game.ts
git commit -m "feat(backend): add submit_answer and next_round message handlers"
```

---

## Task 4: Host - Create GameplayScreen Component

**Files:**
- Create: `apps/host/src/components/GameplayScreen.tsx`

**Step 1: Create GameplayScreen component**

```typescript
import { useCallback } from 'react';
import type { GameState } from '@party-popper/shared';
import { RoundDisplay } from './RoundDisplay';
import { ScoreBoard } from './ScoreBoard';
import { TimelineDisplay } from './TimelineDisplay';
import { AnswerDisplay } from './AnswerDisplay';
import { TVLayout } from './TVLayout';

interface GameplayScreenProps {
  game: GameState;
  onNextRound: () => void;
}

export function GameplayScreen({ game, onNextRound }: GameplayScreenProps) {
  const round = game.currentRound;

  if (!round) {
    return (
      <TVLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-tv-xl text-white">Waiting for round to start...</p>
        </div>
      </TVLayout>
    );
  }

  const activeTeamName = game.teams[round.activeTeam].name;
  const showNextButton = round.phase === 'waiting';

  return (
    <TVLayout>
      <div className="min-h-screen flex flex-col p-8 gap-6">
        {/* Score Board */}
        <ScoreBoard
          teamA={{ name: game.teams.A.name, score: game.teams.A.score }}
          teamB={{ name: game.teams.B.name, score: game.teams.B.score }}
        />

        {/* Round Display */}
        <div className="flex-shrink-0">
          <RoundDisplay round={round} teamName={activeTeamName} />
        </div>

        {/* Answer Display */}
        {round.currentAnswer && (
          <div className="flex-shrink-0">
            <AnswerDisplay answer={round.currentAnswer} result={round.result} />
          </div>
        )}

        {/* Timelines */}
        <div className="flex-1 grid grid-cols-2 gap-8">
          <TimelineDisplay
            teamName={game.teams.A.name}
            timeline={game.teams.A.timeline}
            isActive={round.activeTeam === 'A'}
          />
          <TimelineDisplay
            teamName={game.teams.B.name}
            timeline={game.teams.B.timeline}
            isActive={round.activeTeam === 'B'}
          />
        </div>

        {/* Next Round Button */}
        {showNextButton && (
          <div className="flex justify-center flex-shrink-0">
            <button
              onClick={onNextRound}
              className="px-12 py-6 text-3xl font-bold rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 transition-colors"
            >
              Next Round →
            </button>
          </div>
        )}
      </div>
    </TVLayout>
  );
}
```

**Step 2: Commit**

```bash
git add apps/host/src/components/GameplayScreen.tsx
git commit -m "feat(host): create GameplayScreen component"
```

---

## Task 5: Host - Wire GameplayScreen into App

**Files:**
- Modify: `apps/host/src/App.tsx`

**Step 1: Import GameplayScreen**

Add to imports at top of file:

```typescript
import { GameplayScreen } from './components/GameplayScreen';
```

**Step 2: Add message handlers**

Add these cases to the `handleMessage` switch statement:

```typescript
case 'round_started': {
  // State will be updated via state_sync or we refresh
  break;
}
case 'answer_submitted': {
  // UI updates happen through state_sync
  break;
}
case 'round_result': {
  // UI updates happen through state_sync
  break;
}
case 'game_won': {
  info('Game Over!');
  // State transition handled by state_sync
  break;
}
```

**Step 3: Add next_round handler**

Add this handler function before the return statement:

```typescript
const handleNextRound = useCallback(() => {
  const message: NextRoundMessage = {
    type: 'next_round',
  };
  send(message);
}, [send]);
```

**Step 4: Replace playing screen placeholder**

Replace the placeholder section (around line 215-222) with:

```typescript
// Playing screen
if (screen === 'playing' && game) {
  return (
    <>
      <ConnectionStatus state={connectionState} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <GameplayScreen
        game={game}
        onNextRound={handleNextRound}
      />
    </>
  );
}
```

**Step 5: Commit**

```bash
git add apps/host/src/App.tsx
git commit -m "feat(host): wire GameplayScreen into App with next_round handler"
```

---

## Task 6: Player - Create PlayingView Component

**Files:**
- Create: `apps/player/src/components/PlayingView.tsx`

**Step 1: Create PlayingView component**

```typescript
import { useState, useCallback } from 'react';
import type { Round, Answer, RoundResult } from '@party-popper/shared';
import { AnswerForm } from './AnswerForm';
import { AnswerFeedback } from './AnswerFeedback';
import { TurnStatus } from './TurnStatus';

interface PlayingViewProps {
  round: Round | null;
  currentPlayerTeam: 'A' | 'B';
  onSubmitAnswer: (artist: string, title: string, year: number) => void;
}

export function PlayingView({
  round,
  currentPlayerTeam,
  onSubmitAnswer,
}: PlayingViewProps) {
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = useCallback((data: { artist: string; title: string; year: number }) => {
    onSubmitAnswer(data.artist, data.title, data.year);
    setHasSubmitted(true);
  }, [onSubmitAnswer]);

  // Reset submission state when round changes
  if (round && hasSubmitted && !round.currentAnswer) {
    setHasSubmitted(false);
  }

  if (!round) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-6">
        <p className="text-xl text-white">Waiting for round to start...</p>
      </div>
    );
  }

  const isMyTurn = round.activeTeam === currentPlayerTeam;
  const showForm = isMyTurn && round.phase === 'guessing' && !hasSubmitted;
  const showFeedback = round.result !== null;

  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      {/* Turn Status */}
      <TurnStatus
        isMyTurn={isMyTurn}
        activeTeam={round.activeTeam}
        phase={round.phase}
      />

      {/* Answer Form or Waiting Message */}
      {showForm ? (
        <AnswerForm
          onSubmit={handleSubmit}
          onTyping={() => {}} // No typing broadcast in v1
          isSubmitting={false}
        />
      ) : !isMyTurn ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-2xl text-gray-400">
            {round.activeTeam === 'A' ? 'Team A' : 'Team B'} is guessing...
          </p>
        </div>
      ) : hasSubmitted ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-2xl text-green-400">✓ Answer Submitted</p>
          <p className="text-gray-400 mt-2">Waiting for result...</p>
        </div>
      ) : null}

      {/* Answer Feedback */}
      {showFeedback && round.result && (
        <AnswerFeedback
          correct={round.result.correct}
          earnedPoints={round.result.earnedPoints}
          correctAnswer={{
            artist: round.song.artist,
            title: round.song.title,
            year: round.song.year,
          }}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/player/src/components/PlayingView.tsx
git commit -m "feat(player): create PlayingView component"
```

---

## Task 7: Player - Wire PlayingView into App

**Files:**
- Modify: `apps/player/src/App.tsx`

**Step 1: Import PlayingView**

Add to imports:

```typescript
import { PlayingView } from './components/PlayingView';
```

**Step 2: Add submit_answer handler**

Add this handler before the return statement:

```typescript
const handleSubmitAnswer = useCallback((artist: string, title: string, year: number) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist, title, year },
    }));
  }
}, []);
```

**Step 3: Update message handlers**

Add these cases to the `ws.onmessage` switch statement:

```typescript
case 'round_started': {
  const state = message.payload.round;
  setGameState(prev => {
    if (!prev) return prev;
    return {
      ...prev,
      currentRound: state,
    };
  });
  break;
}
case 'round_result': {
  // Update will come via state_sync
  break;
}
case 'game_won': {
  // Handle victory - for now just stay on playing screen
  break;
}
```

**Step 4: Replace playing screen placeholder**

Replace the playing screen section (around line 200-205) with:

```typescript
{screen === 'playing' && gameState && playerState && (
  <PlayingView
    round={gameState.currentRound}
    currentPlayerTeam={
      [...gameState.teams.A.players, ...gameState.teams.B.players]
        .find(p => p.id === playerState.playerId)?.team || 'A'
    }
    onSubmitAnswer={handleSubmitAnswer}
  />
)}
```

**Step 5: Commit**

```bash
git add apps/player/src/App.tsx
git commit -m "feat(player): wire PlayingView with submit_answer handler"
```

---

## Task 8: Victory Screen Integration (Host)

**Files:**
- Modify: `apps/host/src/App.tsx`

**Step 1: Import VictoryScreen**

Add to imports:

```typescript
import { VictoryScreen } from './components/VictoryScreen';
```

**Step 2: Add finished screen**

Add this before the final placeholder return:

```typescript
// Finished screen
if (screen === 'finished' && game) {
  const winner = game.teams.A.score > game.teams.B.score ? 'A' : 'B';
  return (
    <>
      <ConnectionStatus state={connectionState} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <VictoryScreen
        winningTeam={game.teams[winner]}
        losingTeam={game.teams[winner === 'A' ? 'B' : 'A']}
        onPlayAgain={() => {
          // TODO: Implement play again
          info('Play again not implemented yet');
        }}
        onEndSession={() => {
          // TODO: Implement end session
          info('End session not implemented yet');
        }}
      />
    </>
  );
}
```

**Step 3: Commit**

```bash
git add apps/host/src/App.tsx
git commit -m "feat(host): add VictoryScreen for finished state"
```

---

## Task 9: Manual Testing

**Files:**
- None (testing only)

**Step 1: Start backend**

```bash
cd packages/backend
npm run dev
```

Expected: Backend starts on localhost:8787

**Step 2: Start host app**

```bash
cd apps/host
npm run dev
```

Expected: Host starts on localhost:5173

**Step 3: Start player app**

```bash
cd apps/player
npm run dev
```

Expected: Player starts on localhost:5174

**Step 4: Test full gameplay flow**

1. Open host (localhost:5173) → Should see join code
2. Open player 1 (localhost:5174) → Join game
3. Open player 2 (new tab, localhost:5174) → Join game
4. Host clicks "Start Game"
   - Expected: Round 1 starts, QR code shown, Team A's turn
5. Player on Team A submits answer
   - Expected: Answer shown on host, result displayed
6. Host clicks "Next Round"
   - Expected: Round 2 starts, Team B's turn
7. Continue until one team reaches 10 points
   - Expected: Victory screen shows winner

**Step 5: Document any issues found**

Create a file `docs/testing-notes.md` with any bugs or issues discovered.

---

## Success Criteria

✅ Game starts and first round begins automatically
✅ Players can submit answers only on their team's turn
✅ Correct answers add to timeline and increment score
✅ Incorrect answers don't affect score
✅ Teams alternate turns (A → B → A → B...)
✅ Game ends when team reaches target score (10)
✅ Victory screen displays winner
✅ All real-time updates work (host sees answers, players see results)

---

## Known Limitations (v1)

These are intentionally skipped for the minimal version:

- No veto system
- No tiebreaker
- No real-time typing indicators
- Timeline not sorted chronologically (just appended)
- No fuzzy matching for artist/title
- No year tolerance (±1 year)
- No partial credit scoring
- No timer enforcement (countdown shown but doesn't auto-fail)
- No "Play Again" or "End Session" functionality

These will be added in subsequent iterations.
