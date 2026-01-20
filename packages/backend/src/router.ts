import { generateJoinCode } from './utils/join-code';

export interface Env {
  GAME: DurableObjectNamespace;
  GAME_CODES: KVNamespace;
  QR_LOGS: KVNamespace;
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
    // POST /api/qr-log/failed - Log a failed QR code URL
    if (path === '/api/qr-log/failed' && request.method === 'POST') {
      const body = await request.json() as { url: string; songTitle?: string; gameCode?: string };
      const logEntry = {
        url: body.url,
        songTitle: body.songTitle || 'unknown',
        gameCode: body.gameCode || 'unknown',
        timestamp: new Date().toISOString(),
      };

      // Store with unique key based on timestamp
      const key = `failed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await env.QR_LOGS.put(key, JSON.stringify(logEntry), { expirationTtl: 86400 * 7 }); // 7 days

      console.log('[QR Log] Failed URL logged:', logEntry);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // POST /api/qr-log/success - Log a successful QR code URL
    if (path === '/api/qr-log/success' && request.method === 'POST') {
      const body = await request.json() as { url: string; songTitle?: string; gameCode?: string };
      const logEntry = {
        url: body.url,
        songTitle: body.songTitle || 'unknown',
        gameCode: body.gameCode || 'unknown',
        timestamp: new Date().toISOString(),
      };

      // Store with unique key based on timestamp
      const key = `success-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await env.QR_LOGS.put(key, JSON.stringify(logEntry), { expirationTtl: 86400 * 7 }); // 7 days

      console.log('[QR Log] Success URL logged:', logEntry);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // GET /api/qr-log - Get all QR logs (for debugging)
    if (path === '/api/qr-log' && request.method === 'GET') {
      const failedList = await env.QR_LOGS.list({ prefix: 'failed-' });
      const successList = await env.QR_LOGS.list({ prefix: 'success-' });

      const failed = await Promise.all(
        failedList.keys.map(async (k) => JSON.parse(await env.QR_LOGS.get(k.name) || '{}'))
      );
      const success = await Promise.all(
        successList.keys.map(async (k) => JSON.parse(await env.QR_LOGS.get(k.name) || '{}'))
      );

      return new Response(JSON.stringify({ failed, success }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // GET /qr/track - QR code redirect with tracking
    if (path === '/qr/track' && request.method === 'GET') {
      const joinCode = url.searchParams.get('code');
      const spotifyUrl = url.searchParams.get('spotify');

      console.log('[QR Scan] Received scan for game:', joinCode);

      if (!joinCode || !spotifyUrl) {
        return new Response('Missing parameters', { status: 400 });
      }

      // Notify game instance of scan (fire and forget)
      try {
        const gameId = env.GAME.idFromName(joinCode);
        const gameStub = env.GAME.get(gameId);

        console.log('[QR Scan] Notifying game instance:', joinCode);
        gameStub.fetch(new Request('https://internal/qr-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scannedAt: Date.now(),
            userAgent: request.headers.get('User-Agent')
          })
        })).catch((error) => {
          console.error('[QR Scan] Error notifying game:', error);
        });
      } catch (error) {
        console.error('[QR Scan] Failed to notify game of scan:', error);
      }

      console.log('[QR Scan] Redirecting to Spotify');
      // Redirect to Spotify
      return new Response(null, {
        status: 302,
        headers: {
          'Location': decodeURIComponent(spotifyUrl),
          'Cache-Control': 'no-cache'
        }
      });
    }

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

    // GET /api/games/:code/ws - WebSocket connection
    const wsMatch = path.match(/^\/api\/games\/([A-Z0-9]{4})\/ws$/);
    if (wsMatch && request.headers.get('Upgrade') === 'websocket') {
      const joinCode = wsMatch[1];

      // Verify game exists in KV
      const gameIdStr = await env.GAME_CODES.get(joinCode);
      if (!gameIdStr) {
        return new Response(
          JSON.stringify({ error: 'Game not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // IMPORTANT: Use idFromName to get the SAME Durable Object instance
      // that was created during game creation
      const gameId = env.GAME.idFromName(joinCode);
      const gameStub = env.GAME.get(gameId);
      return gameStub.fetch(request);
    }

    // GET /api/games/:code - Get game info
    const gameInfoMatch = path.match(/^\/api\/games\/([A-Z0-9]{4})$/);
    if (gameInfoMatch && request.method === 'GET') {
      const joinCode = gameInfoMatch[1];

      // Verify game exists in KV
      const gameIdStr = await env.GAME_CODES.get(joinCode);
      if (!gameIdStr) {
        return new Response(
          JSON.stringify({ error: 'Game not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // IMPORTANT: Use idFromName to get the SAME Durable Object instance
      const gameId = env.GAME.idFromName(joinCode);
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
