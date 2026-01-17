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
