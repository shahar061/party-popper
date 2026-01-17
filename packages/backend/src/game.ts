import { DurableObject } from 'cloudflare:workers';

export interface Env {
  GAME: DurableObjectNamespace;
}

export class GameDO extends DurableObject {
  private connections: Set<WebSocket> = new Set();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.connections.add(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // HTTP endpoints for game info
    if (url.pathname === '/info') {
      return new Response(JSON.stringify({
        connections: this.connections.size,
        status: 'stub',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Message handling will be implemented in Phase 2
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
    console.log('Received message:', data);

    // Echo back for now (stub behavior)
    ws.send(JSON.stringify({ type: 'echo', data }));
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.connections.delete(ws);
    console.log(`WebSocket closed: ${code} ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    this.connections.delete(ws);
  }
}
