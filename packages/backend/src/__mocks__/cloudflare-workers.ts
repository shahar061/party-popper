// Mock for cloudflare:workers in test environment

export class DurableObject {
  ctx: DurableObjectState;
  env: unknown;

  constructor(ctx: DurableObjectState, env: unknown) {
    this.ctx = ctx;
    this.env = env;
  }
}

export interface DurableObjectState {
  storage: DurableObjectStorage;
  getWebSockets(tag?: string): WebSocket[];
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
}

export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}
