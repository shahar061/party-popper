import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';
import { GAME_CONSTANTS } from '@party-popper/shared';

describe('Team Assignment', () => {
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

  it('should auto-assign players to team with fewer members', async () => {
    const ws1 = { send: vi.fn() };
    const ws2 = { send: vi.fn() };
    const ws3 = { send: vi.fn() };

    await game.handleJoin({ playerName: 'P1', sessionId: 's1' }, ws1 as any);
    await game.handleJoin({ playerName: 'P2', sessionId: 's2' }, ws2 as any);
    await game.handleJoin({ playerName: 'P3', sessionId: 's3' }, ws3 as any);

    const state = game.getState();

    // After 3 joins: should be 2-1 or 1-2 split
    const teamACount = state.teams.A.players.length;
    const teamBCount = state.teams.B.players.length;

    expect(Math.abs(teamACount - teamBCount)).toBeLessThanOrEqual(1);
  });

  it('should allow manual team assignment on join', async () => {
    const ws = { send: vi.fn() };

    await game.handleJoin({ playerName: 'P1', sessionId: 's1', team: 'B' }, ws as any);

    const state = game.getState();

    expect(state.teams.B.players).toHaveLength(1);
    expect(state.teams.A.players).toHaveLength(0);
  });

  it('should reassign player to different team', async () => {
    const ws = { send: vi.fn() };

    await game.handleJoin({ playerName: 'P1', sessionId: 's1', team: 'A' }, ws as any);

    const player = game.findPlayerBySession('s1');
    expect(player?.team).toBe('A');

    await game.reassignTeam(player!.id, 'B');

    const updatedPlayer = game.findPlayerBySession('s1');
    expect(updatedPlayer?.team).toBe('B');

    const state = game.getState();
    expect(state.teams.A.players).toHaveLength(0);
    expect(state.teams.B.players).toHaveLength(1);
  });

  it('should enforce max players per team', async () => {
    const maxPlayers = GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM;

    // Fill team A to max
    for (let i = 0; i < maxPlayers; i++) {
      const ws = { send: vi.fn() };
      await game.handleJoin({ playerName: `P${i}`, sessionId: `s${i}`, team: 'A' }, ws as any);
    }

    // Next player should be auto-assigned to B or rejected
    const ws = { send: vi.fn() };
    await game.handleJoin({ playerName: 'Extra', sessionId: 'sExtra', team: 'A' }, ws as any);

    const state = game.getState();
    // Either player went to B, or was rejected - team A shouldn't exceed max
    expect(state.teams.A.players.length).toBeLessThanOrEqual(maxPlayers);
  });
});
