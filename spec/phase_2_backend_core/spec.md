# Phase 2: Backend Core - Implementation Spec

## Overview

This phase implements the Game Durable Object that manages game state and WebSocket connections. All tasks follow TDD methodology.

**Prerequisites**: Phase 1 complete (monorepo structure, shared types package)

---

## Task backend-001: Implement Game Durable Object class with WebSocket handling

**Files:**
- Create: `packages/backend/src/game.ts`
- Modify: `packages/backend/src/index.ts`
- Test: `packages/backend/src/__tests__/game.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/game.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Game } from '../game';

describe('Game Durable Object', () => {
  it('should accept WebSocket upgrade requests', async () => {
    const mockState = {
      storage: {
        get: vi.fn(),
        put: vi.fn(),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    const mockEnv = {};

    const game = new Game(mockState as any, mockEnv);

    const request = new Request('https://example.com/ws', {
      headers: {
        Upgrade: 'websocket',
      },
    });

    const response = await game.fetch(request);

    expect(response.status).toBe(101);
    expect(mockState.acceptWebSocket).toHaveBeenCalled();
  });

  it('should return 426 for non-WebSocket requests to /ws', async () => {
    const mockState = {
      storage: { get: vi.fn(), put: vi.fn() },
      getWebSockets: vi.fn().mockReturnValue([]),
    };
    const mockEnv = {};

    const game = new Game(mockState as any, mockEnv);

    const request = new Request('https://example.com/ws');
    const response = await game.fetch(request);

    expect(response.status).toBe(426);
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- game.test.ts
```

Expected: FAIL with "Cannot find module '../game'"

**Step 3: Implement**

```typescript
// packages/backend/src/game.ts
import { DurableObject } from 'cloudflare:workers';

export interface GameEnv {
  GAME: DurableObjectNamespace;
}

export class Game extends DurableObject {
  private connections: Map<WebSocket, { playerId?: string }> = new Map();

  constructor(state: DurableObjectState, env: GameEnv) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws' || request.headers.get('Upgrade') === 'websocket') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.connections.set(server, {});

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Will be implemented in backend-005
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
    console.log('Received message:', data);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.connections.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    this.connections.delete(ws);
  }
}
```

```typescript
// packages/backend/src/index.ts (add export)
export { Game } from './game';
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- game.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/game.test.ts packages/backend/src/index.ts
git commit -m "feat(backend): implement Game Durable Object with WebSocket handling"
```

---

## Task backend-002: Create game state management with lobby, playing, finished states

**Files:**
- Modify: `packages/backend/src/game.ts`
- Modify: `packages/shared/src/types.ts`
- Test: `packages/backend/src/__tests__/game-state.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/game-state.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

describe('Game State Management', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(() => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
  });

  it('should initialize with lobby status', async () => {
    await game.initialize('ABCD', 'classic');

    const state = game.getState();
    expect(state.status).toBe('lobby');
    expect(state.joinCode).toBe('ABCD');
    expect(state.mode).toBe('classic');
  });

  it('should transition from lobby to playing', async () => {
    await game.initialize('ABCD', 'classic');

    const result = await game.transitionTo('playing');

    expect(result.success).toBe(true);
    expect(game.getState().status).toBe('playing');
  });

  it('should transition from playing to finished', async () => {
    await game.initialize('ABCD', 'classic');
    await game.transitionTo('playing');

    const result = await game.transitionTo('finished');

    expect(result.success).toBe(true);
    expect(game.getState().status).toBe('finished');
  });

  it('should reject invalid transitions', async () => {
    await game.initialize('ABCD', 'classic');

    const result = await game.transitionTo('finished');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid state transition: lobby -> finished');
  });

  it('should persist state to storage', async () => {
    await game.initialize('ABCD', 'classic');

    expect(mockState.storage.put).toHaveBeenCalledWith(
      'gameState',
      expect.objectContaining({ joinCode: 'ABCD', status: 'lobby' })
    );
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- game-state.test.ts
```

Expected: FAIL with "game.initialize is not a function"

**Step 3: Implement**

```typescript
// packages/shared/src/types.ts (add/update)
export type GameStatus = 'lobby' | 'playing' | 'finished';
export type GameMode = 'classic' | 'custom';

export interface GameSettings {
  targetScore: number;
  guessTimeSeconds: number;
  vetoWindowSeconds: number;
}

export interface Team {
  name: string;
  players: Player[];
  timeline: TimelineSong[];
  vetoTokens: number;
  score: number;
}

export interface Player {
  id: string;
  name: string;
  sessionId: string;
  connected: boolean;
  lastSeen: number;
}

export interface TimelineSong {
  id: string;
  title: string;
  artist: string;
  year: number;
  addedAt: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  spotifyUri: string;
  spotifyUrl: string;
}

export interface GameState {
  id: string;
  joinCode: string;
  status: GameStatus;
  mode: GameMode;
  settings: GameSettings;
  teams: {
    A: Team;
    B: Team;
  };
  currentRound: Round | null;
  songPool: Song[];
  playedSongs: Song[];
  createdAt: number;
  lastActivityAt: number;
}

export interface Round {
  song: Song;
  activeTeam: 'A' | 'B';
  phase: 'guessing' | 'veto_window' | 'reveal';
  startedAt: number;
  currentAnswer: Answer | null;
  vetoChallenge: VetoChallenge | null;
}

export interface Answer {
  artist: string;
  title: string;
  year: number;
  submittedBy: string;
  submittedAt: number;
}

export interface VetoChallenge {
  challengedField: 'artist' | 'title' | 'year';
  challengingTeam: 'A' | 'B';
}
```

```typescript
// packages/backend/src/game.ts (update)
import { DurableObject } from 'cloudflare:workers';
import type { GameState, GameStatus, GameMode, GameSettings, Team } from '@party-popper/shared';

export interface GameEnv {
  GAME: DurableObjectNamespace;
}

const DEFAULT_SETTINGS: GameSettings = {
  targetScore: 10,
  guessTimeSeconds: 60,
  vetoWindowSeconds: 15,
};

const VALID_TRANSITIONS: Record<GameStatus, GameStatus[]> = {
  lobby: ['playing'],
  playing: ['finished'],
  finished: [],
};

function createEmptyTeam(name: string): Team {
  return {
    name,
    players: [],
    timeline: [],
    vetoTokens: 3,
    score: 0,
  };
}

export class Game extends DurableObject {
  private connections: Map<WebSocket, { playerId?: string }> = new Map();
  private state: GameState | null = null;

  constructor(state: DurableObjectState, env: GameEnv) {
    super(state, env);
  }

  async initialize(joinCode: string, mode: GameMode): Promise<void> {
    this.state = {
      id: crypto.randomUUID(),
      joinCode,
      status: 'lobby',
      mode,
      settings: { ...DEFAULT_SETTINGS },
      teams: {
        A: createEmptyTeam('Team A'),
        B: createEmptyTeam('Team B'),
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await this.persistState();
  }

  getState(): GameState {
    if (!this.state) {
      throw new Error('Game not initialized');
    }
    return this.state;
  }

  async transitionTo(newStatus: GameStatus): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: 'Game not initialized' };
    }

    const currentStatus = this.state.status;
    const validNextStates = VALID_TRANSITIONS[currentStatus];

    if (!validNextStates.includes(newStatus)) {
      return { success: false, error: `Invalid state transition: ${currentStatus} -> ${newStatus}` };
    }

    this.state.status = newStatus;
    this.state.lastActivityAt = Date.now();
    await this.persistState();

    return { success: true };
  }

  private async persistState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put('gameState', this.state);
    }
  }

  private async loadState(): Promise<void> {
    const stored = await this.ctx.storage.get<GameState>('gameState');
    if (stored) {
      this.state = stored;
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Load state if not already loaded
    if (!this.state) {
      await this.loadState();
    }

    const url = new URL(request.url);

    if (url.pathname === '/ws' || request.headers.get('Upgrade') === 'websocket') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.connections.set(server, {});

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
    console.log('Received message:', data);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.connections.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    this.connections.delete(ws);
  }
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- game-state.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/backend/src/game.ts packages/backend/src/__tests__/game-state.test.ts
git commit -m "feat(backend): add game state management with lobby/playing/finished transitions"
```

---

## Task backend-003: Implement REST endpoints for game creation and info

**Files:**
- Create: `packages/backend/src/router.ts`
- Modify: `packages/backend/src/index.ts`
- Test: `packages/backend/src/__tests__/api.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../router';

describe('REST API', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      GAME: {
        idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-id' }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ joinCode: 'ABCD' }))),
        }),
      },
      GAME_CODES: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it('POST /api/games should create a new game', async () => {
    const request = new Request('https://example.com/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic' }),
    });

    const response = await handleRequest(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toHaveProperty('joinCode');
    expect(body.joinCode).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('GET /api/games/:code should return game info', async () => {
    mockEnv.GAME_CODES.get.mockResolvedValue('mock-game-id');
    mockEnv.GAME.get.mockReturnValue({
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          joinCode: 'ABCD',
          status: 'lobby',
          playerCount: 3,
        }))
      ),
    });

    const request = new Request('https://example.com/api/games/ABCD', {
      method: 'GET',
    });

    const response = await handleRequest(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.joinCode).toBe('ABCD');
    expect(body.status).toBe('lobby');
  });

  it('GET /api/games/:code should return 404 for invalid code', async () => {
    mockEnv.GAME_CODES.get.mockResolvedValue(null);

    const request = new Request('https://example.com/api/games/ZZZZ', {
      method: 'GET',
    });

    const response = await handleRequest(request, mockEnv);

    expect(response.status).toBe(404);
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- api.test.ts
```

Expected: FAIL with "Cannot find module '../router'"

**Step 3: Implement**

```typescript
// packages/backend/src/router.ts
import { generateJoinCode } from './utils/join-code';

export interface Env {
  GAME: DurableObjectNamespace;
  GAME_CODES: KVNamespace;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // POST /api/games - Create new game
    if (path === '/api/games' && request.method === 'POST') {
      const body = await request.json() as { mode?: 'classic' | 'custom' };
      const mode = body.mode || 'classic';

      // Generate unique join code
      const joinCode = await generateJoinCode(env.GAME_CODES);

      // Create Durable Object for this game
      const gameId = env.GAME.idFromName(joinCode);
      const gameStub = env.GAME.get(gameId);

      // Initialize the game
      await gameStub.fetch(new Request('https://internal/initialize', {
        method: 'POST',
        body: JSON.stringify({ joinCode, mode }),
      }));

      // Store code -> game ID mapping
      await env.GAME_CODES.put(joinCode, gameId.toString(), { expirationTtl: 86400 });

      return new Response(
        JSON.stringify({ joinCode, gameId: gameId.toString() }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // GET /api/games/:code - Get game info
    const gameInfoMatch = path.match(/^\/api\/games\/([A-Z0-9]{4})$/);
    if (gameInfoMatch && request.method === 'GET') {
      const joinCode = gameInfoMatch[1];

      // Look up game ID from code
      const gameIdStr = await env.GAME_CODES.get(joinCode);
      if (!gameIdStr) {
        return new Response(
          JSON.stringify({ error: 'Game not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get game info from Durable Object
      const gameId = env.GAME.idFromString(gameIdStr);
      const gameStub = env.GAME.get(gameId);

      const response = await gameStub.fetch(new Request('https://internal/info'));
      const gameInfo = await response.json();

      return new Response(
        JSON.stringify(gameInfo),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
```

```typescript
// packages/backend/src/utils/join-code.ts
const VALID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, L, 1

export async function generateJoinCode(kv: KVNamespace, maxAttempts = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * VALID_CHARS.length);
      code += VALID_CHARS[randomIndex];
    }

    // Check for collision
    const existing = await kv.get(code);
    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique join code after max attempts');
}
```

```typescript
// packages/backend/src/index.ts (update)
import { handleRequest, Env } from './router';
export { Game } from './game';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
```

Also update `packages/backend/src/game.ts` to handle the `/initialize` and `/info` endpoints:

```typescript
// Add to Game.fetch method in packages/backend/src/game.ts
async fetch(request: Request): Promise<Response> {
  if (!this.state) {
    await this.loadState();
  }

  const url = new URL(request.url);

  // Internal: Initialize game
  if (url.pathname === '/initialize' && request.method === 'POST') {
    const body = await request.json() as { joinCode: string; mode: 'classic' | 'custom' };
    await this.initialize(body.joinCode, body.mode);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Internal: Get game info
  if (url.pathname === '/info' && request.method === 'GET') {
    if (!this.state) {
      return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 });
    }
    return new Response(JSON.stringify({
      joinCode: this.state.joinCode,
      status: this.state.status,
      mode: this.state.mode,
      playerCount: this.state.teams.A.players.length + this.state.teams.B.players.length,
      teams: {
        A: { name: this.state.teams.A.name, playerCount: this.state.teams.A.players.length },
        B: { name: this.state.teams.B.name, playerCount: this.state.teams.B.players.length },
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // WebSocket upgrade
  if (url.pathname === '/ws' || request.headers.get('Upgrade') === 'websocket') {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.connections.set(server, {});

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  return new Response('Not found', { status: 404 });
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- api.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/router.ts packages/backend/src/utils/join-code.ts packages/backend/src/index.ts packages/backend/src/game.ts packages/backend/src/__tests__/api.test.ts
git commit -m "feat(backend): add REST endpoints for game creation and info retrieval"
```

---

## Task backend-004: Implement join code generation (4-char alphanumeric, collision-safe)

**Files:**
- Modify: `packages/backend/src/utils/join-code.ts`
- Test: `packages/backend/src/__tests__/join-code.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/join-code.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateJoinCode, isValidJoinCode, VALID_CHARS } from '../utils/join-code';

describe('Join Code Generation', () => {
  it('should generate 4-character codes', async () => {
    const mockKv = { get: vi.fn().mockResolvedValue(null) };
    const code = await generateJoinCode(mockKv as any);
    expect(code).toHaveLength(4);
  });

  it('should only use valid characters (excludes 0, O, I, L, 1)', async () => {
    const mockKv = { get: vi.fn().mockResolvedValue(null) };

    for (let i = 0; i < 100; i++) {
      const code = await generateJoinCode(mockKv as any);
      expect(code).not.toMatch(/[0OIL1]/);
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
    }
  });

  it('should check for collisions and retry', async () => {
    const mockKv = {
      get: vi.fn()
        .mockResolvedValueOnce('existing-game-id')
        .mockResolvedValueOnce('existing-game-id')
        .mockResolvedValueOnce(null),
    };

    const code = await generateJoinCode(mockKv as any);

    expect(mockKv.get).toHaveBeenCalledTimes(3);
    expect(code).toHaveLength(4);
  });

  it('should throw after max attempts', async () => {
    const mockKv = {
      get: vi.fn().mockResolvedValue('always-exists'),
    };

    await expect(generateJoinCode(mockKv as any, 5)).rejects.toThrow(
      'Failed to generate unique join code after max attempts'
    );
    expect(mockKv.get).toHaveBeenCalledTimes(5);
  });

  it('should validate join code format', () => {
    expect(isValidJoinCode('ABCD')).toBe(true);
    expect(isValidJoinCode('AB12')).toBe(true);
    expect(isValidJoinCode('abcd')).toBe(false); // lowercase
    expect(isValidJoinCode('ABC')).toBe(false);  // too short
    expect(isValidJoinCode('ABCDE')).toBe(false); // too long
    expect(isValidJoinCode('AB0D')).toBe(false);  // contains 0
    expect(isValidJoinCode('ABOD')).toBe(false);  // contains O
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- join-code.test.ts
```

Expected: FAIL with "isValidJoinCode is not exported"

**Step 3: Implement**

```typescript
// packages/backend/src/utils/join-code.ts (complete implementation)
export const VALID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, L, 1
const VALID_CHARS_SET = new Set(VALID_CHARS.split(''));

export async function generateJoinCode(kv: KVNamespace, maxAttempts = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    const randomValues = new Uint8Array(4);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < 4; i++) {
      const randomIndex = randomValues[i] % VALID_CHARS.length;
      code += VALID_CHARS[randomIndex];
    }

    // Check for collision
    const existing = await kv.get(code);
    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique join code after max attempts');
}

export function isValidJoinCode(code: string): boolean {
  if (code.length !== 4) {
    return false;
  }

  for (const char of code) {
    if (!VALID_CHARS_SET.has(char)) {
      return false;
    }
  }

  return true;
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- join-code.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/utils/join-code.ts packages/backend/src/__tests__/join-code.test.ts
git commit -m "feat(backend): implement collision-safe join code generation with validation"
```

---

## Task backend-005: Build WebSocket message router with type-safe handlers

**Files:**
- Create: `packages/backend/src/message-router.ts`
- Create: `packages/shared/src/messages.ts`
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/message-router.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/message-router.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MessageRouter, MessageHandler } from '../message-router';
import type { ClientMessage, ServerMessage } from '@party-popper/shared';

describe('WebSocket Message Router', () => {
  it('should route messages to correct handlers', () => {
    const router = new MessageRouter();
    const joinHandler = vi.fn();

    router.on('join', joinHandler);

    const message: ClientMessage = {
      type: 'join',
      payload: { playerName: 'Alice', sessionId: 'session-123' },
    };

    router.handle(message, {} as WebSocket);

    expect(joinHandler).toHaveBeenCalledWith(
      { playerName: 'Alice', sessionId: 'session-123' },
      expect.any(Object)
    );
  });

  it('should return error for unknown message types', () => {
    const router = new MessageRouter();
    const errorHandler = vi.fn();

    router.onError(errorHandler);

    const message = { type: 'unknown_type', payload: {} } as any;
    router.handle(message, {} as WebSocket);

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNKNOWN_MESSAGE_TYPE' }),
      expect.any(Object)
    );
  });

  it('should parse string messages as JSON', () => {
    const router = new MessageRouter();
    const joinHandler = vi.fn();

    router.on('join', joinHandler);

    const messageStr = JSON.stringify({
      type: 'join',
      payload: { playerName: 'Bob', sessionId: 'session-456' },
    });

    router.handleRaw(messageStr, {} as WebSocket);

    expect(joinHandler).toHaveBeenCalled();
  });

  it('should handle JSON parse errors', () => {
    const router = new MessageRouter();
    const errorHandler = vi.fn();

    router.onError(errorHandler);
    router.handleRaw('not valid json', {} as WebSocket);

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_JSON' }),
      expect.any(Object)
    );
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- message-router.test.ts
```

Expected: FAIL with "Cannot find module '../message-router'"

**Step 3: Implement**

```typescript
// packages/shared/src/messages.ts
export type ClientMessageType =
  | 'join'
  | 'leave'
  | 'reconnect'
  | 'start_game'
  | 'submit_answer'
  | 'use_veto'
  | 'typing'
  | 'next_round'
  | 'reassign_team'
  | 'update_settings'
  | 'pong';

export type ServerMessageType =
  | 'state_sync'
  | 'state_delta'
  | 'player_joined'
  | 'player_left'
  | 'round_started'
  | 'typing_update'
  | 'answer_submitted'
  | 'veto_initiated'
  | 'round_result'
  | 'game_over'
  | 'error'
  | 'ping';

export interface JoinPayload {
  playerName: string;
  sessionId: string;
  team?: 'A' | 'B';
}

export interface ReconnectPayload {
  sessionId: string;
}

export interface SubmitAnswerPayload {
  artist: string;
  title: string;
  year: number;
}

export interface UseVetoPayload {
  field: 'artist' | 'title' | 'year';
}

export interface TypingPayload {
  field: 'artist' | 'title' | 'year';
  value: string;
}

export interface ReassignTeamPayload {
  playerId: string;
  team: 'A' | 'B';
}

export interface UpdateSettingsPayload {
  targetScore?: number;
  mode?: 'classic' | 'custom';
}

export type ClientMessage =
  | { type: 'join'; payload: JoinPayload }
  | { type: 'leave'; payload: Record<string, never> }
  | { type: 'reconnect'; payload: ReconnectPayload }
  | { type: 'start_game'; payload: Record<string, never> }
  | { type: 'submit_answer'; payload: SubmitAnswerPayload }
  | { type: 'use_veto'; payload: UseVetoPayload }
  | { type: 'typing'; payload: TypingPayload }
  | { type: 'next_round'; payload: Record<string, never> }
  | { type: 'reassign_team'; payload: ReassignTeamPayload }
  | { type: 'update_settings'; payload: UpdateSettingsPayload }
  | { type: 'pong'; payload: Record<string, never> };

export interface ErrorPayload {
  code: string;
  message: string;
}

export type ServerMessage =
  | { type: 'state_sync'; payload: unknown }
  | { type: 'state_delta'; payload: unknown }
  | { type: 'player_joined'; payload: unknown }
  | { type: 'player_left'; payload: { playerId: string } }
  | { type: 'round_started'; payload: unknown }
  | { type: 'typing_update'; payload: unknown }
  | { type: 'answer_submitted'; payload: unknown }
  | { type: 'veto_initiated'; payload: unknown }
  | { type: 'round_result'; payload: unknown }
  | { type: 'game_over'; payload: unknown }
  | { type: 'error'; payload: ErrorPayload }
  | { type: 'ping'; payload: Record<string, never> };
```

```typescript
// packages/backend/src/message-router.ts
import type { ClientMessage, ClientMessageType, ErrorPayload } from '@party-popper/shared';

export type MessageHandler<T = unknown> = (payload: T, ws: WebSocket) => void | Promise<void>;
export type ErrorHandler = (error: ErrorPayload, ws: WebSocket) => void | Promise<void>;

export class MessageRouter {
  private handlers: Map<ClientMessageType, MessageHandler> = new Map();
  private errorHandler: ErrorHandler = () => {};

  on<K extends ClientMessageType>(
    type: K,
    handler: MessageHandler<Extract<ClientMessage, { type: K }>['payload']>
  ): void {
    this.handlers.set(type, handler as MessageHandler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  handleRaw(data: string | ArrayBuffer, ws: WebSocket): void {
    const messageStr = typeof data === 'string' ? data : new TextDecoder().decode(data);

    let message: ClientMessage;
    try {
      message = JSON.parse(messageStr);
    } catch {
      this.errorHandler({ code: 'INVALID_JSON', message: 'Failed to parse message as JSON' }, ws);
      return;
    }

    this.handle(message, ws);
  }

  handle(message: ClientMessage, ws: WebSocket): void {
    const handler = this.handlers.get(message.type);

    if (!handler) {
      this.errorHandler(
        { code: 'UNKNOWN_MESSAGE_TYPE', message: `Unknown message type: ${message.type}` },
        ws
      );
      return;
    }

    try {
      handler(message.payload, ws);
    } catch (error) {
      this.errorHandler(
        { code: 'HANDLER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
        ws
      );
    }
  }
}
```

```typescript
// packages/shared/src/index.ts (add export)
export * from './types';
export * from './messages';
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- message-router.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/messages.ts packages/shared/src/index.ts packages/backend/src/message-router.ts packages/backend/src/__tests__/message-router.test.ts
git commit -m "feat(backend): add type-safe WebSocket message router"
```

---

## Task backend-006: Implement player join/leave logic with session tracking

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/player-management.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/player-management.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

describe('Player Management', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(async () => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
    await game.initialize('ABCD', 'classic');
  });

  it('should add player on join', async () => {
    const mockWs = { send: vi.fn() };

    await game.handleJoin(
      { playerName: 'Alice', sessionId: 'session-123' },
      mockWs as any
    );

    const state = game.getState();
    const allPlayers = [...state.teams.A.players, ...state.teams.B.players];

    expect(allPlayers).toHaveLength(1);
    expect(allPlayers[0].name).toBe('Alice');
    expect(allPlayers[0].sessionId).toBe('session-123');
    expect(allPlayers[0].connected).toBe(true);
  });

  it('should track player session ID', async () => {
    const mockWs = { send: vi.fn() };

    await game.handleJoin(
      { playerName: 'Bob', sessionId: 'unique-session-456' },
      mockWs as any
    );

    const player = game.findPlayerBySession('unique-session-456');
    expect(player).toBeDefined();
    expect(player?.name).toBe('Bob');
  });

  it('should remove player on leave', async () => {
    const mockWs = { send: vi.fn() };

    await game.handleJoin(
      { playerName: 'Charlie', sessionId: 'session-789' },
      mockWs as any
    );

    await game.handleLeave(mockWs as any);

    const state = game.getState();
    const allPlayers = [...state.teams.A.players, ...state.teams.B.players];

    expect(allPlayers).toHaveLength(0);
  });

  it('should mark player disconnected on WebSocket close', async () => {
    const mockWs = { send: vi.fn() };

    await game.handleJoin(
      { playerName: 'Dana', sessionId: 'session-abc' },
      mockWs as any
    );

    await game.handleDisconnect(mockWs as any);

    const player = game.findPlayerBySession('session-abc');
    expect(player?.connected).toBe(false);
    expect(player?.lastSeen).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- player-management.test.ts
```

Expected: FAIL with "game.handleJoin is not a function"

**Step 3: Implement**

```typescript
// packages/backend/src/game.ts (add player management methods)
import type {
  GameState, GameStatus, GameMode, Player, JoinPayload
} from '@party-popper/shared';

// Add to class properties
private wsToPlayer: Map<WebSocket, string> = new Map(); // ws -> sessionId

// Add these methods to the Game class

async handleJoin(payload: JoinPayload, ws: WebSocket): Promise<void> {
  if (!this.state) {
    throw new Error('Game not initialized');
  }

  const { playerName, sessionId, team } = payload;

  // Check if player with this session already exists (reconnection case)
  const existingPlayer = this.findPlayerBySession(sessionId);
  if (existingPlayer) {
    existingPlayer.connected = true;
    existingPlayer.lastSeen = Date.now();
    this.wsToPlayer.set(ws, sessionId);
    this.connections.set(ws, { playerId: existingPlayer.id });
    await this.persistState();
    return;
  }

  // Create new player
  const player: Player = {
    id: crypto.randomUUID(),
    name: playerName,
    sessionId,
    connected: true,
    lastSeen: Date.now(),
  };

  // Assign to team
  const targetTeam = team || this.getTeamWithFewerPlayers();
  this.state.teams[targetTeam].players.push(player);

  // Track connection
  this.wsToPlayer.set(ws, sessionId);
  this.connections.set(ws, { playerId: player.id });

  this.state.lastActivityAt = Date.now();
  await this.persistState();
}

async handleLeave(ws: WebSocket): Promise<void> {
  if (!this.state) return;

  const sessionId = this.wsToPlayer.get(ws);
  if (!sessionId) return;

  // Remove player from team
  for (const teamKey of ['A', 'B'] as const) {
    const team = this.state.teams[teamKey];
    const index = team.players.findIndex(p => p.sessionId === sessionId);
    if (index !== -1) {
      team.players.splice(index, 1);
      break;
    }
  }

  this.wsToPlayer.delete(ws);
  this.connections.delete(ws);
  this.state.lastActivityAt = Date.now();
  await this.persistState();
}

async handleDisconnect(ws: WebSocket): Promise<void> {
  if (!this.state) return;

  const sessionId = this.wsToPlayer.get(ws);
  if (!sessionId) return;

  const player = this.findPlayerBySession(sessionId);
  if (player) {
    player.connected = false;
    player.lastSeen = Date.now();
  }

  this.wsToPlayer.delete(ws);
  this.connections.delete(ws);
  await this.persistState();
}

findPlayerBySession(sessionId: string): Player | undefined {
  if (!this.state) return undefined;

  for (const teamKey of ['A', 'B'] as const) {
    const player = this.state.teams[teamKey].players.find(p => p.sessionId === sessionId);
    if (player) return player;
  }
  return undefined;
}

private getTeamWithFewerPlayers(): 'A' | 'B' {
  if (!this.state) return 'A';

  const teamACount = this.state.teams.A.players.length;
  const teamBCount = this.state.teams.B.players.length;

  return teamACount <= teamBCount ? 'A' : 'B';
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- player-management.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/player-management.test.ts
git commit -m "feat(backend): implement player join/leave logic with session tracking"
```

---

## Task backend-007: Implement team assignment (auto-assign and manual reassign)

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/team-assignment.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/team-assignment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

describe('Team Assignment', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(async () => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
    await game.initialize('ABCD', 'classic');
  });

  it('should auto-assign first player to Team A', async () => {
    const mockWs = { send: vi.fn() };

    await game.handleJoin(
      { playerName: 'Player1', sessionId: 's1' },
      mockWs as any
    );

    const state = game.getState();
    expect(state.teams.A.players).toHaveLength(1);
    expect(state.teams.B.players).toHaveLength(0);
  });

  it('should auto-assign second player to Team B for balance', async () => {
    const mockWs1 = { send: vi.fn() };
    const mockWs2 = { send: vi.fn() };

    await game.handleJoin({ playerName: 'Player1', sessionId: 's1' }, mockWs1 as any);
    await game.handleJoin({ playerName: 'Player2', sessionId: 's2' }, mockWs2 as any);

    const state = game.getState();
    expect(state.teams.A.players).toHaveLength(1);
    expect(state.teams.B.players).toHaveLength(1);
  });

  it('should allow joining specific team', async () => {
    const mockWs = { send: vi.fn() };

    await game.handleJoin(
      { playerName: 'Player1', sessionId: 's1', team: 'B' },
      mockWs as any
    );

    const state = game.getState();
    expect(state.teams.A.players).toHaveLength(0);
    expect(state.teams.B.players).toHaveLength(1);
  });

  it('should reassign player between teams', async () => {
    const mockWs = { send: vi.fn() };

    await game.handleJoin({ playerName: 'Player1', sessionId: 's1' }, mockWs as any);

    const state = game.getState();
    const playerId = state.teams.A.players[0].id;

    const result = await game.reassignTeam(playerId, 'B');

    expect(result.success).toBe(true);
    expect(game.getState().teams.A.players).toHaveLength(0);
    expect(game.getState().teams.B.players).toHaveLength(1);
  });

  it('should enforce max 5 players per team', async () => {
    // Add 5 players to Team A
    for (let i = 0; i < 5; i++) {
      const mockWs = { send: vi.fn() };
      await game.handleJoin(
        { playerName: `Player${i}`, sessionId: `s${i}`, team: 'A' },
        mockWs as any
      );
    }

    // Try to add 6th player to Team A
    const mockWs6 = { send: vi.fn() };
    await game.handleJoin(
      { playerName: 'Player6', sessionId: 's6', team: 'A' },
      mockWs6 as any
    );

    const state = game.getState();
    // Should be assigned to Team B instead
    expect(state.teams.A.players).toHaveLength(5);
    expect(state.teams.B.players).toHaveLength(1);
  });

  it('should return error when reassigning to full team', async () => {
    // Fill Team B
    for (let i = 0; i < 5; i++) {
      const mockWs = { send: vi.fn() };
      await game.handleJoin(
        { playerName: `BPlayer${i}`, sessionId: `b${i}`, team: 'B' },
        mockWs as any
      );
    }

    // Add player to Team A
    const mockWs = { send: vi.fn() };
    await game.handleJoin({ playerName: 'APlayer', sessionId: 'a1' }, mockWs as any);
    const playerId = game.getState().teams.A.players[0].id;

    // Try to reassign to full Team B
    const result = await game.reassignTeam(playerId, 'B');

    expect(result.success).toBe(false);
    expect(result.error).toContain('full');
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- team-assignment.test.ts
```

Expected: FAIL with "game.reassignTeam is not a function"

**Step 3: Implement**

```typescript
// packages/backend/src/game.ts (add/update team assignment methods)

const MAX_PLAYERS_PER_TEAM = 5;

// Update handleJoin to respect team limits
async handleJoin(payload: JoinPayload, ws: WebSocket): Promise<void> {
  if (!this.state) {
    throw new Error('Game not initialized');
  }

  const { playerName, sessionId, team: requestedTeam } = payload;

  // Check if player with this session already exists (reconnection case)
  const existingPlayer = this.findPlayerBySession(sessionId);
  if (existingPlayer) {
    existingPlayer.connected = true;
    existingPlayer.lastSeen = Date.now();
    this.wsToPlayer.set(ws, sessionId);
    this.connections.set(ws, { playerId: existingPlayer.id });
    await this.persistState();
    return;
  }

  // Create new player
  const player: Player = {
    id: crypto.randomUUID(),
    name: playerName,
    sessionId,
    connected: true,
    lastSeen: Date.now(),
  };

  // Determine target team
  let targetTeam: 'A' | 'B';
  if (requestedTeam && this.state.teams[requestedTeam].players.length < MAX_PLAYERS_PER_TEAM) {
    targetTeam = requestedTeam;
  } else {
    targetTeam = this.getAvailableTeam();
  }

  this.state.teams[targetTeam].players.push(player);

  // Track connection
  this.wsToPlayer.set(ws, sessionId);
  this.connections.set(ws, { playerId: player.id });

  this.state.lastActivityAt = Date.now();
  await this.persistState();
}

async reassignTeam(
  playerId: string,
  targetTeam: 'A' | 'B'
): Promise<{ success: boolean; error?: string }> {
  if (!this.state) {
    return { success: false, error: 'Game not initialized' };
  }

  // Check target team capacity
  if (this.state.teams[targetTeam].players.length >= MAX_PLAYERS_PER_TEAM) {
    return { success: false, error: `Team ${targetTeam} is full (max ${MAX_PLAYERS_PER_TEAM} players)` };
  }

  // Find player in current team
  let player: Player | undefined;
  let sourceTeam: 'A' | 'B' | undefined;

  for (const teamKey of ['A', 'B'] as const) {
    const index = this.state.teams[teamKey].players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      player = this.state.teams[teamKey].players[index];
      sourceTeam = teamKey;
      this.state.teams[teamKey].players.splice(index, 1);
      break;
    }
  }

  if (!player || !sourceTeam) {
    return { success: false, error: 'Player not found' };
  }

  if (sourceTeam === targetTeam) {
    // Put player back if same team
    this.state.teams[sourceTeam].players.push(player);
    return { success: false, error: 'Player already on this team' };
  }

  // Add to target team
  this.state.teams[targetTeam].players.push(player);
  this.state.lastActivityAt = Date.now();
  await this.persistState();

  return { success: true };
}

private getAvailableTeam(): 'A' | 'B' {
  if (!this.state) return 'A';

  const teamA = this.state.teams.A;
  const teamB = this.state.teams.B;

  // If Team A is full, use B
  if (teamA.players.length >= MAX_PLAYERS_PER_TEAM) return 'B';
  // If Team B is full, use A
  if (teamB.players.length >= MAX_PLAYERS_PER_TEAM) return 'A';
  // Otherwise, balance teams
  return teamA.players.length <= teamB.players.length ? 'A' : 'B';
}

private getTeamWithFewerPlayers(): 'A' | 'B' {
  return this.getAvailableTeam();
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- team-assignment.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/team-assignment.test.ts
git commit -m "feat(backend): implement team auto-assignment and manual reassignment with 5-player limit"
```

---

## Task backend-008: Build state broadcast mechanism with full sync and delta updates

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/broadcast.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/broadcast.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

describe('State Broadcast', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(async () => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
    await game.initialize('ABCD', 'classic');
  });

  it('should send STATE_SYNC to new player on connect', async () => {
    const mockWs = {
      send: vi.fn(),
      readyState: 1, // OPEN
    };

    await game.handleJoin(
      { playerName: 'Alice', sessionId: 'session-123' },
      mockWs as any
    );

    await game.sendStateSync(mockWs as any);

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"state_sync"')
    );

    const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sentMessage.payload).toHaveProperty('joinCode', 'ABCD');
    expect(sentMessage.payload).toHaveProperty('status', 'lobby');
  });

  it('should broadcast STATE_DELTA to all connected clients', async () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 };
    const mockWs2 = { send: vi.fn(), readyState: 1 };

    await game.handleJoin({ playerName: 'Alice', sessionId: 's1' }, mockWs1 as any);
    await game.handleJoin({ playerName: 'Bob', sessionId: 's2' }, mockWs2 as any);

    // Simulate a state change
    await game.broadcastDelta({ type: 'player_joined', player: { name: 'Charlie' } });

    expect(mockWs1.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"state_delta"')
    );
    expect(mockWs2.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"state_delta"')
    );
  });

  it('should not send to disconnected WebSockets', async () => {
    const mockWsOpen = { send: vi.fn(), readyState: 1 }; // OPEN
    const mockWsClosed = { send: vi.fn(), readyState: 3 }; // CLOSED

    await game.handleJoin({ playerName: 'Alice', sessionId: 's1' }, mockWsOpen as any);
    // Manually add closed ws to simulate edge case
    game['connections'].set(mockWsClosed as any, { playerId: 'p2' });

    await game.broadcastAll({ type: 'test', payload: {} });

    expect(mockWsOpen.send).toHaveBeenCalled();
    expect(mockWsClosed.send).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- broadcast.test.ts
```

Expected: FAIL with "game.sendStateSync is not a function"

**Step 3: Implement**

```typescript
// packages/backend/src/game.ts (add broadcast methods)
import type { ServerMessage } from '@party-popper/shared';

// Add these methods to the Game class

async sendStateSync(ws: WebSocket): Promise<void> {
  if (!this.state) return;

  const message: ServerMessage = {
    type: 'state_sync',
    payload: this.getPublicState(),
  };

  this.sendToWebSocket(ws, message);
}

async broadcastDelta(delta: unknown): Promise<void> {
  const message: ServerMessage = {
    type: 'state_delta',
    payload: delta,
  };

  await this.broadcastAll(message);
}

async broadcastAll(message: ServerMessage): Promise<void> {
  const messageStr = JSON.stringify(message);

  for (const [ws] of this.connections) {
    this.sendToWebSocket(ws, messageStr);
  }
}

private sendToWebSocket(ws: WebSocket, message: ServerMessage | string): void {
  if (ws.readyState !== 1) { // WebSocket.OPEN = 1
    return;
  }

  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  try {
    ws.send(messageStr);
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

private getPublicState(): Partial<GameState> {
  if (!this.state) return {};

  // Return sanitized state (no internal fields)
  return {
    id: this.state.id,
    joinCode: this.state.joinCode,
    status: this.state.status,
    mode: this.state.mode,
    settings: this.state.settings,
    teams: {
      A: {
        name: this.state.teams.A.name,
        players: this.state.teams.A.players.map(p => ({
          id: p.id,
          name: p.name,
          connected: p.connected,
          // Exclude sessionId from public state
        })),
        timeline: this.state.teams.A.timeline,
        vetoTokens: this.state.teams.A.vetoTokens,
        score: this.state.teams.A.score,
      },
      B: {
        name: this.state.teams.B.name,
        players: this.state.teams.B.players.map(p => ({
          id: p.id,
          name: p.name,
          connected: p.connected,
        })),
        timeline: this.state.teams.B.timeline,
        vetoTokens: this.state.teams.B.vetoTokens,
        score: this.state.teams.B.score,
      },
    },
    currentRound: this.state.currentRound,
  };
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- broadcast.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/broadcast.test.ts
git commit -m "feat(backend): implement state broadcast with full sync and delta updates"
```

---

## Task backend-009: Add heartbeat/ping-pong for connection health

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/heartbeat.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/heartbeat.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../game';

describe('Heartbeat/Ping-Pong', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
      setAlarm: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
    await game.initialize('ABCD', 'classic');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send PING to all connected clients every 30 seconds', async () => {
    const mockWs = { send: vi.fn(), readyState: 1, close: vi.fn() };

    await game.handleJoin(
      { playerName: 'Alice', sessionId: 's1' },
      mockWs as any
    );

    // Trigger heartbeat
    await game.sendHeartbeat();

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ping', payload: {} })
    );
  });

  it('should handle PONG response', async () => {
    const mockWs = { send: vi.fn(), readyState: 1, close: vi.fn() };

    await game.handleJoin(
      { playerName: 'Alice', sessionId: 's1' },
      mockWs as any
    );

    // Record that we sent a ping
    game.recordPingSent(mockWs as any);

    // Handle pong response
    game.handlePong(mockWs as any);

    // Connection should still be tracked as healthy
    expect(game.isConnectionHealthy(mockWs as any)).toBe(true);
  });

  it('should close connection if PONG not received within 10 seconds', async () => {
    const mockWs = { send: vi.fn(), readyState: 1, close: vi.fn() };

    await game.handleJoin(
      { playerName: 'Alice', sessionId: 's1' },
      mockWs as any
    );

    // Record ping sent
    game.recordPingSent(mockWs as any);

    // Advance time past the pong timeout (10 seconds)
    vi.advanceTimersByTime(11000);

    // Check for timed out connections
    await game.checkPongTimeouts();

    expect(mockWs.close).toHaveBeenCalledWith(1000, 'Ping timeout');
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- heartbeat.test.ts
```

Expected: FAIL with "game.sendHeartbeat is not a function"

**Step 3: Implement**

```typescript
// packages/backend/src/game.ts (add heartbeat methods)

const PING_INTERVAL_MS = 30000; // 30 seconds
const PONG_TIMEOUT_MS = 10000;  // 10 seconds

// Add to class properties
private pendingPongs: Map<WebSocket, number> = new Map(); // ws -> ping sent timestamp

// Add these methods to the Game class

async sendHeartbeat(): Promise<void> {
  const pingMessage = JSON.stringify({ type: 'ping', payload: {} });

  for (const [ws] of this.connections) {
    if (ws.readyState === 1) {
      this.sendToWebSocket(ws, pingMessage);
      this.recordPingSent(ws);
    }
  }
}

recordPingSent(ws: WebSocket): void {
  this.pendingPongs.set(ws, Date.now());
}

handlePong(ws: WebSocket): void {
  this.pendingPongs.delete(ws);
}

isConnectionHealthy(ws: WebSocket): boolean {
  const pingTime = this.pendingPongs.get(ws);
  if (!pingTime) return true; // No pending ping

  return Date.now() - pingTime < PONG_TIMEOUT_MS;
}

async checkPongTimeouts(): Promise<void> {
  const now = Date.now();

  for (const [ws, pingSentAt] of this.pendingPongs) {
    if (now - pingSentAt > PONG_TIMEOUT_MS) {
      // Close timed out connection
      try {
        ws.close(1000, 'Ping timeout');
      } catch {
        // Connection may already be closed
      }
      this.pendingPongs.delete(ws);
      await this.handleDisconnect(ws);
    }
  }
}

// Update webSocketMessage to handle pong
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
  const data = typeof message === 'string' ? message : new TextDecoder().decode(message);

  try {
    const parsed = JSON.parse(data);

    if (parsed.type === 'pong') {
      this.handlePong(ws);
      return;
    }

    // Handle other message types via router (to be wired up)
    console.log('Received message:', parsed);
  } catch {
    console.error('Failed to parse message:', data);
  }
}

// Alarm handler for periodic heartbeat
async alarm(): Promise<void> {
  await this.sendHeartbeat();
  await this.checkPongTimeouts();

  // Schedule next alarm
  if (this.connections.size > 0) {
    this.ctx.storage.setAlarm(Date.now() + PING_INTERVAL_MS);
  }
}

// Start heartbeat when first player connects
private async startHeartbeatIfNeeded(): Promise<void> {
  const existingAlarm = await this.ctx.storage.getAlarm();
  if (!existingAlarm && this.connections.size > 0) {
    this.ctx.storage.setAlarm(Date.now() + PING_INTERVAL_MS);
  }
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- heartbeat.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/heartbeat.test.ts
git commit -m "feat(backend): add heartbeat ping-pong for connection health monitoring"
```

---

## Task backend-010: Implement player reconnection with session recovery

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/reconnection.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/reconnection.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../game';

describe('Player Reconnection', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
    await game.initialize('ABCD', 'classic');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should restore player on reconnect with valid session', async () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 };
    const mockWs2 = { send: vi.fn(), readyState: 1 };

    // Initial join
    await game.handleJoin(
      { playerName: 'Alice', sessionId: 'session-123' },
      mockWs1 as any
    );

    // Disconnect
    await game.handleDisconnect(mockWs1 as any);

    // Verify disconnected
    let player = game.findPlayerBySession('session-123');
    expect(player?.connected).toBe(false);

    // Reconnect
    const result = await game.handleReconnect(
      { sessionId: 'session-123' },
      mockWs2 as any
    );

    expect(result.success).toBe(true);
    expect(result.playerName).toBe('Alice');

    player = game.findPlayerBySession('session-123');
    expect(player?.connected).toBe(true);
  });

  it('should reject reconnection with invalid session', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };

    const result = await game.handleReconnect(
      { sessionId: 'nonexistent-session' },
      mockWs as any
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should reject reconnection after 5-minute window', async () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 };
    const mockWs2 = { send: vi.fn(), readyState: 1 };

    // Initial join
    await game.handleJoin(
      { playerName: 'Bob', sessionId: 'session-456' },
      mockWs1 as any
    );

    // Disconnect
    await game.handleDisconnect(mockWs1 as any);

    // Advance time past 5-minute window
    vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

    // Attempt reconnect
    const result = await game.handleReconnect(
      { sessionId: 'session-456' },
      mockWs2 as any
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('should send full state sync after successful reconnection', async () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 };
    const mockWs2 = { send: vi.fn(), readyState: 1 };

    await game.handleJoin(
      { playerName: 'Charlie', sessionId: 'session-789' },
      mockWs1 as any
    );
    await game.handleDisconnect(mockWs1 as any);

    await game.handleReconnect(
      { sessionId: 'session-789' },
      mockWs2 as any
    );

    // Should have sent state_sync
    expect(mockWs2.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"state_sync"')
    );
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- reconnection.test.ts
```

Expected: FAIL with "game.handleReconnect is not a function"

**Step 3: Implement**

```typescript
// packages/backend/src/game.ts (add reconnection methods)
import type { ReconnectPayload } from '@party-popper/shared';

const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Add to Game class

async handleReconnect(
  payload: ReconnectPayload,
  ws: WebSocket
): Promise<{ success: boolean; playerName?: string; error?: string }> {
  if (!this.state) {
    return { success: false, error: 'Game not initialized' };
  }

  const { sessionId } = payload;

  // Find player by session
  const player = this.findPlayerBySession(sessionId);

  if (!player) {
    return { success: false, error: 'Session not found' };
  }

  // Check if within reconnection window
  const timeSinceLastSeen = Date.now() - player.lastSeen;
  if (timeSinceLastSeen > RECONNECT_WINDOW_MS) {
    return { success: false, error: 'Reconnection window expired' };
  }

  // Restore connection
  player.connected = true;
  player.lastSeen = Date.now();

  this.wsToPlayer.set(ws, sessionId);
  this.connections.set(ws, { playerId: player.id });

  await this.persistState();

  // Send full state sync
  await this.sendStateSync(ws);

  return { success: true, playerName: player.name };
}

// Clean up expired disconnected players periodically
async cleanupExpiredPlayers(): Promise<void> {
  if (!this.state) return;

  const now = Date.now();
  let changed = false;

  for (const teamKey of ['A', 'B'] as const) {
    const team = this.state.teams[teamKey];
    const initialLength = team.players.length;

    team.players = team.players.filter(player => {
      if (player.connected) return true;
      return now - player.lastSeen <= RECONNECT_WINDOW_MS;
    });

    if (team.players.length !== initialLength) {
      changed = true;
    }
  }

  if (changed) {
    await this.persistState();
    await this.broadcastDelta({ type: 'players_updated' });
  }
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- reconnection.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/__tests__/reconnection.test.ts
git commit -m "feat(backend): implement player reconnection with 5-minute session recovery window"
```

---

## Task backend-011: Create curated 100-song pool JSON (20 songs per decade: 1970s-2010s)

**Files:**
- Create: `packages/backend/data/songs.json`
- Test: `packages/backend/src/__tests__/songs.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/songs.test.ts
import { describe, it, expect } from 'vitest';
import songs from '../../data/songs.json';

describe('Song Pool', () => {
  it('should have exactly 100 songs', () => {
    expect(songs).toHaveLength(100);
  });

  it('should have 20 songs from each decade (1970s-2010s)', () => {
    const byDecade = {
      '1970s': songs.filter(s => s.year >= 1970 && s.year < 1980),
      '1980s': songs.filter(s => s.year >= 1980 && s.year < 1990),
      '1990s': songs.filter(s => s.year >= 1990 && s.year < 2000),
      '2000s': songs.filter(s => s.year >= 2000 && s.year < 2010),
      '2010s': songs.filter(s => s.year >= 2010 && s.year < 2020),
    };

    expect(byDecade['1970s']).toHaveLength(20);
    expect(byDecade['1980s']).toHaveLength(20);
    expect(byDecade['1990s']).toHaveLength(20);
    expect(byDecade['2000s']).toHaveLength(20);
    expect(byDecade['2010s']).toHaveLength(20);
  });

  it('should have required fields for each song', () => {
    for (const song of songs) {
      expect(song).toHaveProperty('id');
      expect(song).toHaveProperty('title');
      expect(song).toHaveProperty('artist');
      expect(song).toHaveProperty('year');
      expect(song).toHaveProperty('spotifyUri');
      expect(song).toHaveProperty('spotifyUrl');

      expect(typeof song.id).toBe('string');
      expect(typeof song.title).toBe('string');
      expect(typeof song.artist).toBe('string');
      expect(typeof song.year).toBe('number');
      expect(song.spotifyUri).toMatch(/^spotify:track:/);
      expect(song.spotifyUrl).toMatch(/^https:\/\/open\.spotify\.com\/track\//);
    }
  });

  it('should have unique song IDs', () => {
    const ids = songs.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- songs.test.ts
```

Expected: FAIL with "Cannot find module '../../data/songs.json'"

**Step 3: Implement**

Create `packages/backend/data/songs.json` with 100 curated songs. Here is the structure (abbreviated - full file would have all 100):

```json
[
  {
    "id": "song-001",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "year": 1975,
    "spotifyUri": "spotify:track:7tFiyTwD0nx5a1eklYtX2J",
    "spotifyUrl": "https://open.spotify.com/track/7tFiyTwD0nx5a1eklYtX2J"
  },
  {
    "id": "song-002",
    "title": "Hotel California",
    "artist": "Eagles",
    "year": 1977,
    "spotifyUri": "spotify:track:40riOy7x9W7GXjyGp4pjAv",
    "spotifyUrl": "https://open.spotify.com/track/40riOy7x9W7GXjyGp4pjAv"
  },
  {
    "id": "song-003",
    "title": "Stayin' Alive",
    "artist": "Bee Gees",
    "year": 1977,
    "spotifyUri": "spotify:track:3mRM4NM8iO7UBqrSigCQFH",
    "spotifyUrl": "https://open.spotify.com/track/3mRM4NM8iO7UBqrSigCQFH"
  }
]
```

**Note**: The full implementation requires manually curating 100 songs with valid Spotify IDs. The agent implementing this task should create the complete JSON file with:
- 20 songs from 1970-1979
- 20 songs from 1980-1989
- 20 songs from 1990-1999
- 20 songs from 2000-2009
- 20 songs from 2010-2019

Each song needs a valid Spotify track ID which can be found by searching on Spotify and extracting the ID from the track URL.

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- songs.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/data/songs.json packages/backend/src/__tests__/songs.test.ts
git commit -m "feat(backend): add curated 100-song pool with 20 songs per decade"
```

---

## Task backend-012: Add song pool loading for Classic mode

**Files:**
- Modify: `packages/backend/src/game.ts`
- Test: `packages/backend/src/__tests__/song-pool.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/song-pool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

describe('Song Pool Loading', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(async () => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
  });

  it('should load song pool on Classic mode initialization', async () => {
    await game.initialize('ABCD', 'classic');

    const state = game.getState();
    expect(state.songPool.length).toBeGreaterThan(0);
    expect(state.songPool.length).toBe(100);
  });

  it('should shuffle songs randomly', async () => {
    await game.initialize('TEST', 'classic');
    const order1 = game.getState().songPool.map(s => s.id);

    // Reinitialize to get different shuffle
    await game.initialize('TEST', 'classic');
    const order2 = game.getState().songPool.map(s => s.id);

    // Orders should be different (statistically almost certain)
    expect(order1).not.toEqual(order2);
  });

  it('should not load song pool for Custom mode', async () => {
    await game.initialize('CUST', 'custom');

    const state = game.getState();
    expect(state.songPool).toHaveLength(0);
  });

  it('should track played songs to prevent repeats', async () => {
    await game.initialize('ABCD', 'classic');

    const song1 = await game.getNextSong();
    const song2 = await game.getNextSong();

    expect(song1).toBeDefined();
    expect(song2).toBeDefined();
    expect(song1?.id).not.toBe(song2?.id);

    const state = game.getState();
    expect(state.playedSongs).toContainEqual(song1);
    expect(state.playedSongs).toContainEqual(song2);
    expect(state.songPool).not.toContainEqual(song1);
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- song-pool.test.ts
```

Expected: FAIL with "game.getNextSong is not a function"

**Step 3: Implement**

```typescript
// packages/backend/src/game.ts (add song pool methods)
import songsData from '../data/songs.json';
import type { Song } from '@party-popper/shared';

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Update initialize method
async initialize(joinCode: string, mode: GameMode): Promise<void> {
  // Load and shuffle songs for Classic mode
  const songPool: Song[] = mode === 'classic'
    ? shuffleArray(songsData as Song[])
    : [];

  this.state = {
    id: crypto.randomUUID(),
    joinCode,
    status: 'lobby',
    mode,
    settings: { ...DEFAULT_SETTINGS },
    teams: {
      A: createEmptyTeam('Team A'),
      B: createEmptyTeam('Team B'),
    },
    currentRound: null,
    songPool,
    playedSongs: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  await this.persistState();
}

// Add method to get next song
async getNextSong(): Promise<Song | null> {
  if (!this.state || this.state.songPool.length === 0) {
    return null;
  }

  // Take first song from pool
  const song = this.state.songPool.shift()!;

  // Add to played songs
  this.state.playedSongs.push(song);

  await this.persistState();

  return song;
}

// Check if songs are available
hasSongsAvailable(): boolean {
  return this.state !== null && this.state.songPool.length > 0;
}
```

Also add TypeScript declaration for JSON import in `packages/backend/src/types.d.ts`:

```typescript
// packages/backend/src/types.d.ts
declare module '*.json' {
  const value: unknown;
  export default value;
}
```

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- song-pool.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/game.ts packages/backend/src/types.d.ts packages/backend/src/__tests__/song-pool.test.ts
git commit -m "feat(backend): add song pool loading and shuffling for Classic mode"
```

---

## Task backend-013: Write integration tests for Durable Object behavior

**Files:**
- Create: `packages/backend/src/__tests__/integration/game-flow.test.ts`

**Step 1: Write failing test**

```typescript
// packages/backend/src/__tests__/integration/game-flow.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../../game';

describe('Game Flow Integration', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(() => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        getAlarm: vi.fn().mockResolvedValue(null),
        setAlarm: vi.fn(),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    mockEnv = {};
    game = new Game(mockState, mockEnv);
  });

  describe('Game Creation Flow', () => {
    it('should create game and allow players to join', async () => {
      // Create game
      await game.initialize('ABCD', 'classic');
      expect(game.getState().status).toBe('lobby');

      // Player 1 joins
      const ws1 = { send: vi.fn(), readyState: 1 };
      await game.handleJoin({ playerName: 'Alice', sessionId: 's1' }, ws1 as any);

      // Player 2 joins
      const ws2 = { send: vi.fn(), readyState: 1 };
      await game.handleJoin({ playerName: 'Bob', sessionId: 's2' }, ws2 as any);

      const state = game.getState();
      expect(state.teams.A.players).toHaveLength(1);
      expect(state.teams.B.players).toHaveLength(1);
    });
  });

  describe('Player Join/Leave Flow', () => {
    it('should handle complete join-disconnect-reconnect cycle', async () => {
      await game.initialize('TEST', 'classic');

      const ws1 = { send: vi.fn(), readyState: 1 };
      const ws2 = { send: vi.fn(), readyState: 1 };

      // Join
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-x' }, ws1 as any);
      expect(game.findPlayerBySession('session-x')?.connected).toBe(true);

      // Disconnect
      await game.handleDisconnect(ws1 as any);
      expect(game.findPlayerBySession('session-x')?.connected).toBe(false);

      // Reconnect
      const result = await game.handleReconnect({ sessionId: 'session-x' }, ws2 as any);
      expect(result.success).toBe(true);
      expect(game.findPlayerBySession('session-x')?.connected).toBe(true);
    });
  });

  describe('State Transition Flow', () => {
    it('should enforce valid state transitions', async () => {
      await game.initialize('FLOW', 'classic');

      // Can go to playing
      let result = await game.transitionTo('playing');
      expect(result.success).toBe(true);

      // Cannot go back to lobby
      result = await game.transitionTo('lobby');
      expect(result.success).toBe(false);

      // Can go to finished
      result = await game.transitionTo('finished');
      expect(result.success).toBe(true);

      // Cannot transition from finished
      result = await game.transitionTo('playing');
      expect(result.success).toBe(false);
    });
  });

  describe('Reconnection Flow', () => {
    it('should handle multiple reconnection attempts', async () => {
      vi.useFakeTimers();
      await game.initialize('RECON', 'classic');

      const ws1 = { send: vi.fn(), readyState: 1 };
      await game.handleJoin({ playerName: 'Dana', sessionId: 'dana-session' }, ws1 as any);

      // First disconnect
      await game.handleDisconnect(ws1 as any);

      // First reconnect (within window)
      vi.advanceTimersByTime(60000); // 1 minute
      const ws2 = { send: vi.fn(), readyState: 1 };
      let result = await game.handleReconnect({ sessionId: 'dana-session' }, ws2 as any);
      expect(result.success).toBe(true);

      // Second disconnect
      await game.handleDisconnect(ws2 as any);

      // Second reconnect (still within window from last activity)
      vi.advanceTimersByTime(60000); // 1 more minute
      const ws3 = { send: vi.fn(), readyState: 1 };
      result = await game.handleReconnect({ sessionId: 'dana-session' }, ws3 as any);
      expect(result.success).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Full Game Session', () => {
    it('should support a complete game session flow', async () => {
      await game.initialize('FULL', 'classic');

      // 4 players join
      const players = [
        { name: 'P1', session: 's1', ws: { send: vi.fn(), readyState: 1 } },
        { name: 'P2', session: 's2', ws: { send: vi.fn(), readyState: 1 } },
        { name: 'P3', session: 's3', ws: { send: vi.fn(), readyState: 1 } },
        { name: 'P4', session: 's4', ws: { send: vi.fn(), readyState: 1 } },
      ];

      for (const p of players) {
        await game.handleJoin({ playerName: p.name, sessionId: p.session }, p.ws as any);
      }

      // Verify teams balanced
      const state = game.getState();
      expect(state.teams.A.players.length).toBe(2);
      expect(state.teams.B.players.length).toBe(2);

      // Start game
      await game.transitionTo('playing');
      expect(game.getState().status).toBe('playing');

      // Verify songs available
      expect(game.hasSongsAvailable()).toBe(true);

      // Get a song
      const song = await game.getNextSong();
      expect(song).toBeDefined();
      expect(game.getState().playedSongs).toContainEqual(song);
    });
  });
});
```

**Step 2: Run test, verify failure**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- game-flow.test.ts
```

Expected: Tests should pass if all previous tasks are implemented correctly. If failures occur, they indicate bugs to fix.

**Step 3: Fix any failing tests**

Review test output and fix any implementation issues discovered.

**Step 4: Run test, verify pass**

```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper/packages/backend && pnpm test -- game-flow.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/__tests__/integration/game-flow.test.ts
git commit -m "test(backend): add integration tests for complete game flow"
```

---

## Summary

Phase 2 implements the core backend infrastructure:

| Task ID | Description | Key Deliverable |
|---------|-------------|-----------------|
| backend-001 | Game Durable Object with WebSocket | `packages/backend/src/game.ts` |
| backend-002 | Game state management | State machine with lobby/playing/finished |
| backend-003 | REST API endpoints | POST /api/games, GET /api/games/:code |
| backend-004 | Join code generation | 4-char collision-safe codes |
| backend-005 | WebSocket message router | Type-safe message handling |
| backend-006 | Player join/leave | Session tracking |
| backend-007 | Team assignment | Auto-balance + manual reassign |
| backend-008 | State broadcast | Full sync + delta updates |
| backend-009 | Heartbeat | Ping-pong health monitoring |
| backend-010 | Reconnection | 5-minute session recovery |
| backend-011 | Song pool data | 100 curated songs JSON |
| backend-012 | Song pool loading | Shuffle + prevent repeats |
| backend-013 | Integration tests | End-to-end flow verification |

**Milestone**: After completing Phase 2, you can create a game via API, connect via WebSocket, join/leave/reconnect, and receive state updates. Verified with Postman/wscat.
