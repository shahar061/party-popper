// Global mocks for Cloudflare Workers environment

// Mock WebSocketPair
class MockWebSocket {
  readyState = 1; // OPEN
  send = () => {};
  close = () => {};
  addEventListener = () => {};
  removeEventListener = () => {};
}

(globalThis as any).WebSocketPair = class WebSocketPair {
  0: MockWebSocket;
  1: MockWebSocket;

  constructor() {
    this[0] = new MockWebSocket();
    this[1] = new MockWebSocket();
  }
};

// Mock Response with webSocket property support and 101 status
const OriginalResponse = globalThis.Response;

class MockResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: BodyInit | null;
  webSocket?: any;
  ok: boolean;

  constructor(body?: BodyInit | null, init?: ResponseInit & { webSocket?: any; status?: number }) {
    this.body = body || null;
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? '';
    this.headers = new Headers(init?.headers);
    this.webSocket = init?.webSocket;
    this.ok = this.status >= 200 && this.status < 300;
  }

  json() {
    return Promise.resolve(JSON.parse(this.body as string));
  }

  text() {
    return Promise.resolve(this.body as string);
  }
}

(globalThis as any).Response = MockResponse;
