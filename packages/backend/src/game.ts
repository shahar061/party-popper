import { DurableObject } from 'cloudflare:workers';
import type { GameState, GameStatus, GameMode, Team } from '@party-popper/shared';
import { DEFAULT_SETTINGS } from '@party-popper/shared';

export interface GameEnv {
  GAME: DurableObjectNamespace;
}

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

  constructor(ctx: DurableObjectState, env: GameEnv) {
    super(ctx, env);
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

    // HTTP endpoints for game info
    if (url.pathname === '/info') {
      return new Response(JSON.stringify({
        connections: this.connections.size,
        status: 'stub',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Message handling will be implemented in Phase 2
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
    console.log('Received message:', data);

    // Echo back for now (stub behavior)
    ws.send(JSON.stringify({ type: 'echo', data }));
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.connections.delete(ws);
    console.log(`WebSocket closed: ${code} ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    this.connections.delete(ws);
  }
}
