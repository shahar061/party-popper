import { Game } from './game';
import { handleRequest, Env as RouterEnv } from './router';

export interface Env extends RouterEnv {
  ALLOWED_ORIGINS: string;
  ENVIRONMENT: string;
}

export { Game };

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || [];

  // In development, allow all origins
  if (env.ENVIRONMENT === 'development' || allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  return {};
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = getCorsHeaders(request, env);

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (path === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', environment: env.ENVIRONMENT }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Game routes - delegate to router
    if (path.startsWith('/api/games')) {
      return handleRequest(request, env);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
