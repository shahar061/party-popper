import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

function createMockWebSocket() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // WebSocket.OPEN
  } as unknown as WebSocket;
}

const createMockCtx = () => ({
  storage: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  getWebSockets: vi.fn().mockReturnValue([]),
  acceptWebSocket: vi.fn(),
  blockConcurrencyWhile: vi.fn((fn: () => unknown) => fn()),
});

const mockEnv = {} as any;

describe('Team Leader', () => {
  let game: Game;
  let mockCtx: ReturnType<typeof createMockCtx>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCtx = createMockCtx();
    game = new Game(mockCtx as any, mockEnv);
    await game.initialize('TEST123', 'classic');
  });

  describe('claimTeamLeader', () => {
    it('should allow first player to claim team leader', async () => {
      const ws1 = createMockWebSocket();

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);

      const result = await game.handleClaimTeamLeader('session-1');

      expect(result.success).toBe(true);
      const state = game.getState();
      const alice = state?.teams.A.players.find(p => p.name === 'Alice');
      expect(alice?.isTeamLeader).toBe(true);
    });

    it('should reject claim if team already has a leader', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

      await game.handleClaimTeamLeader('session-1');
      const result = await game.handleClaimTeamLeader('session-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Team already has a leader');
    });

    it('should broadcast leader_claimed message', async () => {
      const ws1 = createMockWebSocket();
      // Add a second websocket to receive the broadcast
      mockCtx.getWebSockets.mockReturnValue([ws1]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);

      await game.handleClaimTeamLeader('session-1');

      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"leader_claimed"')
      );
    });
  });

  describe('Auto-assign leader on game start', () => {
    it('should auto-assign leader if team has no leader on game start', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'B' }, ws2);

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
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2, ws3]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-3', team: 'B' }, ws3);

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
});
