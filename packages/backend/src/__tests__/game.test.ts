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
    const mockEnv = {} as any;

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
    const mockEnv = {} as any;

    const game = new Game(mockState as any, mockEnv);

    const request = new Request('https://example.com/ws');
    const response = await game.fetch(request);

    expect(response.status).toBe(426);
  });
});

describe('Team Leader', () => {
  it('should create players with isTeamLeader set to false', async () => {
    const mockCtx = {
      storage: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
      getWebSockets: vi.fn().mockReturnValue([]),
      acceptWebSocket: vi.fn(),
    };
    const mockEnv = {} as any;

    const game = new Game(mockCtx as any, mockEnv);
    await game.initialize('TEST123', 'classic');

    const mockWs = { send: vi.fn() };
    await game.handleJoin(
      { playerName: 'Alice', sessionId: 'session-1' },
      mockWs as any
    );

    const state = game.getState();
    const player = state?.teams.A.players[0] || state?.teams.B.players[0];
    expect(player?.isTeamLeader).toBe(false);
  });
});
