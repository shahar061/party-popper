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
