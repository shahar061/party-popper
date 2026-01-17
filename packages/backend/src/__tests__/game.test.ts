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
