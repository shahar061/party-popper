# Team Leader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Team Leader role to each team with special decision-making powers and visibility of teammates' votes.

**Architecture:** Each team has one leader (stored as `leaderId` on Team). Leaders are selected via volunteer button in lobby (first-tap-wins) or randomly assigned on game start. During gameplay, teammates' votes are stored and sent only to the leader in real-time. Only the leader's final choice counts for scoring/placement/veto decisions.

**Tech Stack:** TypeScript, React, Cloudflare Workers (Durable Objects), WebSockets, Zustand, Vitest

---

## Task 1: Add Team Leader Types to Shared Package

**Files:**
- Modify: `packages/shared/src/types.ts`
- Test: `packages/shared/src/__tests__/types.test.ts` (create)

**Step 1: Add `isTeamLeader` to Player interface**

In `packages/shared/src/types.ts`, update the Player interface (around line 40):

```typescript
export interface Player {
  id: string;
  sessionId: string;
  name: string;
  team: 'A' | 'B';
  connected: boolean;
  lastSeen: number;
  isTeamLeader: boolean;  // Add this line
}
```

**Step 2: Add teammate vote tracking types**

Add after the existing interfaces (around line 185):

```typescript
// Team Leader - Teammate Vote Tracking
export interface TeammateVote {
  playerId: string;
  playerName: string;
}

export interface TeammateQuizVote extends TeammateVote {
  artistIndex: number | null;
  titleIndex: number | null;
}

export interface TeammatePlacementVote extends TeammateVote {
  position: number | null;
}

export interface TeammateVetoVote extends TeammateVote {
  useVeto: boolean | null;
}
```

**Step 3: Run type check**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: Should show errors in other packages where Player objects are created without `isTeamLeader`. This is expected - we'll fix those in subsequent tasks.

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add team leader types and teammate vote interfaces"
```

---

## Task 2: Add WebSocket Message Types

**Files:**
- Modify: `packages/shared/src/messages.ts`

**Step 1: Add new client message types**

In `packages/shared/src/messages.ts`, update `ClientMessageType` (around line 6):

```typescript
export type ClientMessageType =
  | 'join'
  | 'leave'
  | 'reconnect'
  | 'start_game'
  | 'player_ready'
  | 'submit_answer'
  | 'use_veto'
  | 'typing'
  | 'next_round'
  | 'reassign_team'
  | 'update_settings'
  | 'pong'
  | 'submit_quiz'
  | 'submit_placement'
  | 'pass_veto'
  | 'submit_veto_placement'
  | 'claim_team_leader'       // Add this
  | 'submit_quiz_suggestion'  // Add this - teammate suggestion to leader
  | 'submit_placement_suggestion'  // Add this
  | 'submit_veto_suggestion';     // Add this
```

**Step 2: Add client message interfaces**

Add after the existing message interfaces (find a good spot, around line 140):

```typescript
// Team Leader Messages - Client to Server
export interface ClaimTeamLeaderMessage {
  type: 'claim_team_leader';
  payload: Record<string, never>;  // No payload needed - uses session
}

export interface SubmitQuizSuggestionMessage {
  type: 'submit_quiz_suggestion';
  payload: {
    artistIndex: number | null;
    titleIndex: number | null;
  };
}

export interface SubmitPlacementSuggestionMessage {
  type: 'submit_placement_suggestion';
  payload: {
    position: number | null;
  };
}

export interface SubmitVetoSuggestionMessage {
  type: 'submit_veto_suggestion';
  payload: {
    useVeto: boolean | null;
  };
}
```

**Step 3: Add server message types**

Update `ServerMessageType` to include new types:

```typescript
// Add to ServerMessageType union (find around line 149)
  | 'leader_claimed'
  | 'teammate_quiz_vote'
  | 'teammate_placement_vote'
  | 'teammate_veto_vote'
```

**Step 4: Add server message interfaces**

Add after server message interfaces:

```typescript
// Team Leader Messages - Server to Client
export interface LeaderClaimedMessage {
  type: 'leader_claimed';
  payload: {
    team: 'A' | 'B';
    playerId: string;
    playerName: string;
  };
}

export interface TeammateQuizVoteMessage {
  type: 'teammate_quiz_vote';
  payload: TeammateQuizVote;
}

export interface TeammatePlacementVoteMessage {
  type: 'teammate_placement_vote';
  payload: TeammatePlacementVote;
}

export interface TeammateVetoVoteMessage {
  type: 'teammate_veto_vote';
  payload: TeammateVetoVote;
}
```

**Step 5: Update ClientMessage union type**

Find the `ClientMessage` union type and add the new message types:

```typescript
export type ClientMessage =
  // ... existing types ...
  | ClaimTeamLeaderMessage
  | SubmitQuizSuggestionMessage
  | SubmitPlacementSuggestionMessage
  | SubmitVetoSuggestionMessage;
```

**Step 6: Update ServerMessage union type**

Find the `ServerMessage` union type and add the new message types:

```typescript
export type ServerMessage =
  // ... existing types ...
  | LeaderClaimedMessage
  | TeammateQuizVoteMessage
  | TeammatePlacementVoteMessage
  | TeammateVetoVoteMessage;
```

**Step 7: Run type check**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: PASS (no errors in shared package itself)

**Step 8: Commit**

```bash
git add packages/shared/src/messages.ts
git commit -m "feat(shared): add team leader WebSocket message types"
```

---

## Task 3: Update Backend Player Creation

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/game.test.ts`

**Step 1: Write failing test for player creation with isTeamLeader**

In `packages/backend/src/__tests__/game.test.ts`, add a test:

```typescript
describe('Team Leader', () => {
  it('should create players with isTeamLeader set to false', async () => {
    const game = new Game(mockCtx, mockEnv);
    await game.initialize('TEST123');

    const mockWs = createMockWebSocket();
    await game.handleJoin(
      { name: 'Alice', sessionId: 'session-1' },
      mockWs
    );

    const state = game.getState();
    const player = state?.teams.A.players[0] || state?.teams.B.players[0];
    expect(player?.isTeamLeader).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/backend && npm test -- --grep "should create players with isTeamLeader"
```

Expected: FAIL - `isTeamLeader` is undefined

**Step 3: Update player creation in handleJoin**

In `packages/backend/src/game.ts`, find the `handleJoin` method (around line 118) and update player creation:

```typescript
const player: Player = {
  id: crypto.randomUUID(),
  name: playerName,
  sessionId,
  team: team || this.getTeamWithFewerPlayers(),
  connected: true,
  lastSeen: Date.now(),
  isTeamLeader: false,  // Add this line
};
```

**Step 4: Run test to verify it passes**

```bash
cd packages/backend && npm test -- --grep "should create players with isTeamLeader"
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/game.test.ts
git commit -m "feat(backend): add isTeamLeader field to player creation"
```

---

## Task 4: Implement Claim Team Leader Handler

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/team-leader.test.ts` (create)

**Step 1: Create test file with first test**

Create `packages/backend/src/__tests__/team-leader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

function createMockWebSocket() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as WebSocket;
}

const mockCtx = {
  storage: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  blockConcurrencyWhile: vi.fn((fn) => fn()),
} as unknown as DurableObjectState;

const mockEnv = {} as Env;

describe('Team Leader', () => {
  let game: Game;

  beforeEach(async () => {
    vi.clearAllMocks();
    game = new Game(mockCtx, mockEnv);
    await game.initialize('TEST123');
  });

  describe('claimTeamLeader', () => {
    it('should allow first player to claim team leader', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      await game.handleJoin({ name: 'Alice', sessionId: 'session-1' }, ws1);
      await game.handleJoin({ name: 'Bob', sessionId: 'session-2' }, ws2);

      // Move Bob to same team as Alice for this test
      const state = game.getState();
      const aliceTeam = state?.teams.A.players.find(p => p.name === 'Alice') ? 'A' : 'B';

      const result = await game.handleClaimTeamLeader('session-1');

      expect(result.success).toBe(true);
      const updatedState = game.getState();
      const alice = updatedState?.teams[aliceTeam].players.find(p => p.name === 'Alice');
      expect(alice?.isTeamLeader).toBe(true);
    });

    it('should reject claim if team already has a leader', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      await game.handleJoin({ name: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ name: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

      await game.handleClaimTeamLeader('session-1');
      const result = await game.handleClaimTeamLeader('session-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Team already has a leader');
    });

    it('should broadcast leader_claimed message', async () => {
      const ws1 = createMockWebSocket();
      await game.handleJoin({ name: 'Alice', sessionId: 'session-1' }, ws1);

      await game.handleClaimTeamLeader('session-1');

      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"leader_claimed"')
      );
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: FAIL - `handleClaimTeamLeader` is not defined

**Step 3: Implement handleClaimTeamLeader method**

In `packages/backend/src/game.ts`, add the method (after `handleJoin`):

```typescript
async handleClaimTeamLeader(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!this.state) {
    return { success: false, error: 'Game not initialized' };
  }

  const player = this.findPlayerBySession(sessionId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  const team = this.state.teams[player.team];
  const existingLeader = team.players.find(p => p.isTeamLeader);

  if (existingLeader) {
    return { success: false, error: 'Team already has a leader' };
  }

  // Set this player as leader
  player.isTeamLeader = true;
  await this.persistState();

  // Broadcast to all clients
  this.broadcast({
    type: 'leader_claimed',
    payload: {
      team: player.team,
      playerId: player.id,
      playerName: player.name,
    },
  });

  return { success: true };
}
```

**Step 4: Add message routing for claim_team_leader**

Find the message router (likely in `handleMessage` or `routeMessage`) and add:

```typescript
case 'claim_team_leader':
  return this.handleClaimTeamLeader(sessionId);
```

**Step 5: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): implement claim team leader handler"
```

---

## Task 5: Auto-Assign Leaders on Game Start

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/team-leader.test.ts`

**Step 1: Add test for auto-assignment**

Add to `packages/backend/src/__tests__/team-leader.test.ts`:

```typescript
describe('Auto-assign leader on game start', () => {
  it('should auto-assign leader if team has no leader on game start', async () => {
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();

    await game.handleJoin({ name: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
    await game.handleJoin({ name: 'Bob', sessionId: 'session-2', team: 'B' }, ws2);

    // Neither player claimed leader
    await game.handleStartGame('session-1');

    const state = game.getState();
    const teamALeader = state?.teams.A.players.find(p => p.isTeamLeader);
    const teamBLeader = state?.teams.B.players.find(p => p.isTeamLeader);

    expect(teamALeader).toBeDefined();
    expect(teamBLeader).toBeDefined();
  });

  it('should not reassign leader if team already has one', async () => {
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    const ws3 = createMockWebSocket();

    await game.handleJoin({ name: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
    await game.handleJoin({ name: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);
    await game.handleJoin({ name: 'Charlie', sessionId: 'session-3', team: 'B' }, ws3);

    // Alice claims leader for Team A
    await game.handleClaimTeamLeader('session-1');

    await game.handleStartGame('session-1');

    const state = game.getState();
    const alice = state?.teams.A.players.find(p => p.name === 'Alice');
    const bob = state?.teams.A.players.find(p => p.name === 'Bob');

    expect(alice?.isTeamLeader).toBe(true);
    expect(bob?.isTeamLeader).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: FAIL

**Step 3: Implement auto-assignment in handleStartGame**

Find `handleStartGame` method and add at the beginning (after initial validation):

```typescript
// Auto-assign leaders for teams without one
for (const teamId of ['A', 'B'] as const) {
  const team = this.state.teams[teamId];
  const hasLeader = team.players.some(p => p.isTeamLeader);

  if (!hasLeader && team.players.length > 0) {
    // Randomly select a leader
    const randomIndex = Math.floor(Math.random() * team.players.length);
    team.players[randomIndex].isTeamLeader = true;

    this.broadcast({
      type: 'leader_claimed',
      payload: {
        team: teamId,
        playerId: team.players[randomIndex].id,
        playerName: team.players[randomIndex].name,
      },
    });
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): auto-assign team leaders on game start"
```

---

## Task 6: Handle Leader Disconnect and Reassignment

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/team-leader.test.ts`

**Step 1: Add test for leader reassignment on disconnect**

Add to `packages/backend/src/__tests__/team-leader.test.ts`:

```typescript
describe('Leader disconnect handling', () => {
  it('should reassign leader when leader disconnects during game', async () => {
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    const ws3 = createMockWebSocket();

    await game.handleJoin({ name: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
    await game.handleJoin({ name: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);
    await game.handleJoin({ name: 'Charlie', sessionId: 'session-3', team: 'B' }, ws3);

    await game.handleClaimTeamLeader('session-1'); // Alice is leader
    await game.handleStartGame('session-1');

    // Alice disconnects
    await game.handleDisconnect(ws1);

    const state = game.getState();
    const bob = state?.teams.A.players.find(p => p.name === 'Bob');

    // Bob should now be leader
    expect(bob?.isTeamLeader).toBe(true);
  });

  it('should make leader available again when leader disconnects in lobby', async () => {
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();

    await game.handleJoin({ name: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
    await game.handleJoin({ name: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

    await game.handleClaimTeamLeader('session-1'); // Alice is leader

    // Alice disconnects during lobby
    await game.handleDisconnect(ws1);

    // Bob should be able to claim leader now
    const result = await game.handleClaimTeamLeader('session-2');
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: FAIL

**Step 3: Update disconnect handling**

Find `handleDisconnect` method and add leader reassignment logic:

```typescript
// After marking player as disconnected, check if they were a leader
if (player.isTeamLeader) {
  player.isTeamLeader = false;

  // If game is in progress, auto-reassign to another connected teammate
  if (this.state.status === 'playing') {
    const team = this.state.teams[player.team];
    const connectedTeammates = team.players.filter(
      p => p.connected && p.id !== player.id
    );

    if (connectedTeammates.length > 0) {
      const newLeader = connectedTeammates[0];
      newLeader.isTeamLeader = true;

      this.broadcast({
        type: 'leader_claimed',
        payload: {
          team: player.team,
          playerId: newLeader.id,
          playerName: newLeader.name,
        },
      });
    }
  }
  // In lobby, just clear the leader - anyone can claim
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): handle leader disconnect and reassignment"
```

---

## Task 7: Store and Broadcast Teammate Quiz Suggestions

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/team-leader.test.ts`

**Step 1: Add teammate vote storage to game state**

In `packages/backend/src/game.ts`, add to class properties:

```typescript
private teammateQuizVotes: Map<string, { artistIndex: number | null; titleIndex: number | null }> = new Map();
```

**Step 2: Add test for teammate quiz suggestion**

Add to `packages/backend/src/__tests__/team-leader.test.ts`:

```typescript
describe('Teammate quiz suggestions', () => {
  it('should send teammate vote to leader only', async () => {
    const wsAlice = createMockWebSocket();
    const wsBob = createMockWebSocket();
    const wsCharlie = createMockWebSocket();

    // Alice and Bob on Team A, Charlie on Team B
    await game.handleJoin({ name: 'Alice', sessionId: 'session-1', team: 'A' }, wsAlice);
    await game.handleJoin({ name: 'Bob', sessionId: 'session-2', team: 'A' }, wsBob);
    await game.handleJoin({ name: 'Charlie', sessionId: 'session-3', team: 'B' }, wsCharlie);

    await game.handleClaimTeamLeader('session-1'); // Alice is leader
    await game.handleStartGame('session-1');

    // Clear mocks after setup
    vi.clearAllMocks();

    // Bob submits a quiz suggestion
    await game.handleQuizSuggestion('session-2', { artistIndex: 1, titleIndex: 2 });

    // Alice (leader) should receive the suggestion
    expect(wsAlice.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"teammate_quiz_vote"')
    );

    // Bob and Charlie should NOT receive it
    expect(wsBob.send).not.toHaveBeenCalledWith(
      expect.stringContaining('"type":"teammate_quiz_vote"')
    );
    expect(wsCharlie.send).not.toHaveBeenCalledWith(
      expect.stringContaining('"type":"teammate_quiz_vote"')
    );
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd packages/backend && npm test -- "Teammate quiz suggestions"
```

Expected: FAIL

**Step 4: Implement handleQuizSuggestion**

```typescript
async handleQuizSuggestion(
  sessionId: string,
  suggestion: { artistIndex: number | null; titleIndex: number | null }
): Promise<{ success: boolean }> {
  if (!this.state) return { success: false };

  const player = this.findPlayerBySession(sessionId);
  if (!player) return { success: false };

  // Don't store suggestions from the leader
  const team = this.state.teams[player.team];
  if (player.isTeamLeader) return { success: false };

  // Store the suggestion
  this.teammateQuizVotes.set(player.id, suggestion);

  // Find the team leader
  const leader = team.players.find(p => p.isTeamLeader);
  if (!leader) return { success: false };

  // Send to leader only
  const leaderWs = this.getWebSocketForPlayer(leader.sessionId);
  if (leaderWs) {
    this.sendToSocket(leaderWs, {
      type: 'teammate_quiz_vote',
      payload: {
        playerId: player.id,
        playerName: player.name,
        artistIndex: suggestion.artistIndex,
        titleIndex: suggestion.titleIndex,
      },
    });
  }

  return { success: true };
}

private getWebSocketForPlayer(sessionId: string): WebSocket | undefined {
  for (const [ws, sid] of this.wsToPlayer.entries()) {
    if (sid === sessionId) return ws;
  }
  return undefined;
}
```

**Step 5: Add message routing**

```typescript
case 'submit_quiz_suggestion':
  return this.handleQuizSuggestion(sessionId, message.payload);
```

**Step 6: Run test to verify it passes**

```bash
cd packages/backend && npm test -- "Teammate quiz suggestions"
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): store and broadcast teammate quiz suggestions to leader"
```

---

## Task 8: Store and Broadcast Teammate Placement/Veto Suggestions

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/team-leader.test.ts`

**Step 1: Add storage for placement and veto suggestions**

```typescript
private teammatePlacementVotes: Map<string, { position: number | null }> = new Map();
private teammateVetoVotes: Map<string, { useVeto: boolean | null }> = new Map();
```

**Step 2: Add tests**

```typescript
describe('Teammate placement suggestions', () => {
  it('should send placement suggestion to leader only', async () => {
    // Similar setup as quiz test...
    await game.handlePlacementSuggestion('session-2', { position: 1 });

    expect(wsAlice.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"teammate_placement_vote"')
    );
  });
});

describe('Teammate veto suggestions', () => {
  it('should send veto suggestion to leader only', async () => {
    // Similar setup...
    await game.handleVetoSuggestion('session-2', { useVeto: true });

    expect(wsAlice.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"teammate_veto_vote"')
    );
  });
});
```

**Step 3: Implement handlers (same pattern as quiz)**

```typescript
async handlePlacementSuggestion(
  sessionId: string,
  suggestion: { position: number | null }
): Promise<{ success: boolean }> {
  // Same pattern as handleQuizSuggestion
  // Store in teammatePlacementVotes
  // Send teammate_placement_vote to leader
}

async handleVetoSuggestion(
  sessionId: string,
  suggestion: { useVeto: boolean | null }
): Promise<{ success: boolean }> {
  // Same pattern
  // Store in teammateVetoVotes
  // Send teammate_veto_vote to leader
}
```

**Step 4: Add message routing**

```typescript
case 'submit_placement_suggestion':
  return this.handlePlacementSuggestion(sessionId, message.payload);
case 'submit_veto_suggestion':
  return this.handleVetoSuggestion(sessionId, message.payload);
```

**Step 5: Run tests**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): add teammate placement and veto suggestions"
```

---

## Task 9: Enforce Leader-Only Final Decisions

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/team-leader.test.ts`

**Step 1: Add test for leader-only enforcement**

```typescript
describe('Leader-only decisions', () => {
  it('should reject quiz submission from non-leader', async () => {
    // Setup with Alice as leader, Bob as teammate
    const result = await game.handleSubmitQuiz(1, 2, bobPlayerId);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Only team leader can submit final answer');
  });

  it('should accept quiz submission from leader', async () => {
    const result = await game.handleSubmitQuiz(1, 2, alicePlayerId);
    expect(result.success).toBe(true);
  });

  it('should reject placement from non-leader', async () => {
    const result = await game.handleSubmitPlacement(1, bobPlayerId);
    expect(result.success).toBe(false);
  });

  it('should reject veto decision from non-leader', async () => {
    const result = await game.handleVetoDecision(true, bobPlayerId);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Expected: FAIL (currently accepts from any player)

**Step 3: Update handleSubmitQuiz**

Add at the beginning of the method:

```typescript
// Only team leader can submit final answer
if (!player.isTeamLeader) {
  return { success: false, correct: false, earnedToken: false, error: 'Only team leader can submit final answer' };
}
```

**Step 4: Update handleSubmitPlacement**

Add similar check:

```typescript
if (!player.isTeamLeader) {
  return { success: false, error: 'Only team leader can submit placement' };
}
```

**Step 5: Update handleVetoDecision**

```typescript
if (!player.isTeamLeader) {
  return { success: false, error: 'Only team leader can decide veto' };
}
```

**Step 6: Run tests**

```bash
cd packages/backend && npm test -- team-leader
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): enforce leader-only final decisions"
```

---

## Task 10: Add Player Status Row Component (Player App)

**Files:**
- Create: `apps/player/src/components/PlayerStatusRow.tsx`
- Test: `apps/player/src/components/__tests__/PlayerStatusRow.test.tsx`

**Step 1: Create test file**

```typescript
// apps/player/src/components/__tests__/PlayerStatusRow.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerStatusRow } from '../PlayerStatusRow';

describe('PlayerStatusRow', () => {
  it('shows player name and team', () => {
    render(
      <PlayerStatusRow
        playerName="Alice"
        team="A"
        teamName="Team Alpha"
        isTeamLeader={false}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
  });

  it('shows crown emoji for team leader', () => {
    render(
      <PlayerStatusRow
        playerName="Alice"
        team="A"
        teamName="Team Alpha"
        isTeamLeader={true}
      />
    );

    expect(screen.getByText(/👑/)).toBeInTheDocument();
  });

  it('does not show crown for non-leader', () => {
    render(
      <PlayerStatusRow
        playerName="Bob"
        team="B"
        teamName="Team Beta"
        isTeamLeader={false}
      />
    );

    expect(screen.queryByText(/👑/)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/player && npm test -- PlayerStatusRow
```

Expected: FAIL - component doesn't exist

**Step 3: Create the component**

```typescript
// apps/player/src/components/PlayerStatusRow.tsx
interface PlayerStatusRowProps {
  playerName: string;
  team: 'A' | 'B';
  teamName: string;
  isTeamLeader: boolean;
}

export function PlayerStatusRow({
  playerName,
  team,
  teamName,
  isTeamLeader,
}: PlayerStatusRowProps) {
  const teamColor = team === 'A' ? 'text-blue-400' : 'text-red-400';
  const bgColor = team === 'A' ? 'bg-blue-900/30' : 'bg-red-900/30';
  const borderColor = team === 'A' ? 'border-blue-500/50' : 'border-red-500/50';

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 ${bgColor} border-b ${borderColor}`}
    >
      <div className="flex items-center gap-2">
        {isTeamLeader && <span className="text-yellow-400">👑</span>}
        <span className="text-white font-medium">{playerName}</span>
      </div>
      <span className={`text-sm font-medium ${teamColor}`}>{teamName}</span>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/player && npm test -- PlayerStatusRow
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/PlayerStatusRow.tsx apps/player/src/components/__tests__/PlayerStatusRow.test.tsx
git commit -m "feat(player): add PlayerStatusRow component"
```

---

## Task 11: Integrate PlayerStatusRow into Player App

**Files:**
- Modify: `apps/player/src/App.tsx`

**Step 1: Import and add PlayerStatusRow**

At the top of the file:

```typescript
import { PlayerStatusRow } from './components/PlayerStatusRow';
```

**Step 2: Add to render (always visible)**

Find the main render and add at the top of the layout:

```typescript
return (
  <div className="min-h-screen bg-game-bg flex flex-col">
    {currentPlayer && (
      <PlayerStatusRow
        playerName={currentPlayer.name}
        team={currentPlayer.team}
        teamName={gameState.teams[currentPlayer.team].name}
        isTeamLeader={currentPlayer.isTeamLeader}
      />
    )}

    {/* Rest of the app content */}
    {screen === 'join' && <JoinScreen ... />}
    {screen === 'lobby' && <LobbyView ... />}
    {screen === 'playing' && <PlayingView ... />}
  </div>
);
```

**Step 3: Test manually**

```bash
cd apps/player && npm run dev
```

Verify the status row appears at the top.

**Step 4: Commit**

```bash
git add apps/player/src/App.tsx
git commit -m "feat(player): integrate PlayerStatusRow into app layout"
```

---

## Task 12: Add "Be Team Leader" Button to Lobby

**Files:**
- Modify: `apps/player/src/components/LobbyView.tsx`
- Test: `apps/player/src/components/__tests__/LobbyView.test.tsx`

**Step 1: Add test for leader claim button**

```typescript
describe('Team Leader claim button', () => {
  it('shows "Be Team Leader" button when team has no leader', () => {
    render(
      <LobbyView
        teamA={{ ...mockTeamA, players: [{ ...mockPlayer, isTeamLeader: false }] }}
        teamB={mockTeamB}
        currentPlayerId={mockPlayer.id}
        gameCode="TEST"
        onClaimLeader={mockOnClaimLeader}
      />
    );

    expect(screen.getByText('Be Team Leader')).toBeInTheDocument();
  });

  it('hides button when team already has a leader', () => {
    render(
      <LobbyView
        teamA={{ ...mockTeamA, players: [{ ...mockPlayer, isTeamLeader: true }] }}
        teamB={mockTeamB}
        currentPlayerId={mockPlayer.id}
        gameCode="TEST"
        onClaimLeader={mockOnClaimLeader}
      />
    );

    expect(screen.queryByText('Be Team Leader')).not.toBeInTheDocument();
  });

  it('shows leader name when team has a leader', () => {
    render(
      <LobbyView
        teamA={{ ...mockTeamA, players: [{ ...mockPlayer, name: 'Alice', isTeamLeader: true }] }}
        teamB={mockTeamB}
        currentPlayerId="other-id"
        gameCode="TEST"
        onClaimLeader={mockOnClaimLeader}
      />
    );

    expect(screen.getByText(/👑 Alice is your Team Leader/)).toBeInTheDocument();
  });
});
```

**Step 2: Update LobbyView props**

```typescript
interface LobbyViewProps {
  // ... existing props
  onClaimLeader?: () => void;
}
```

**Step 3: Update LobbyView component**

In the TeamColumn section, add:

```typescript
function TeamColumn({ team, teamLabel, currentPlayerId, onClaimLeader }: TeamColumnProps) {
  const leader = team.players.find(p => p.isTeamLeader);
  const isMyTeam = team.players.some(p => p.id === currentPlayerId);
  const amILeader = team.players.find(p => p.id === currentPlayerId)?.isTeamLeader;

  return (
    <div className="flex-1 bg-game-surface rounded-xl p-4">
      <h3 className="text-lg font-bold text-center mb-4">
        {team.name || `Team ${teamLabel}`}
      </h3>

      {/* Leader status section */}
      {isMyTeam && (
        <div className="mb-4 text-center">
          {leader ? (
            <p className="text-yellow-400 text-sm">
              👑 {leader.name} is your Team Leader
            </p>
          ) : (
            <button
              onClick={onClaimLeader}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg text-sm"
            >
              Be Team Leader
            </button>
          )}
        </div>
      )}

      {/* Player list */}
      {team.players.map(player => (
        <PlayerRow
          key={player.id}
          player={player}
          isCurrentPlayer={player.id === currentPlayerId}
        />
      ))}
    </div>
  );
}
```

**Step 4: Run tests**

```bash
cd apps/player && npm test -- LobbyView
```

Expected: PASS

**Step 5: Wire up the WebSocket message**

In App.tsx or relevant hook, add handler:

```typescript
const handleClaimLeader = () => {
  sendMessage({ type: 'claim_team_leader', payload: {} });
};
```

Pass to LobbyView:

```typescript
<LobbyView
  {...otherProps}
  onClaimLeader={handleClaimLeader}
/>
```

**Step 6: Commit**

```bash
git add apps/player/src/components/LobbyView.tsx apps/player/src/components/__tests__/LobbyView.test.tsx apps/player/src/App.tsx
git commit -m "feat(player): add team leader claim button to lobby"
```

---

## Task 13: Add Team Votes Panel for Leader (Quiz Phase)

**Files:**
- Create: `apps/player/src/components/TeamVotesPanel.tsx`
- Test: `apps/player/src/components/__tests__/TeamVotesPanel.test.tsx`
- Modify: `apps/player/src/components/QuizForm.tsx`

**Step 1: Create test**

```typescript
// apps/player/src/components/__tests__/TeamVotesPanel.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamVotesPanel } from '../TeamVotesPanel';

describe('TeamVotesPanel', () => {
  it('shows teammates votes', () => {
    const votes = [
      { playerId: '1', playerName: 'Bob', artistIndex: 0, titleIndex: 1 },
      { playerId: '2', playerName: 'Lisa', artistIndex: null, titleIndex: null },
    ];
    const artists = ['Artist A', 'Artist B', 'Artist C', 'Artist D'];
    const titles = ['Song A', 'Song B', 'Song C', 'Song D'];

    render(
      <TeamVotesPanel
        votes={votes}
        artists={artists}
        titles={titles}
      />
    );

    expect(screen.getByText('Team Votes')).toBeInTheDocument();
    expect(screen.getByText('Bob:')).toBeInTheDocument();
    expect(screen.getByText('Artist A / Song B')).toBeInTheDocument();
    expect(screen.getByText('Lisa:')).toBeInTheDocument();
    expect(screen.getByText('(thinking...)')).toBeInTheDocument();
  });
});
```

**Step 2: Create TeamVotesPanel component**

```typescript
// apps/player/src/components/TeamVotesPanel.tsx
import { TeammateQuizVote } from '@party-popper/shared';

interface TeamVotesPanelProps {
  votes: TeammateQuizVote[];
  artists: string[];
  titles: string[];
}

export function TeamVotesPanel({ votes, artists, titles }: TeamVotesPanelProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-yellow-500/30">
      <h4 className="text-yellow-400 font-bold text-sm mb-2">Team Votes</h4>
      <div className="space-y-1">
        {votes.map(vote => (
          <div key={vote.playerId} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{vote.playerName}:</span>
            {vote.artistIndex !== null && vote.titleIndex !== null ? (
              <span className="text-white">
                {artists[vote.artistIndex]} / {titles[vote.titleIndex]}
              </span>
            ) : (
              <span className="text-gray-500 italic">(thinking...)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Run test**

```bash
cd apps/player && npm test -- TeamVotesPanel
```

Expected: PASS

**Step 4: Integrate into QuizForm for leaders**

Update QuizForm props:

```typescript
interface QuizFormProps {
  // ... existing props
  isTeamLeader?: boolean;
  teammateVotes?: TeammateQuizVote[];
}
```

Add to QuizForm render:

```typescript
{isTeamLeader && teammateVotes && teammateVotes.length > 0 && (
  <TeamVotesPanel
    votes={teammateVotes}
    artists={artists}
    titles={songTitles}
  />
)}
```

**Step 5: Commit**

```bash
git add apps/player/src/components/TeamVotesPanel.tsx apps/player/src/components/__tests__/TeamVotesPanel.test.tsx apps/player/src/components/QuizForm.tsx
git commit -m "feat(player): add team votes panel for quiz phase leaders"
```

---

## Task 14: Send Suggestions Instead of Final Answers (Non-Leaders)

**Files:**
- Modify: `apps/player/src/components/QuizForm.tsx`
- Modify: App state management (hooks or store)

**Step 1: Update QuizForm to distinguish leader vs non-leader behavior**

```typescript
interface QuizFormProps {
  // ... existing props
  isTeamLeader: boolean;
  onSubmit: (artistIndex: number, titleIndex: number) => void;
  onSuggest?: (artistIndex: number | null, titleIndex: number | null) => void;
}

export function QuizForm({
  // ...
  isTeamLeader,
  onSubmit,
  onSuggest,
}: QuizFormProps) {
  // When non-leader selects, send suggestion
  useEffect(() => {
    if (!isTeamLeader && onSuggest) {
      onSuggest(selectedArtist, selectedTitle);
    }
  }, [selectedArtist, selectedTitle, isTeamLeader, onSuggest]);

  const handleSubmit = () => {
    if (selectedArtist === null || selectedTitle === null) return;

    if (isTeamLeader) {
      onSubmit(selectedArtist, selectedTitle);
    }
    // Non-leaders don't submit, their selection is already sent as suggestion
  };

  return (
    <div>
      {/* Artist selection */}
      {/* Title selection */}

      {isTeamLeader ? (
        <button onClick={handleSubmit}>Submit Team Answer</button>
      ) : (
        <div className="text-center text-gray-400 text-sm">
          Your suggestion has been sent to your team leader
        </div>
      )}
    </div>
  );
}
```

**Step 2: Wire up suggestion message in app**

```typescript
const handleQuizSuggest = (artistIndex: number | null, titleIndex: number | null) => {
  sendMessage({
    type: 'submit_quiz_suggestion',
    payload: { artistIndex, titleIndex }
  });
};
```

**Step 3: Test manually and verify behavior**

**Step 4: Commit**

```bash
git add apps/player/src/components/QuizForm.tsx apps/player/src/App.tsx
git commit -m "feat(player): send suggestions instead of final answers for non-leaders"
```

---

## Task 15: Add Teammate Suggestions for Placement Phase

**Files:**
- Create: `apps/player/src/components/PlacementSuggestionsPanel.tsx`
- Modify: `apps/player/src/components/TimelinePlacement.tsx`

**Step 1: Create PlacementSuggestionsPanel**

```typescript
// apps/player/src/components/PlacementSuggestionsPanel.tsx
import { TeammatePlacementVote } from '@party-popper/shared';

interface PlacementSuggestionsPanelProps {
  suggestions: TeammatePlacementVote[];
  timelineLength: number;
}

export function PlacementSuggestionsPanel({
  suggestions,
  timelineLength,
}: PlacementSuggestionsPanelProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-yellow-500/30">
      <h4 className="text-yellow-400 font-bold text-sm mb-2">Teammate Suggestions</h4>
      <div className="space-y-1">
        {suggestions.map(suggestion => (
          <div key={suggestion.playerId} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{suggestion.playerName}:</span>
            {suggestion.position !== null ? (
              <span className="text-white">
                Position {suggestion.position + 1}
              </span>
            ) : (
              <span className="text-gray-500 italic">(thinking...)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Integrate into TimelinePlacement**

Same pattern as quiz - show panel for leaders, send suggestions for non-leaders.

**Step 3: Run tests and commit**

```bash
git add apps/player/src/components/PlacementSuggestionsPanel.tsx apps/player/src/components/TimelinePlacement.tsx
git commit -m "feat(player): add teammate suggestions panel for placement phase"
```

---

## Task 16: Add Teammate Suggestions for Veto Phase

**Files:**
- Create: `apps/player/src/components/VetoSuggestionsPanel.tsx`
- Modify: `apps/player/src/components/VetoDecision.tsx`

**Step 1: Create VetoSuggestionsPanel**

```typescript
// apps/player/src/components/VetoSuggestionsPanel.tsx
import { TeammateVetoVote } from '@party-popper/shared';

interface VetoSuggestionsPanelProps {
  suggestions: TeammateVetoVote[];
}

export function VetoSuggestionsPanel({ suggestions }: VetoSuggestionsPanelProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-yellow-500/30">
      <h4 className="text-yellow-400 font-bold text-sm mb-2">Teammate Votes</h4>
      <div className="space-y-1">
        {suggestions.map(suggestion => (
          <div key={suggestion.playerId} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{suggestion.playerName}:</span>
            {suggestion.useVeto !== null ? (
              <span className={suggestion.useVeto ? 'text-red-400' : 'text-green-400'}>
                {suggestion.useVeto ? 'Challenge!' : 'Accept'}
              </span>
            ) : (
              <span className="text-gray-500 italic">(thinking...)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Integrate into VetoDecision component**

**Step 3: Commit**

```bash
git add apps/player/src/components/VetoSuggestionsPanel.tsx apps/player/src/components/VetoDecision.tsx
git commit -m "feat(player): add teammate suggestions panel for veto phase"
```

---

## Task 17: Add Crown to Host Lobby Team Roster

**Files:**
- Modify: `apps/host/src/components/TeamRoster.tsx`

**Step 1: Update PlayerSlot to show crown**

```typescript
function PlayerSlot({ player, color, oppositeTeam, onMovePlayer }: PlayerSlotProps) {
  return (
    <div className="flex items-center justify-between bg-game-bg rounded-lg px-4 py-3 border border-game-border">
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${
          player.connected ? `bg-${color}-500` : 'bg-game-muted'
        }`} />
        {player.isTeamLeader && (
          <span className="text-yellow-400">👑</span>
        )}
        <span className="text-tv-base text-game-text">{player.name}</span>
      </div>

      {onMovePlayer && (
        <button
          onClick={() => onMovePlayer(player.id, oppositeTeam)}
          className="text-tv-sm text-game-muted hover:text-white"
        >
          Move
        </button>
      )}
    </div>
  );
}
```

**Step 2: Add "Waiting for leader" indicator**

In TeamColumn:

```typescript
const leader = team.players.find(p => p.isTeamLeader);

// After team name
{!leader && team.players.length > 0 && (
  <p className="text-yellow-400/60 text-sm text-center mb-4">
    Waiting for leader...
  </p>
)}
```

**Step 3: Commit**

```bash
git add apps/host/src/components/TeamRoster.tsx
git commit -m "feat(host): show crown and leader status in lobby team roster"
```

---

## Task 18: Add Crown to Host Gameplay Displays

**Files:**
- Modify: `apps/host/src/components/ScoreBoard.tsx`
- Modify: `apps/host/src/components/GameplayScreen.tsx`

**Step 1: Pass team data to ScoreBoard**

Update ScoreBoard props to include teams:

```typescript
interface ScoreBoardProps {
  // ... existing props
  teamA: Team;
  teamB: Team;
}
```

**Step 2: Display leader name with crown in ScoreBoard**

```typescript
function TeamScore({ team, isActive }: TeamScoreProps) {
  const leader = team.players.find(p => p.isTeamLeader);

  return (
    <div className={`... ${isActive ? 'ring-2 ring-yellow-400' : ''}`}>
      <div className="text-2xl font-bold">{team.name}</div>
      {leader && (
        <div className="text-sm text-yellow-400">
          👑 {leader.name}
        </div>
      )}
      <div className="text-4xl font-bold">{team.score}</div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/host/src/components/ScoreBoard.tsx apps/host/src/components/GameplayScreen.tsx
git commit -m "feat(host): show team leader with crown in gameplay scoreboard"
```

---

## Task 19: Clear Teammate Votes Between Phases

**Files:**
- Modify: `packages/backend/src/game.ts`

**Step 1: Add method to clear votes**

```typescript
private clearTeammateVotes(): void {
  this.teammateQuizVotes.clear();
  this.teammatePlacementVotes.clear();
  this.teammateVetoVotes.clear();
}
```

**Step 2: Call at phase transitions**

In `transitionToPhase` or wherever phases change:

```typescript
// Clear votes when entering a new decision phase
if (['quiz', 'placement', 'veto_window', 'veto_placement'].includes(newPhase)) {
  this.clearTeammateVotes();
}
```

**Step 3: Add test**

```typescript
it('should clear teammate votes when phase changes', async () => {
  // Submit a vote
  await game.handleQuizSuggestion('session-2', { artistIndex: 1, titleIndex: 2 });

  // Transition phase
  await game.transitionToPhase('placement');

  // Vote should be cleared (next vote message should show empty state)
  // This can be verified by checking the leader receives an empty state
});
```

**Step 4: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): clear teammate votes between phases"
```

---

## Task 20: Handle State Sync with Leader Info

**Files:**
- Modify: `packages/backend/src/game.ts`

**Step 1: Ensure state_sync includes isTeamLeader**

Verify that when `state_sync` is sent, the Player objects include `isTeamLeader`. This should work automatically since we added it to the Player interface, but verify:

```typescript
// In broadcast of state_sync
this.broadcast({
  type: 'state_sync',
  payload: {
    state: this.state,  // This should include isTeamLeader on each player
  },
});
```

**Step 2: Add test for state sync**

```typescript
it('should include isTeamLeader in state sync', async () => {
  await game.handleJoin({ name: 'Alice', sessionId: 'session-1' }, ws);
  await game.handleClaimTeamLeader('session-1');

  // Trigger a state sync (reconnect or new join)
  await game.handleJoin({ name: 'Bob', sessionId: 'session-2' }, ws2);

  expect(ws2.send).toHaveBeenCalledWith(
    expect.stringMatching(/"isTeamLeader":true/)
  );
});
```

**Step 3: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-leader.test.ts
git commit -m "feat(backend): ensure state sync includes leader info"
```

---

## Task 21: Final Integration Test

**Files:**
- Test: `packages/backend/src/__tests__/team-leader-integration.test.ts`

**Step 1: Create comprehensive integration test**

```typescript
describe('Team Leader Integration', () => {
  it('should complete full game flow with team leaders', async () => {
    // 1. Two players join each team
    // 2. One player per team claims leader
    // 3. Game starts
    // 4. During quiz:
    //    - Non-leaders submit suggestions
    //    - Leaders receive suggestions
    //    - Leaders submit final answers
    // 5. During placement:
    //    - Non-leaders submit position suggestions
    //    - Leaders receive suggestions
    //    - Leaders submit final placement
    // 6. During veto:
    //    - Non-leaders submit veto suggestions
    //    - Leaders receive suggestions
    //    - Leaders make final veto decision
    // 7. Verify scoring/state is correct
  });
});
```

**Step 2: Run all tests**

```bash
npm run --workspaces test
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/backend/src/__tests__/team-leader-integration.test.ts
git commit -m "test(backend): add team leader integration tests"
```

---

## Summary

**Total Tasks:** 21

**Backend Tasks (1-9, 19-21):** 12 tasks
- Types and messages
- Player creation
- Claim handler
- Auto-assign on start
- Disconnect handling
- Teammate vote broadcasting
- Leader-only enforcement
- Phase vote clearing
- Integration tests

**Player App Tasks (10-16):** 7 tasks
- PlayerStatusRow component
- Lobby leader claim button
- TeamVotesPanel (quiz)
- PlacementSuggestionsPanel
- VetoSuggestionsPanel
- Non-leader suggestion sending

**Host App Tasks (17-18):** 2 tasks
- Lobby roster crown
- Gameplay scoreboard crown
