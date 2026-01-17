import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

describe('Song Pool Loading', () => {
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
  });

  it('should load song pool on Classic mode initialization', async () => {
    await game.initialize('ABCD', 'classic');

    const state = game.getState();
    expect(state.songPool.length).toBeGreaterThan(0);
    expect(state.songPool.length).toBe(100);
  });

  it('should shuffle songs randomly', async () => {
    await game.initialize('TEST', 'classic');
    const order1 = game.getState().songPool.map(s => s.id);

    // Reinitialize to get different shuffle
    await game.initialize('TEST', 'classic');
    const order2 = game.getState().songPool.map(s => s.id);

    // Orders should be different (statistically almost certain)
    expect(order1).not.toEqual(order2);
  });

  it('should not load song pool for Custom mode', async () => {
    await game.initialize('CUST', 'custom');

    const state = game.getState();
    expect(state.songPool).toHaveLength(0);
  });

  it('should track played songs to prevent repeats', async () => {
    await game.initialize('ABCD', 'classic');

    const song1 = await game.getNextSong();
    const song2 = await game.getNextSong();

    expect(song1).toBeDefined();
    expect(song2).toBeDefined();
    expect(song1?.id).not.toBe(song2?.id);

    const state = game.getState();
    expect(state.playedSongs).toContainEqual(song1);
    expect(state.playedSongs).toContainEqual(song2);
    expect(state.songPool).not.toContainEqual(song1);
  });
});
