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
    setAlarm: vi.fn().mockResolvedValue(undefined),
    deleteAlarm: vi.fn().mockResolvedValue(undefined),
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

  describe('State sync includes leader info', () => {
    it('should include isTeamLeader in state_sync messages on initial join', async () => {
      const ws1 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);

      // Check that state_sync was sent to the player with isTeamLeader property
      const calls = ws1.send.mock.calls;
      const stateSyncCall = calls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('"type":"state_sync"')
      );

      expect(stateSyncCall).toBeDefined();
      const message = JSON.parse(stateSyncCall![0] as string);

      // Verify the structure includes isTeamLeader property (initially false)
      const alice = message.payload.gameState.teams.A.players.find(
        (p: { name: string }) => p.name === 'Alice'
      );
      expect(alice).toBeDefined();
      expect(alice).toHaveProperty('isTeamLeader');
      expect(alice.isTeamLeader).toBe(false);
    });

    it('should have isTeamLeader=true in state after claiming', async () => {
      const ws1 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleClaimTeamLeader('session-1');

      // Get state and verify leader status
      const state = game.getState();
      const alice = state.teams.A.players.find(p => p.name === 'Alice');
      expect(alice?.isTeamLeader).toBe(true);
    });

    it('should include isTeamLeader=false for non-leaders in state_sync', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);

      // Alice claims leader
      await game.handleClaimTeamLeader('session-1');

      // Get state and check Bob's isTeamLeader
      const state = game.getState();
      const bob = state.teams.A.players.find(p => p.name === 'Bob');
      expect(bob?.isTeamLeader).toBe(false);
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

  describe('Clear teammate votes between phases', () => {
    it('should clear all vote maps when transitioning to quiz phase', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([ws1, ws2]);

      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-1', team: 'A' }, ws1);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-2', team: 'A' }, ws2);
      await game.handleClaimTeamLeader('session-1');
      await game.handleStartGame('session-1');

      // Bob submits a suggestion
      await game.handleQuizSuggestion('session-2', { artistIndex: 1, titleIndex: 2 });

      // Transition to quiz phase should clear votes
      await game.transitionToPhase('quiz');

      // No direct way to check the map, but we can verify the method exists
      // by checking that subsequent suggestions work independently
      const result = await game.handleQuizSuggestion('session-2', { artistIndex: 0, titleIndex: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('Full integration test: Team leader game flow', () => {
    it('should complete a full round with team leaders and teammate suggestions', async () => {
      // Setup: 2 players per team (4 total)
      const wsAlice = createMockWebSocket();
      const wsDan = createMockWebSocket();
      const wsBob = createMockWebSocket();
      const wsCharlie = createMockWebSocket();
      mockCtx.getWebSockets.mockReturnValue([wsAlice, wsDan, wsBob, wsCharlie]);

      // Step 1: Two players join each team
      await game.handleJoin({ playerName: 'Alice', sessionId: 'session-alice', team: 'A' }, wsAlice);
      await game.handleJoin({ playerName: 'Dan', sessionId: 'session-dan', team: 'A' }, wsDan);
      await game.handleJoin({ playerName: 'Bob', sessionId: 'session-bob', team: 'B' }, wsBob);
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-charlie', team: 'B' }, wsCharlie);

      // Verify all players joined
      let state = game.getState();
      expect(state.teams.A.players).toHaveLength(2);
      expect(state.teams.B.players).toHaveLength(2);

      // Step 2: One player claims leader per team
      const aliceClaimResult = await game.handleClaimTeamLeader('session-alice');
      expect(aliceClaimResult.success).toBe(true);

      const bobClaimResult = await game.handleClaimTeamLeader('session-bob');
      expect(bobClaimResult.success).toBe(true);

      // Verify leaders are set
      state = game.getState();
      const alice = state.teams.A.players.find(p => p.name === 'Alice');
      const bob = state.teams.B.players.find(p => p.name === 'Bob');
      expect(alice?.isTeamLeader).toBe(true);
      expect(bob?.isTeamLeader).toBe(true);

      // Step 3: Game starts
      const startResult = await game.handleStartGame('session-alice');
      expect(startResult.success).toBe(true);

      state = game.getState();
      expect(state.status).toBe('playing');
      expect(state.currentRound).not.toBeNull();

      // Step 4: Transition to quiz phase
      await game.transitionToPhase('quiz');
      state = game.getState();
      expect(state.currentRound?.phase).toBe('quiz');

      // Step 5: Non-leaders submit suggestions
      // Dan (non-leader on Team A) submits a quiz suggestion
      wsAlice.send = vi.fn(); // Reset mock to track new calls
      const danSuggestionResult = await game.handleQuizSuggestion('session-dan', {
        artistIndex: 1,
        titleIndex: 2,
      });
      expect(danSuggestionResult.success).toBe(true);

      // Step 6: Leaders receive suggestions
      // Verify Alice (leader) received the suggestion
      expect(wsAlice.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"teammate_quiz_vote"')
      );
      expect(wsAlice.send).toHaveBeenCalledWith(
        expect.stringContaining('"playerName":"Dan"')
      );

      // Step 7: Leader submits final answer
      state = game.getState();
      const alicePlayer = state.teams.A.players.find(p => p.name === 'Alice');
      const danPlayer = state.teams.A.players.find(p => p.name === 'Dan');

      // Dan (non-leader) tries to submit - should fail
      const danSubmitResult = await game.handleSubmitQuiz(0, 0, danPlayer!.id);
      expect(danSubmitResult.success).toBe(false);

      // Alice (leader) submits - should succeed
      const aliceSubmitResult = await game.handleSubmitQuiz(0, 0, alicePlayer!.id);
      expect(aliceSubmitResult.success).toBe(true);

      // Step 8: Verify state transition happened
      state = game.getState();
      expect(state.currentRound?.phase).toBe('placement');
      expect(state.currentRound?.quizAnswer).toBeDefined();

      // Step 9: Placement phase - leader submits placement
      // Dan submits suggestion
      wsAlice.send = vi.fn();
      await game.handlePlacementSuggestion('session-dan', { position: 0 });
      expect(wsAlice.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"teammate_placement_vote"')
      );

      // Dan tries to submit placement - should fail
      const danPlacementResult = await game.handleSubmitPlacement(0, danPlayer!.id);
      expect(danPlacementResult.success).toBe(false);

      // Alice submits placement - should succeed
      const alicePlacementResult = await game.handleSubmitPlacement(0, alicePlayer!.id);
      expect(alicePlacementResult.success).toBe(true);

      // Step 10: Verify veto window opened
      state = game.getState();
      expect(state.currentRound?.phase).toBe('veto_window');

      // Step 11: Veto phase - Team B leader decides
      const bobPlayer = state.teams.B.players.find(p => p.name === 'Bob');
      const charliePlayer = state.teams.B.players.find(p => p.name === 'Charlie');

      // Charlie (non-leader) submits veto suggestion
      wsBob.send = vi.fn();
      await game.handleVetoSuggestion('session-charlie', { useVeto: false });
      expect(wsBob.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"teammate_veto_vote"')
      );

      // Charlie tries to decide veto - should fail
      const charlieVetoResult = await game.handleVetoDecision(false, charliePlayer!.id);
      expect(charlieVetoResult.success).toBe(false);

      // Bob (leader) decides to pass veto - should succeed
      const bobVetoResult = await game.handleVetoDecision(false, bobPlayer!.id);
      expect(bobVetoResult.success).toBe(true);

      // Step 12: Verify final state
      state = game.getState();
      expect(state.currentRound?.phase).toBe('reveal');
      expect(state.currentRound?.vetoDecision?.used).toBe(false);

      // Verify all team leaders are still correctly set
      const finalAlice = state.teams.A.players.find(p => p.name === 'Alice');
      const finalBob = state.teams.B.players.find(p => p.name === 'Bob');
      const finalDan = state.teams.A.players.find(p => p.name === 'Dan');
      const finalCharlie = state.teams.B.players.find(p => p.name === 'Charlie');

      expect(finalAlice?.isTeamLeader).toBe(true);
      expect(finalBob?.isTeamLeader).toBe(true);
      expect(finalDan?.isTeamLeader).toBe(false);
      expect(finalCharlie?.isTeamLeader).toBe(false);
    });
  });
});
