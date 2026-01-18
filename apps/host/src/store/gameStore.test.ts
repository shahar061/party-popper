import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import type { GameState, Player } from '@party-popper/shared';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('should initialize with null game state', () => {
    const state = useGameStore.getState();
    expect(state.game).toBeNull();
  });

  it('should sync full game state', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10, quizTimeSeconds: 45, placementTimeSeconds: 20, vetoWindowSeconds: 10, vetoPlacementSeconds: 15 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], tokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], tokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);

    expect(useGameStore.getState().game).toEqual(mockGameState);
  });

  it('should add player to team', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10, quizTimeSeconds: 45, placementTimeSeconds: 20, vetoWindowSeconds: 10, vetoPlacementSeconds: 15 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], tokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], tokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);

    const player: Player = { id: 'player-1', name: 'Alice', sessionId: 's1', team: 'A', connected: true, lastSeen: Date.now(), isTeamLeader: false };
    useGameStore.getState().addPlayer(player, 'A');

    expect(useGameStore.getState().game?.teams.A.players).toContainEqual(player);
  });

  it('should remove player from team', () => {
    const player: Player = { id: 'player-1', name: 'Alice', sessionId: 's1', team: 'A', connected: true, lastSeen: Date.now(), isTeamLeader: false };
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10, quizTimeSeconds: 45, placementTimeSeconds: 20, vetoWindowSeconds: 10, vetoPlacementSeconds: 15 },
      teams: {
        A: { name: 'Team A', players: [player], timeline: [], tokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], tokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().removePlayer('player-1');

    expect(useGameStore.getState().game?.teams.A.players).toHaveLength(0);
  });

  it('should move player between teams', () => {
    const player: Player = { id: 'player-1', name: 'Alice', sessionId: 's1', team: 'A', connected: true, lastSeen: Date.now(), isTeamLeader: false };
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10, quizTimeSeconds: 45, placementTimeSeconds: 20, vetoWindowSeconds: 10, vetoPlacementSeconds: 15 },
      teams: {
        A: { name: 'Team A', players: [player], timeline: [], tokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], tokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().movePlayer('player-1', 'B');

    expect(useGameStore.getState().game?.teams.A.players).toHaveLength(0);
    expect(useGameStore.getState().game?.teams.B.players).toContainEqual(player);
  });

  it('should update game settings', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10, quizTimeSeconds: 45, placementTimeSeconds: 20, vetoWindowSeconds: 10, vetoPlacementSeconds: 15 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], tokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], tokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().updateSettings({ targetScore: 15 });

    expect(useGameStore.getState().game?.settings.targetScore).toBe(15);
  });

  it('should update game status', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10, quizTimeSeconds: 45, placementTimeSeconds: 20, vetoWindowSeconds: 10, vetoPlacementSeconds: 15 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], tokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], tokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().setStatus('playing');

    expect(useGameStore.getState().game?.status).toBe('playing');
  });
});
