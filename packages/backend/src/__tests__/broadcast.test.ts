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

  it('should broadcast state sync to new player', async () => {
    const ws = { send: vi.fn(), readyState: 1 };

    await game.handleJoin({ playerName: 'Alice', sessionId: 's1' }, ws as any);

    expect(ws.send).toHaveBeenCalled();
    const message = JSON.parse(ws.send.mock.calls[0][0]);
    expect(message.type).toBe('state_sync');
    expect(message.payload.gameState).toBeDefined();
  });

  it('should broadcast to all connected players', async () => {
    const ws1 = { send: vi.fn(), readyState: 1 };
    const ws2 = { send: vi.fn(), readyState: 1 };

    await game.handleJoin({ playerName: 'Alice', sessionId: 's1' }, ws1 as any);
    await game.handleJoin({ playerName: 'Bob', sessionId: 's2' }, ws2 as any);

    // Both should have received messages
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
  });
});
