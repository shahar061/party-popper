import { DurableObject } from 'cloudflare:workers';
import type { GameState, GameStatus, GameMode, Team, Player, Song } from '@party-popper/shared';
import { DEFAULT_SETTINGS, GAME_CONSTANTS } from '@party-popper/shared';
import songsData from '../data/songs.json';

interface JoinPayload {
  playerName: string;
  sessionId: string;
  team?: 'A' | 'B';
}

export interface GameEnv {
  GAME: DurableObjectNamespace;
}

const VALID_TRANSITIONS: Record<GameStatus, GameStatus[]> = {
  lobby: ['playing'],
  playing: ['finished'],
  finished: [],
};

const PONG_TIMEOUT_MS = 10000; // 10 seconds
const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function createEmptyTeam(name: string): Team {
  return {
    name,
    players: [],
    timeline: [],
    vetoTokens: 3,
    score: 0,
  };
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class Game extends DurableObject {
  private connections: Map<WebSocket, { playerId?: string }> = new Map();
  private wsToPlayer: Map<WebSocket, string> = new Map(); // ws -> sessionId
  private pendingPongs: Map<WebSocket, number> = new Map(); // ws -> ping sent timestamp
  private state: GameState | null = null;

  constructor(ctx: DurableObjectState, env: GameEnv) {
    super(ctx, env);
  }

  async initialize(joinCode: string, mode: GameMode): Promise<void> {
    // Load and shuffle songs for Classic mode
    const songPool: Song[] = mode === 'classic'
      ? shuffleArray((songsData as { songs: Song[] }).songs)
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

  // Player management methods
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
      team: team || this.getTeamWithFewerPlayers(),
      connected: true,
      lastSeen: Date.now(),
    };

    // Assign to team (check capacity)
    let targetTeam = player.team;
    if (this.state.teams[targetTeam].players.length >= GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM) {
      // Team full, try other team
      const otherTeam = targetTeam === 'A' ? 'B' : 'A';
      if (this.state.teams[otherTeam].players.length < GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM) {
        targetTeam = otherTeam;
        player.team = targetTeam;
      }
      // If both full, player still gets added (graceful degradation)
    }
    this.state.teams[targetTeam].players.push(player);

    // Track connection
    this.wsToPlayer.set(ws, sessionId);
    this.connections.set(ws, { playerId: player.id });

    this.state.lastActivityAt = Date.now();
    await this.persistState();

    // Send state sync to newly joined player
    this.sendStateSync(ws, player);

    // Broadcast player joined to all other players
    this.broadcast({ type: 'player_joined', payload: { player } }, ws);
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

  async handleReconnect(
    payload: { sessionId: string },
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
    this.sendStateSync(ws, player);

    return { success: true, playerName: player.name };
  }

  findPlayerBySession(sessionId: string): Player | undefined {
    if (!this.state) return undefined;

    for (const teamKey of ['A', 'B'] as const) {
      const player = this.state.teams[teamKey].players.find(p => p.sessionId === sessionId);
      if (player) return player;
    }
    return undefined;
  }

  findPlayerById(playerId: string): Player | undefined {
    if (!this.state) return undefined;

    for (const teamKey of ['A', 'B'] as const) {
      const player = this.state.teams[teamKey].players.find(p => p.id === playerId);
      if (player) return player;
    }
    return undefined;
  }

  async reassignTeam(playerId: string, newTeam: 'A' | 'B'): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: 'Game not initialized' };
    }

    // Find and remove player from current team
    let player: Player | undefined;
    for (const teamKey of ['A', 'B'] as const) {
      const team = this.state.teams[teamKey];
      const index = team.players.findIndex(p => p.id === playerId);
      if (index !== -1) {
        player = team.players[index];
        team.players.splice(index, 1);
        break;
      }
    }

    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Check if target team has capacity
    if (this.state.teams[newTeam].players.length >= GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM) {
      // Put player back
      this.state.teams[player.team].players.push(player);
      return { success: false, error: 'Target team is full' };
    }

    // Add to new team
    player.team = newTeam;
    this.state.teams[newTeam].players.push(player);
    this.state.lastActivityAt = Date.now();
    await this.persistState();

    return { success: true };
  }

  private getTeamWithFewerPlayers(): 'A' | 'B' {
    if (!this.state) return 'A';

    const teamACount = this.state.teams.A.players.length;
    const teamBCount = this.state.teams.B.players.length;

    return teamACount <= teamBCount ? 'A' : 'B';
  }

  // Broadcast methods
  private sendStateSync(ws: WebSocket, player: Player): void {
    if (!this.state) return;

    const message = {
      type: 'state_sync',
      payload: {
        gameState: this.state,
        playerId: player.id,
        sessionId: player.sessionId,
      },
    };

    this.sendToWs(ws, message);
  }

  broadcast(message: unknown, excludeWs?: WebSocket): void {
    const messageStr = JSON.stringify(message);

    for (const [ws] of this.connections) {
      if (ws !== excludeWs) {
        this.sendToWs(ws, message, messageStr);
      }
    }
  }

  private sendToWs(ws: WebSocket, message: unknown, messageStr?: string): void {
    try {
      if ((ws as any).readyState === 1) {
        ws.send(messageStr || JSON.stringify(message));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  // Heartbeat methods
  async sendHeartbeat(): Promise<void> {
    const pingMessage = JSON.stringify({ type: 'ping', payload: {} });

    for (const [ws] of this.connections) {
      if ((ws as any).readyState === 1) {
        this.sendToWs(ws, pingMessage, pingMessage);
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
          (ws as any).close(1000, 'Ping timeout');
        } catch {
          // Connection may already be closed
        }
        this.pendingPongs.delete(ws);
        await this.handleDisconnect(ws);
      }
    }
  }

  // Song pool methods
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

  hasSongsAvailable(): boolean {
    return this.state !== null && this.state.songPool.length > 0;
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
