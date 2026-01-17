import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../router';

describe('REST API', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      GAME: {
        idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-id' }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ joinCode: 'ABCD' }))),
        }),
      },
      GAME_CODES: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it('POST /api/games should create a new game', async () => {
    const request = new Request('https://example.com/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic' }),
    });

    const response = await handleRequest(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toHaveProperty('joinCode');
    expect(body.joinCode).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('GET /api/games/:code should return game info', async () => {
    mockEnv.GAME_CODES.get.mockResolvedValue('mock-game-id');
    mockEnv.GAME.idFromString = vi.fn().mockReturnValue({ toString: () => 'mock-game-id' });
    mockEnv.GAME.get.mockReturnValue({
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          joinCode: 'ABCD',
          status: 'lobby',
          playerCount: 3,
        }))
      ),
    });

    const request = new Request('https://example.com/api/games/ABCD', {
      method: 'GET',
    });

    const response = await handleRequest(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.joinCode).toBe('ABCD');
    expect(body.status).toBe('lobby');
  });

  it('GET /api/games/:code should return 404 for invalid code', async () => {
    mockEnv.GAME_CODES.get.mockResolvedValue(null);

    const request = new Request('https://example.com/api/games/ZZZZ', {
      method: 'GET',
    });

    const response = await handleRequest(request, mockEnv);

    expect(response.status).toBe(404);
  });
});
