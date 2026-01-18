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
        getAlarm: vi.fn().mockResolvedValue(null),
        setAlarm: vi.fn(),
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

  it('should send PING to all connected clients', async () => {
    const mockWs = { send: vi.fn(), readyState: 1, close: vi.fn() };

    await game.handleJoin(
      { playerName: 'Alice', sessionId: 's1' },
      mockWs as any
    );

    // Clear previous calls from handleJoin
    mockWs.send.mockClear();

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
