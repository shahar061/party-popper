import { generateJoinCode } from './utils/join-code';

export interface Env {
  GAME: DurableObjectNamespace;
  GAME_CODES: KVNamespace;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // POST /api/games - Create new game
    if (path === '/api/games' && request.method === 'POST') {
      const body = await request.json() as { mode?: 'classic' | 'custom' };
      const mode = body.mode || 'classic';

      // Generate unique join code
      const joinCode = await generateJoinCode(env.GAME_CODES);

      // Create Durable Object for this game
      const gameId = env.GAME.idFromName(joinCode);
      const gameStub = env.GAME.get(gameId);

      // Initialize the game
      await gameStub.fetch(new Request('https://internal/initialize', {
        method: 'POST',
        body: JSON.stringify({ joinCode, mode }),
      }));

      // Store code -> game ID mapping
      await env.GAME_CODES.put(joinCode, gameId.toString(), { expirationTtl: 86400 });

      return new Response(
        JSON.stringify({ joinCode, gameId: gameId.toString() }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // GET /api/games/:code - Get game info
    const gameInfoMatch = path.match(/^\/api\/games\/([A-Z0-9]{4})$/);
    if (gameInfoMatch && request.method === 'GET') {
      const joinCode = gameInfoMatch[1];

      // Look up game ID from code
      const gameIdStr = await env.GAME_CODES.get(joinCode);
      if (!gameIdStr) {
        return new Response(
          JSON.stringify({ error: 'Game not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get game info from Durable Object
      const gameId = env.GAME.idFromString(gameIdStr);
      const gameStub = env.GAME.get(gameId);

      const response = await gameStub.fetch(new Request('https://internal/info'));
      const gameInfo = await response.json();

      return new Response(
        JSON.stringify(gameInfo),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
