import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../game';

describe('Game State Management', () => {
  let mockState: any;
  let mockEnv: any;
  let game: Game;

  beforeEach(() => {
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

  it('should initialize with lobby status', async () => {
    await game.initialize('ABCD', 'classic');

    const state = game.getState();
    expect(state.status).toBe('lobby');
    expect(state.joinCode).toBe('ABCD');
    expect(state.mode).toBe('classic');
  });

  it('should transition from lobby to playing', async () => {
    await game.initialize('ABCD', 'classic');

    const result = await game.transitionTo('playing');

    expect(result.success).toBe(true);
    expect(game.getState().status).toBe('playing');
  });

  it('should transition from playing to finished', async () => {
    await game.initialize('ABCD', 'classic');
    await game.transitionTo('playing');

    const result = await game.transitionTo('finished');

    expect(result.success).toBe(true);
    expect(game.getState().status).toBe('finished');
  });

  it('should reject invalid transitions', async () => {
    await game.initialize('ABCD', 'classic');

    const result = await game.transitionTo('finished');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid state transition: lobby -> finished');
  });

  it('should persist state to storage', async () => {
    await game.initialize('ABCD', 'classic');

    expect(mockState.storage.put).toHaveBeenCalledWith(
      'gameState',
      expect.objectContaining({ joinCode: 'ABCD', status: 'lobby' })
    );
  });
});
