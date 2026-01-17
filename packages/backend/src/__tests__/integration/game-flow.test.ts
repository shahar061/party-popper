import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../../game';

describe('Game Flow Integration', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(() => {
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
  });

  describe('Game Creation Flow', () => {
    it('should create game and allow players to join', async () => {
      // Create game
      await game.initialize('ABCD', 'classic');
      expect(game.getState().status).toBe('lobby');

      // Player 1 joins
      const ws1 = { send: vi.fn(), readyState: 1 };
      await game.handleJoin({ playerName: 'Alice', sessionId: 's1' }, ws1 as any);

      // Player 2 joins
      const ws2 = { send: vi.fn(), readyState: 1 };
      await game.handleJoin({ playerName: 'Bob', sessionId: 's2' }, ws2 as any);

      const state = game.getState();
      expect(state.teams.A.players).toHaveLength(1);
      expect(state.teams.B.players).toHaveLength(1);
    });
  });

  describe('Player Join/Leave Flow', () => {
    it('should handle complete join-disconnect-reconnect cycle', async () => {
      await game.initialize('TEST', 'classic');

      const ws1 = { send: vi.fn(), readyState: 1 };
      const ws2 = { send: vi.fn(), readyState: 1 };

      // Join
      await game.handleJoin({ playerName: 'Charlie', sessionId: 'session-x' }, ws1 as any);
      expect(game.findPlayerBySession('session-x')?.connected).toBe(true);

      // Disconnect
      await game.handleDisconnect(ws1 as any);
      expect(game.findPlayerBySession('session-x')?.connected).toBe(false);

      // Reconnect
      const result = await game.handleReconnect({ sessionId: 'session-x' }, ws2 as any);
      expect(result.success).toBe(true);
      expect(game.findPlayerBySession('session-x')?.connected).toBe(true);
    });
  });

  describe('State Transition Flow', () => {
    it('should enforce valid state transitions', async () => {
      await game.initialize('FLOW', 'classic');

      // Can go to playing
      let result = await game.transitionTo('playing');
      expect(result.success).toBe(true);

      // Cannot go back to lobby
      result = await game.transitionTo('lobby');
      expect(result.success).toBe(false);

      // Can go to finished
      result = await game.transitionTo('finished');
      expect(result.success).toBe(true);

      // Cannot transition from finished
      result = await game.transitionTo('playing');
      expect(result.success).toBe(false);
    });
  });

  describe('Reconnection Flow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle multiple reconnection attempts', async () => {
      await game.initialize('RECON', 'classic');

      const ws1 = { send: vi.fn(), readyState: 1 };
      await game.handleJoin({ playerName: 'Dana', sessionId: 'dana-session' }, ws1 as any);

      // First disconnect
      await game.handleDisconnect(ws1 as any);

      // First reconnect (within window)
      vi.advanceTimersByTime(60000); // 1 minute
      const ws2 = { send: vi.fn(), readyState: 1 };
      let result = await game.handleReconnect({ sessionId: 'dana-session' }, ws2 as any);
      expect(result.success).toBe(true);

      // Second disconnect
      await game.handleDisconnect(ws2 as any);

      // Second reconnect (still within window from last activity)
      vi.advanceTimersByTime(60000); // 1 more minute
      const ws3 = { send: vi.fn(), readyState: 1 };
      result = await game.handleReconnect({ sessionId: 'dana-session' }, ws3 as any);
      expect(result.success).toBe(true);
    });
  });

  describe('Full Game Session', () => {
    it('should support a complete game session flow', async () => {
      await game.initialize('FULL', 'classic');

      // 4 players join
      const players = [
        { name: 'P1', session: 's1', ws: { send: vi.fn(), readyState: 1 } },
        { name: 'P2', session: 's2', ws: { send: vi.fn(), readyState: 1 } },
        { name: 'P3', session: 's3', ws: { send: vi.fn(), readyState: 1 } },
        { name: 'P4', session: 's4', ws: { send: vi.fn(), readyState: 1 } },
      ];

      for (const p of players) {
        await game.handleJoin({ playerName: p.name, sessionId: p.session }, p.ws as any);
      }

      // Verify teams balanced
      const state = game.getState();
      expect(state.teams.A.players.length).toBe(2);
      expect(state.teams.B.players.length).toBe(2);

      // Start game
      await game.transitionTo('playing');
      expect(game.getState().status).toBe('playing');

      // Verify songs available
      expect(game.hasSongsAvailable()).toBe(true);

      // Get a song
      const song = await game.getNextSong();
      expect(song).toBeDefined();
      expect(game.getState().playedSongs).toContainEqual(song);
    });
  });
});
