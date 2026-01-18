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

  describe('Leader disconnect handling', () => {
    it('should reassign leader when leader disconnects during game', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const ws3 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2, ws3]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-3', team: 'B' }, ws3);

      await game.handleClaimTeamLeader('session-1');
      await game.handleStartGame('session-1');

      // Alice disconnects - use handleClose for disconnect handling
      await game.handleClose(ws1);

      const state = game.getState();
      const bob = state?.teams.A.players.find(p => p.name === 'Bob');
      expect(bob?.isTeamLeader).toBe(true);
    });

    it('should make leader available again when leader disconnects in lobby', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

      await game.handleClaimTeamLeader('session-1');
      await game.handleClose(ws1);

      const result = await game.handleClaimTeamLeader('session-2');
      expect(result.success).toBe(true);
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

  describe('Teammate quiz suggestions', () => {
    it('should store quiz suggestion and send to leader only', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

      await game.handleClaimTeamLeader('session-1'); // Alice is leader

      // Clear previous send calls
      ws1.send = vi.fn();
      ws2.send = vi.fn();

      // Bob submits a suggestion
      const result = await game.handleQuizSuggestion('session-2', { artistIndex: 1, titleIndex: 2 });

      expect(result.success).toBe(true);
      // Leader (Alice) should receive the suggestion
      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"teammate_quiz_vote"')
      );
      // Bob should NOT receive it (not broadcast)
      expect(ws2.send).not.toHaveBeenCalled();
    });
  });

  describe('Teammate placement suggestions', () => {
    it('should store placement suggestion and send to leader only', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

      await game.handleClaimTeamLeader('session-1'); // Alice is leader

      // Clear previous send calls
      ws1.send = vi.fn();
      ws2.send = vi.fn();

      // Bob submits a placement suggestion
      const result = await game.handlePlacementSuggestion('session-2', { position: 3 });

      expect(result.success).toBe(true);
      // Leader (Alice) should receive the suggestion
      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"teammate_placement_vote"')
      );
      // Bob should NOT receive it
      expect(ws2.send).not.toHaveBeenCalled();
    });
  });

  describe('Teammate veto suggestions', () => {
    it('should store veto suggestion and send to leader only', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

      await game.handleClaimTeamLeader('session-1'); // Alice is leader

      // Clear previous send calls
      ws1.send = vi.fn();
      ws2.send = vi.fn();

      // Bob submits a veto suggestion
      const result = await game.handleVetoSuggestion('session-2', { useVeto: true });

      expect(result.success).toBe(true);
      // Leader (Alice) should receive the suggestion
      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"teammate_veto_vote"')
      );
      // Bob should NOT receive it
      expect(ws2.send).not.toHaveBeenCalled();
    });
  });

  describe('Leader-only final decisions', () => {
    it('should reject quiz submission from non-leader', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const ws3 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2, ws3]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-3', team: 'B' }, ws3);

      await game.handleClaimTeamLeader('session-1'); // Alice is leader
      await game.handleStartGame('session-1');

      // Transition to quiz phase
      await game.transitionToPhase('quiz');

      const state = game.getState();
      const bob = state?.teams.A.players.find(p => p.name === 'Bob');

      // Bob (non-leader) tries to submit quiz
      const result = await game.handleSubmitQuiz(0, 0, bob!.id);

      expect(result.success).toBe(false);
    });

    it('should allow quiz submission from leader', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'B' }, ws2);

      await game.handleClaimTeamLeader('session-1'); // Alice is leader
      await game.handleStartGame('session-1');

      // Transition to quiz phase
      await game.transitionToPhase('quiz');

      const state = game.getState();
      const alice = state?.teams.A.players.find(p => p.name === 'Alice');

      // Alice (leader) submits quiz
      const result = await game.handleSubmitQuiz(0, 0, alice!.id);

      expect(result.success).toBe(true);
    });

    it('should reject placement submission from non-leader', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const ws3 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2, ws3]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-3', team: 'B' }, ws3);

      await game.handleClaimTeamLeader('session-1'); // Alice is leader
      await game.handleStartGame('session-1');

      // Transition to placement phase
      await game.transitionToPhase('placement');

      const state = game.getState();
      const bob = state?.teams.A.players.find(p => p.name === 'Bob');

      // Bob (non-leader) tries to submit placement
      const result = await game.handleSubmitPlacement(0, bob!.id);

      expect(result.success).toBe(false);
    });

    it('should reject veto decision from non-leader', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const ws3 = createMockWebSocket();
      const ws4 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2, ws3, ws4]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'B' }, ws2);
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-3', team: 'B' }, ws3);
      await game.handleJoin({ playerName: 'Dan', sessionId: 'session-4', team: 'A' }, ws4);

      await game.handleClaimTeamLeader('session-1'); // Alice is Team A leader
      await game.handleClaimTeamLeader('session-2'); // Bob is Team B leader
      await game.handleStartGame('session-1');

      // Transition to veto_window phase
      await game.transitionToPhase('veto_window');

      const state = game.getState();
      // Team A is active, so Team B can veto
      // Charlie is on Team B but not the leader
      const charlie = state?.teams.B.players.find(p => p.name === 'Charlie');

      // Charlie (non-leader) tries to make veto decision
      const result = await game.handleVetoDecision(true, charlie!.id);

      expect(result.success).toBe(false);
    });
  });
});
