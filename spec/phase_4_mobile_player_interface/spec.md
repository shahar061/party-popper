# Phase 4: Mobile Player Interface - Implementation Spec

## Overview

This phase builds the mobile web app that players use to join and participate in Party Popper games. The mobile interface must be touch-friendly, handle WebSocket connections reliably, and work across iOS Safari and Android Chrome.

**Dependencies**: Phase 3 complete (host display working, can verify player join flow end-to-end)

**Milestone**: Players can join via QR/code, see their team, and interact with the game. Ready for gameplay implementation.

---

## Task player-001: Create mobile-optimized layout and navigation

**Files:**
- Modify: `apps/player/index.html`
- Create: `apps/player/src/styles/globals.css`
- Create: `apps/player/src/components/Layout.tsx`
- Test: `apps/player/src/__tests__/Layout.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/Layout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Layout } from '../components/Layout';

describe('Layout', () => {
  it('renders children within mobile-optimized container', () => {
    render(
      <Layout>
        <div data-testid="child">Content</div>
      </Layout>
    );

    const child = screen.getByTestId('child');
    expect(child).toBeInTheDocument();
  });

  it('has no horizontal overflow', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveClass('overflow-x-hidden');
  });

  it('applies minimum touch target sizing class', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveClass('min-h-screen');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run Layout.test.tsx`

Expected: FAIL with "Cannot find module '../components/Layout'"

**Step 3: Implement**

```html
<!-- apps/player/index.html - update viewport meta -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#1a1a2e" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Party Popper - Player</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```css
/* apps/player/src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    /* Prevent text size adjustment on orientation change */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    @apply bg-slate-900 text-white antialiased;
    /* Prevent pull-to-refresh on mobile */
    overscroll-behavior-y: contain;
  }

  /* Minimum touch target size (44x44px per Apple HIG) */
  button,
  [role="button"],
  input[type="submit"],
  input[type="button"] {
    @apply min-h-[44px] min-w-[44px];
  }

  /* Prevent input zoom on iOS (requires 16px+ font) */
  input,
  select,
  textarea {
    @apply text-base;
  }
}

@layer utilities {
  /* Safe area padding for notched devices */
  .safe-area-inset {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }

  /* Dynamic viewport height for mobile */
  .h-screen-dynamic {
    height: 100vh;
    height: 100dvh;
  }

  .min-h-screen-dynamic {
    min-height: 100vh;
    min-height: 100dvh;
  }
}
```

```typescript
// apps/player/src/components/Layout.tsx
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen min-h-screen-dynamic overflow-x-hidden bg-slate-900 safe-area-inset">
      <div className="flex flex-col min-h-screen-dynamic w-full max-w-md mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run Layout.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/index.html apps/player/src/styles/globals.css apps/player/src/components/Layout.tsx apps/player/src/__tests__/Layout.test.tsx
git commit -m "feat(player): add mobile-optimized layout with touch targets and safe areas"
```

---

## Task player-002: Build join screen with code entry and name input

**Files:**
- Create: `apps/player/src/components/JoinScreen.tsx`
- Create: `apps/player/src/hooks/useJoinGame.ts`
- Test: `apps/player/src/__tests__/JoinScreen.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/JoinScreen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { JoinScreen } from '../components/JoinScreen';

describe('JoinScreen', () => {
  const mockOnJoin = vi.fn();

  beforeEach(() => {
    mockOnJoin.mockClear();
  });

  it('renders code input with 4 character limit', () => {
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    expect(codeInput).toBeInTheDocument();
    expect(codeInput).toHaveAttribute('maxLength', '4');
  });

  it('auto-uppercases code input', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    await user.type(codeInput, 'abcd');

    expect(codeInput).toHaveValue('ABCD');
  });

  it('renders name input with 20 character limit', () => {
    render(<JoinScreen onJoin={mockOnJoin} />);

    const nameInput = screen.getByLabelText(/your name/i);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('maxLength', '20');
  });

  it('disables join button when code is incomplete', () => {
    render(<JoinScreen onJoin={mockOnJoin} />);

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeDisabled();
  });

  it('disables join button when name is empty', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    await user.type(codeInput, 'ABCD');

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeDisabled();
  });

  it('enables join button when code and name are valid', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    const nameInput = screen.getByLabelText(/your name/i);

    await user.type(codeInput, 'ABCD');
    await user.type(nameInput, 'Player1');

    const joinButton = screen.getByRole('button', { name: /join/i });
    expect(joinButton).toBeEnabled();
  });

  it('calls onJoin with code and name when form is submitted', async () => {
    const user = userEvent.setup();
    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    const nameInput = screen.getByLabelText(/your name/i);

    await user.type(codeInput, 'ABCD');
    await user.type(nameInput, 'Player1');
    await user.click(screen.getByRole('button', { name: /join/i }));

    expect(mockOnJoin).toHaveBeenCalledWith({
      code: 'ABCD',
      name: 'Player1',
    });
  });

  it('pre-fills code from URL parameter', () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, search: '?code=WXYZ' } as Location;

    render(<JoinScreen onJoin={mockOnJoin} />);

    const codeInput = screen.getByLabelText(/game code/i);
    expect(codeInput).toHaveValue('WXYZ');

    window.location = originalLocation;
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run JoinScreen.test.tsx`

Expected: FAIL with "Cannot find module '../components/JoinScreen'"

**Step 3: Implement**

```typescript
// apps/player/src/hooks/useJoinGame.ts
import { useState, useCallback, useEffect } from 'react';

interface JoinGameState {
  code: string;
  name: string;
  isLoading: boolean;
  error: string | null;
}

interface UseJoinGameReturn extends JoinGameState {
  setCode: (code: string) => void;
  setName: (name: string) => void;
  isValid: boolean;
}

export function useJoinGame(): UseJoinGameReturn {
  const [state, setState] = useState<JoinGameState>({
    code: '',
    name: '',
    isLoading: false,
    error: null,
  });

  // Pre-fill code from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && codeParam.length === 4) {
      setState(prev => ({ ...prev, code: codeParam.toUpperCase() }));
    }
  }, []);

  const setCode = useCallback((code: string) => {
    // Auto-uppercase and limit to 4 chars, alphanumeric only
    const sanitized = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setState(prev => ({ ...prev, code: sanitized, error: null }));
  }, []);

  const setName = useCallback((name: string) => {
    // Limit to 20 chars, trim whitespace
    const sanitized = name.slice(0, 20);
    setState(prev => ({ ...prev, name: sanitized, error: null }));
  }, []);

  const isValid = state.code.length === 4 && state.name.trim().length > 0;

  return {
    ...state,
    setCode,
    setName,
    isValid,
  };
}
```

```typescript
// apps/player/src/components/JoinScreen.tsx
import { FormEvent } from 'react';
import { useJoinGame } from '../hooks/useJoinGame';

interface JoinScreenProps {
  onJoin: (data: { code: string; name: string }) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function JoinScreen({ onJoin, isLoading = false, error }: JoinScreenProps) {
  const { code, name, setCode, setName, isValid } = useJoinGame();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isValid && !isLoading) {
      onJoin({ code, name: name.trim() });
    }
  };

  return (
    <div className="flex flex-col flex-1 justify-center">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Party Popper</h1>
        <p className="text-slate-400">Join a game to play</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="game-code"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Game Code
          </label>
          <input
            id="game-code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD"
            className="w-full px-4 py-4 text-2xl text-center font-mono tracking-[0.5em]
                       bg-slate-800 border-2 border-slate-700 rounded-xl
                       text-white placeholder-slate-500
                       focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                       transition-colors"
            aria-describedby={error ? 'join-error' : undefined}
          />
        </div>

        <div>
          <label
            htmlFor="player-name"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Your Name
          </label>
          <input
            id="player-name"
            type="text"
            autoComplete="name"
            autoCorrect="off"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-4 text-lg
                       bg-slate-800 border-2 border-slate-700 rounded-xl
                       text-white placeholder-slate-500
                       focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                       transition-colors"
          />
        </div>

        {error && (
          <div
            id="join-error"
            role="alert"
            className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="w-full py-4 px-6 text-lg font-semibold
                     bg-purple-600 hover:bg-purple-700
                     disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
                     rounded-xl text-white
                     focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900
                     transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Joining...
            </span>
          ) : (
            'Join Game'
          )}
        </button>
      </form>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run JoinScreen.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/JoinScreen.tsx apps/player/src/hooks/useJoinGame.ts apps/player/src/__tests__/JoinScreen.test.tsx
git commit -m "feat(player): add join screen with code entry and name input"
```

---

## Task player-003: Implement WebSocket connection with shared hooks

**Files:**
- Create: `packages/shared/src/hooks/useGameConnection.ts`
- Create: `packages/shared/src/hooks/index.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/player/src/contexts/GameContext.tsx`
- Test: `packages/shared/src/__tests__/useGameConnection.test.ts`

**Step 1: Write failing test**

```typescript
// packages/shared/src/__tests__/useGameConnection.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameConnection, ConnectionState } from '../hooks/useGameConnection';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();
  close = vi.fn();

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateClose(code = 1000) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

describe('useGameConnection', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in disconnected state', () => {
    const { result } = renderHook(() => useGameConnection());

    expect(result.current.state).toBe(ConnectionState.Disconnected);
    expect(result.current.isConnected).toBe(false);
  });

  it('connects to WebSocket URL when connect is called', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
    });

    expect(result.current.state).toBe(ConnectionState.Connecting);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toBe('wss://example.com/ws');
  });

  it('updates state to connected when WebSocket opens', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.state).toBe(ConnectionState.Connected);
    expect(result.current.isConnected).toBe(true);
  });

  it('calls onMessage callback when message received', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useGameConnection({ onMessage }));

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage({ type: 'state_sync', payload: {} });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'state_sync', payload: {} });
  });

  it('sends message through WebSocket', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.send({ type: 'join', payload: { name: 'Player1' } });
    });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'join', payload: { name: 'Player1' } })
    );
  });

  it('attempts reconnection on unexpected close', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateClose(1006); // Abnormal close
    });

    expect(result.current.state).toBe(ConnectionState.Reconnecting);

    act(() => {
      vi.advanceTimersByTime(1000); // First retry delay
    });

    expect(MockWebSocket.instances.length).toBe(2);
    vi.useRealTimers();
  });

  it('calls disconnect to close connection', async () => {
    const { result } = renderHook(() => useGameConnection());

    act(() => {
      result.current.connect('wss://example.com/ws');
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
    expect(result.current.state).toBe(ConnectionState.Disconnected);
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter shared test -- --run useGameConnection.test.ts`

Expected: FAIL with "Cannot find module '../hooks/useGameConnection'"

**Step 3: Implement**

```typescript
// packages/shared/src/hooks/useGameConnection.ts
import { useState, useRef, useCallback, useEffect } from 'react';

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
}

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
}

export interface UseGameConnectionOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
}

export interface UseGameConnectionReturn {
  state: ConnectionState;
  isConnected: boolean;
  reconnectAttempt: number;
  connect: (url: string) => void;
  disconnect: () => void;
  send: (message: WebSocketMessage) => void;
}

export function useGameConnection(
  options: UseGameConnectionOptions = {}
): UseGameConnectionReturn {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    maxReconnectAttempts = 5,
    reconnectBaseDelay = 1000,
  } = options;

  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const urlRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback((url: string) => {
    clearReconnectTimeout();
    intentionalCloseRef.current = false;
    urlRef.current = url;

    if (wsRef.current) {
      wsRef.current.close();
    }

    setState(ConnectionState.Connecting);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(ConnectionState.Connected);
      setReconnectAttempt(0);
      onConnect?.();
    };

    ws.onclose = (event) => {
      wsRef.current = null;

      if (intentionalCloseRef.current) {
        setState(ConnectionState.Disconnected);
        onDisconnect?.();
        return;
      }

      // Abnormal close - attempt reconnection
      if (event.code !== 1000 && reconnectAttempt < maxReconnectAttempts && urlRef.current) {
        setState(ConnectionState.Reconnecting);
        const delay = reconnectBaseDelay * Math.pow(2, reconnectAttempt);

        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          connect(urlRef.current!);
        }, delay);
      } else {
        setState(ConnectionState.Disconnected);
        onDisconnect?.();
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        onMessage?.(message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (event) => {
      onError?.(event);
    };
  }, [onConnect, onDisconnect, onMessage, onError, maxReconnectAttempts, reconnectBaseDelay, reconnectAttempt, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    intentionalCloseRef.current = true;
    setReconnectAttempt(0);

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
    }

    setState(ConnectionState.Disconnected);
  }, [clearReconnectTimeout]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clearReconnectTimeout]);

  return {
    state,
    isConnected: state === ConnectionState.Connected,
    reconnectAttempt,
    connect,
    disconnect,
    send,
  };
}
```

```typescript
// packages/shared/src/hooks/index.ts
export { useGameConnection, ConnectionState } from './useGameConnection';
export type {
  UseGameConnectionOptions,
  UseGameConnectionReturn,
  WebSocketMessage
} from './useGameConnection';
```

```typescript
// packages/shared/src/index.ts - add export
export * from './types';
export * from './hooks';
```

```typescript
// apps/player/src/contexts/GameContext.tsx
import { createContext, useContext, ReactNode, useCallback, useState } from 'react';
import {
  useGameConnection,
  ConnectionState,
  WebSocketMessage
} from '@party-popper/shared';
import type { GameState, Player } from '@party-popper/shared';

interface GameContextValue {
  // Connection
  connectionState: ConnectionState;
  isConnected: boolean;
  reconnectAttempt: number;
  connect: (gameCode: string, playerName: string) => void;
  disconnect: () => void;

  // Game state
  gameState: GameState | null;
  currentPlayer: Player | null;
  error: string | null;

  // Actions
  send: (message: WebSocketMessage) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
}

export function GameProvider({
  children,
  apiBaseUrl = import.meta.env.VITE_API_URL || ''
}: GameProviderProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'state_sync':
        setGameState(message.payload as GameState);
        break;
      case 'player_joined':
        // Update handled via state_sync
        break;
      case 'error':
        setError((message.payload as { message: string }).message);
        break;
      default:
        console.log('Unhandled message type:', message.type);
    }
  }, []);

  const handleConnect = useCallback(() => {
    setError(null);
  }, []);

  const handleDisconnect = useCallback(() => {
    // Keep game state for potential reconnection
  }, []);

  const handleError = useCallback(() => {
    setError('Connection error occurred');
  }, []);

  const {
    state: connectionState,
    isConnected,
    reconnectAttempt,
    connect: wsConnect,
    disconnect,
    send,
  } = useGameConnection({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  });

  const connect = useCallback(async (gameCode: string, playerName: string) => {
    setError(null);

    try {
      // First, validate the game exists
      const response = await fetch(`${apiBaseUrl}/api/games/${gameCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Game not found. Check the code and try again.');
          return;
        }
        throw new Error('Failed to join game');
      }

      const { wsUrl } = await response.json();

      // Store player info for reconnection
      sessionStorage.setItem('party-popper-session', JSON.stringify({
        gameCode,
        playerName,
        timestamp: Date.now(),
      }));

      // Connect to WebSocket
      wsConnect(wsUrl);

      // Send join message once connected (handled in onConnect)
      // Actually need to wait for connection, so we'll send after
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    }
  }, [apiBaseUrl, wsConnect]);

  const value: GameContextValue = {
    connectionState,
    isConnected,
    reconnectAttempt,
    connect,
    disconnect,
    gameState,
    currentPlayer,
    error,
    send,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter shared test -- --run useGameConnection.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/hooks/useGameConnection.ts packages/shared/src/hooks/index.ts packages/shared/src/index.ts apps/player/src/contexts/GameContext.tsx packages/shared/src/__tests__/useGameConnection.test.ts
git commit -m "feat(shared): add WebSocket connection hook with auto-reconnect"
```

---

## Task player-004: Create team assignment confirmation screen

**Files:**
- Create: `apps/player/src/components/TeamAssignment.tsx`
- Test: `apps/player/src/__tests__/TeamAssignment.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/TeamAssignment.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TeamAssignment } from '../components/TeamAssignment';

const mockTeamA = {
  name: 'Team A',
  players: [
    { id: '1', name: 'Alice', connected: true, lastSeen: Date.now() },
    { id: '2', name: 'Bob', connected: true, lastSeen: Date.now() },
  ],
  timeline: [],
  vetoTokens: 3,
  score: 0,
};

const mockTeamB = {
  name: 'Team B',
  players: [
    { id: '3', name: 'Charlie', connected: true, lastSeen: Date.now() },
  ],
  timeline: [],
  vetoTokens: 3,
  score: 0,
};

describe('TeamAssignment', () => {
  it('renders assigned team name', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    expect(screen.getByText(/team a/i)).toBeInTheDocument();
  });

  it('shows team color indicator', () => {
    const { container } = render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    // Team A should have purple/indigo color
    const teamIndicator = container.querySelector('[class*="bg-indigo"]');
    expect(teamIndicator).toBeInTheDocument();
  });

  it('lists teammates', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('highlights current player name', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    const aliceElement = screen.getByText('Alice');
    expect(aliceElement.closest('[class*="font-bold"]') || aliceElement).toHaveClass('font-bold');
  });

  it('displays waiting for game start message', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    expect(screen.getByText(/waiting for host to start/i)).toBeInTheDocument();
  });

  it('shows Team B styling when assigned to Team B', () => {
    const { container } = render(
      <TeamAssignment
        assignedTeam="B"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Charlie"
      />
    );

    // Team B should have amber/orange color
    const teamIndicator = container.querySelector('[class*="bg-amber"]');
    expect(teamIndicator).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run TeamAssignment.test.tsx`

Expected: FAIL with "Cannot find module '../components/TeamAssignment'"

**Step 3: Implement**

```typescript
// apps/player/src/components/TeamAssignment.tsx
import type { Team } from '@party-popper/shared';

interface TeamAssignmentProps {
  assignedTeam: 'A' | 'B';
  teamA: Team;
  teamB: Team;
  playerName: string;
}

export function TeamAssignment({
  assignedTeam,
  teamA,
  teamB,
  playerName
}: TeamAssignmentProps) {
  const myTeam = assignedTeam === 'A' ? teamA : teamB;
  const isTeamA = assignedTeam === 'A';

  const teamColorClasses = isTeamA
    ? 'bg-indigo-600 border-indigo-500'
    : 'bg-amber-600 border-amber-500';

  const teamBgClasses = isTeamA
    ? 'bg-indigo-900/30 border-indigo-700/50'
    : 'bg-amber-900/30 border-amber-700/50';

  return (
    <div className="flex flex-col flex-1">
      {/* Team badge */}
      <div className="text-center mb-8">
        <div className={`inline-block px-6 py-3 rounded-2xl ${teamColorClasses}`}>
          <p className="text-sm text-white/80 mb-1">You are on</p>
          <h2 className="text-2xl font-bold text-white">
            {myTeam.name || `Team ${assignedTeam}`}
          </h2>
        </div>
      </div>

      {/* Teammates list */}
      <div className={`rounded-xl border p-4 mb-6 ${teamBgClasses}`}>
        <h3 className="text-sm font-medium text-slate-400 mb-3">Your Teammates</h3>
        <ul className="space-y-2">
          {myTeam.players.map((player) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 ${
                player.name === playerName ? 'font-bold text-white' : 'text-slate-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  player.connected ? 'bg-green-500' : 'bg-slate-500'
                }`}
                aria-label={player.connected ? 'Online' : 'Offline'}
              />
              <span>{player.name}</span>
              {player.name === playerName && (
                <span className="text-xs text-slate-500">(you)</span>
              )}
            </li>
          ))}
        </ul>

        {myTeam.players.length === 1 && (
          <p className="text-sm text-slate-500 mt-3 italic">
            Waiting for more teammates to join...
          </p>
        )}
      </div>

      {/* Waiting message */}
      <div className="mt-auto text-center py-8">
        <div className="inline-flex items-center gap-2 text-slate-400">
          <svg
            className="w-5 h-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Waiting for host to start the game</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run TeamAssignment.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/TeamAssignment.tsx apps/player/src/__tests__/TeamAssignment.test.tsx
git commit -m "feat(player): add team assignment confirmation screen"
```

---

## Task player-005: Build waiting/lobby view showing other players

**Files:**
- Create: `apps/player/src/components/LobbyView.tsx`
- Test: `apps/player/src/__tests__/LobbyView.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/LobbyView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LobbyView } from '../components/LobbyView';

const mockTeamA = {
  name: 'Team A',
  players: [
    { id: '1', name: 'Alice', connected: true, lastSeen: Date.now() },
    { id: '2', name: 'Bob', connected: true, lastSeen: Date.now() },
  ],
  timeline: [],
  vetoTokens: 3,
  score: 0,
};

const mockTeamB = {
  name: 'Team B',
  players: [
    { id: '3', name: 'Charlie', connected: true, lastSeen: Date.now() },
    { id: '4', name: 'Diana', connected: false, lastSeen: Date.now() - 60000 },
  ],
  timeline: [],
  vetoTokens: 3,
  score: 0,
};

describe('LobbyView', () => {
  it('renders both team columns', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Team B')).toBeInTheDocument();
  });

  it('shows all players from both teams', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('shows connection status indicators', () => {
    const { container } = render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    // Should have green dots for connected players
    const greenDots = container.querySelectorAll('.bg-green-500');
    expect(greenDots.length).toBe(3); // Alice, Bob, Charlie

    // Should have gray/slate dot for disconnected Diana
    const grayDots = container.querySelectorAll('.bg-slate-500');
    expect(grayDots.length).toBe(1);
  });

  it('updates when players join or leave', () => {
    const { rerender } = render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.queryByText('Eve')).not.toBeInTheDocument();

    const updatedTeamA = {
      ...mockTeamA,
      players: [
        ...mockTeamA.players,
        { id: '5', name: 'Eve', connected: true, lastSeen: Date.now() },
      ],
    };

    rerender(
      <LobbyView
        teamA={updatedTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('displays game code', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('ABCD')).toBeInTheDocument();
  });

  it('shows game starting indicator when isStarting is true', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
        isStarting={true}
      />
    );

    expect(screen.getByText(/game is starting/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run LobbyView.test.tsx`

Expected: FAIL with "Cannot find module '../components/LobbyView'"

**Step 3: Implement**

```typescript
// apps/player/src/components/LobbyView.tsx
import type { Team } from '@party-popper/shared';

interface LobbyViewProps {
  teamA: Team;
  teamB: Team;
  currentPlayerId: string;
  gameCode: string;
  isStarting?: boolean;
}

interface TeamColumnProps {
  team: Team;
  teamLabel: 'A' | 'B';
  currentPlayerId: string;
}

function TeamColumn({ team, teamLabel, currentPlayerId }: TeamColumnProps) {
  const isTeamA = teamLabel === 'A';
  const headerColor = isTeamA ? 'bg-indigo-600' : 'bg-amber-600';
  const borderColor = isTeamA ? 'border-indigo-700/50' : 'border-amber-700/50';
  const bgColor = isTeamA ? 'bg-indigo-900/20' : 'bg-amber-900/20';

  return (
    <div className={`flex-1 rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
      <div className={`${headerColor} px-3 py-2`}>
        <h3 className="text-sm font-semibold text-white text-center">
          {team.name || `Team ${teamLabel}`}
        </h3>
      </div>

      <ul className="p-3 space-y-2">
        {team.players.map((player) => (
          <li
            key={player.id}
            className={`flex items-center gap-2 text-sm ${
              player.id === currentPlayerId
                ? 'font-semibold text-white'
                : 'text-slate-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                player.connected ? 'bg-green-500' : 'bg-slate-500'
              }`}
              aria-label={player.connected ? 'Online' : 'Offline'}
            />
            <span className="truncate">{player.name}</span>
            {player.id === currentPlayerId && (
              <span className="text-xs text-slate-500">(you)</span>
            )}
          </li>
        ))}

        {team.players.length === 0 && (
          <li className="text-sm text-slate-500 italic text-center py-2">
            No players yet
          </li>
        )}
      </ul>
    </div>
  );
}

export function LobbyView({
  teamA,
  teamB,
  currentPlayerId,
  gameCode,
  isStarting = false
}: LobbyViewProps) {
  const totalPlayers = teamA.players.length + teamB.players.length;

  return (
    <div className="flex flex-col flex-1">
      {/* Header with game code */}
      <div className="text-center mb-6">
        <p className="text-sm text-slate-400 mb-1">Game Code</p>
        <p className="text-2xl font-mono font-bold tracking-widest text-white">
          {gameCode}
        </p>
        <p className="text-sm text-slate-500 mt-2">
          {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} in lobby
        </p>
      </div>

      {/* Teams side by side */}
      <div className="flex gap-3 flex-1 min-h-0">
        <TeamColumn
          team={teamA}
          teamLabel="A"
          currentPlayerId={currentPlayerId}
        />
        <TeamColumn
          team={teamB}
          teamLabel="B"
          currentPlayerId={currentPlayerId}
        />
      </div>

      {/* Status footer */}
      <div className="mt-6 text-center py-4">
        {isStarting ? (
          <div className="inline-flex items-center gap-2 text-green-400 font-medium">
            <svg
              className="w-5 h-5 animate-pulse"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span>Game is starting!</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-slate-400">
            <svg
              className="w-5 h-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Waiting for host to start...</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run LobbyView.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/LobbyView.tsx apps/player/src/__tests__/LobbyView.test.tsx
git commit -m "feat(player): add lobby view showing all players in both teams"
```

---

## Task player-006: Design touch-friendly input components for gameplay

**Files:**
- Create: `apps/player/src/components/ui/TextInput.tsx`
- Create: `apps/player/src/components/ui/YearInput.tsx`
- Create: `apps/player/src/components/ui/Button.tsx`
- Create: `apps/player/src/components/ui/index.ts`
- Test: `apps/player/src/__tests__/ui/YearInput.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/ui/YearInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { YearInput } from '../../components/ui/YearInput';

describe('YearInput', () => {
  it('renders year value', () => {
    render(<YearInput value={1985} onChange={vi.fn()} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1985);
  });

  it('has increment button that increases year by 1', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={1985} onChange={onChange} />);

    const incrementButton = screen.getByRole('button', { name: /increase year/i });
    await user.click(incrementButton);

    expect(onChange).toHaveBeenCalledWith(1986);
  });

  it('has decrement button that decreases year by 1', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={1985} onChange={onChange} />);

    const decrementButton = screen.getByRole('button', { name: /decrease year/i });
    await user.click(decrementButton);

    expect(onChange).toHaveBeenCalledWith(1984);
  });

  it('respects min value constraint', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={1950} onChange={onChange} min={1950} />);

    const decrementButton = screen.getByRole('button', { name: /decrease year/i });
    await user.click(decrementButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects max value constraint', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={2030} onChange={onChange} max={2030} />);

    const incrementButton = screen.getByRole('button', { name: /increase year/i });
    await user.click(incrementButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows direct input of year value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<YearInput value={1985} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '1999');

    // onChange called on each character
    expect(onChange).toHaveBeenLastCalledWith(1999);
  });

  it('has touch-friendly button sizes (min 44px)', () => {
    const { container } = render(<YearInput value={1985} onChange={vi.fn()} />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      expect(button).toHaveClass('min-h-[44px]');
      expect(button).toHaveClass('min-w-[44px]');
    });
  });

  it('supports disabled state', () => {
    render(<YearInput value={1985} onChange={vi.fn()} disabled />);

    const input = screen.getByRole('spinbutton');
    const incrementButton = screen.getByRole('button', { name: /increase year/i });
    const decrementButton = screen.getByRole('button', { name: /decrease year/i });

    expect(input).toBeDisabled();
    expect(incrementButton).toBeDisabled();
    expect(decrementButton).toBeDisabled();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run YearInput.test.tsx`

Expected: FAIL with "Cannot find module '../../components/ui/YearInput'"

**Step 3: Implement**

```typescript
// apps/player/src/components/ui/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-xl ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ' +
    'transition-colors disabled:cursor-not-allowed min-h-[44px] min-w-[44px]';

  const variantClasses = {
    primary:
      'bg-purple-600 hover:bg-purple-700 text-white ' +
      'focus:ring-purple-500 disabled:bg-slate-700 disabled:text-slate-500',
    secondary:
      'bg-slate-700 hover:bg-slate-600 text-white ' +
      'focus:ring-slate-500 disabled:bg-slate-800 disabled:text-slate-600',
    ghost:
      'bg-transparent hover:bg-slate-800 text-slate-300 ' +
      'focus:ring-slate-500 disabled:text-slate-600',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}
```

```typescript
// apps/player/src/components/ui/TextInput.tsx
import { InputHTMLAttributes, forwardRef } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-300 mb-2"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-4 text-lg
            bg-slate-800 border-2 rounded-xl
            text-white placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-purple-500/50
            transition-colors
            disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed
            ${error
              ? 'border-red-500 focus:border-red-500'
              : 'border-slate-700 focus:border-purple-500'
            }
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-2 text-sm text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';
```

```typescript
// apps/player/src/components/ui/YearInput.tsx
import { ChangeEvent } from 'react';

interface YearInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}

export function YearInput({
  value,
  onChange,
  min = 1950,
  max = 2030,
  disabled = false,
  label = 'Year',
}: YearInputProps) {
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      const clampedValue = Math.min(max, Math.max(min, newValue));
      onChange(clampedValue);
    }
  };

  const canDecrement = value > min && !disabled;
  const canIncrement = value < max && !disabled;

  return (
    <div className="w-full">
      <label
        htmlFor="year-input"
        className="block text-sm font-medium text-slate-300 mb-2"
      >
        {label}
      </label>

      <div className="flex items-center gap-2">
        {/* Decrement button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={!canDecrement}
          aria-label="Decrease year"
          className={`
            min-h-[44px] min-w-[44px] flex items-center justify-center
            rounded-xl text-2xl font-bold
            transition-colors
            ${canDecrement
              ? 'bg-slate-700 hover:bg-slate-600 text-white active:bg-slate-800'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          -
        </button>

        {/* Year input */}
        <input
          id="year-input"
          type="number"
          role="spinbutton"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          disabled={disabled}
          className={`
            flex-1 min-w-0 px-4 py-3 text-xl text-center font-mono
            bg-slate-800 border-2 border-slate-700 rounded-xl
            text-white
            focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
            disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed
            transition-colors
            [appearance:textfield]
            [&::-webkit-outer-spin-button]:appearance-none
            [&::-webkit-inner-spin-button]:appearance-none
          `}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />

        {/* Increment button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={!canIncrement}
          aria-label="Increase year"
          className={`
            min-h-[44px] min-w-[44px] flex items-center justify-center
            rounded-xl text-2xl font-bold
            transition-colors
            ${canIncrement
              ? 'bg-slate-700 hover:bg-slate-600 text-white active:bg-slate-800'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          +
        </button>
      </div>
    </div>
  );
}
```

```typescript
// apps/player/src/components/ui/index.ts
export { Button } from './Button';
export { TextInput } from './TextInput';
export { YearInput } from './YearInput';
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run YearInput.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/ui/Button.tsx apps/player/src/components/ui/TextInput.tsx apps/player/src/components/ui/YearInput.tsx apps/player/src/components/ui/index.ts apps/player/src/__tests__/ui/YearInput.test.tsx
git commit -m "feat(player): add touch-friendly UI components for gameplay inputs"
```

---

## Task player-007: Implement connection status and reconnection UI

**Files:**
- Create: `apps/player/src/components/ConnectionStatus.tsx`
- Create: `apps/player/src/components/ReconnectingOverlay.tsx`
- Test: `apps/player/src/__tests__/ConnectionStatus.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/ConnectionStatus.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { ConnectionState } from '@party-popper/shared';

describe('ConnectionStatus', () => {
  it('shows green dot when connected', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Connected} />
    );

    const statusDot = container.querySelector('.bg-green-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('shows yellow dot when connecting', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Connecting} />
    );

    const statusDot = container.querySelector('.bg-yellow-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('shows yellow animated dot when reconnecting', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Reconnecting} reconnectAttempt={2} />
    );

    const statusDot = container.querySelector('.bg-yellow-500');
    expect(statusDot).toBeInTheDocument();
    expect(statusDot).toHaveClass('animate-pulse');
  });

  it('shows red dot when disconnected', () => {
    const { container } = render(
      <ConnectionStatus state={ConnectionState.Disconnected} />
    );

    const statusDot = container.querySelector('.bg-red-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('displays reconnect attempt count when reconnecting', () => {
    render(
      <ConnectionStatus state={ConnectionState.Reconnecting} reconnectAttempt={3} />
    );

    expect(screen.getByText(/attempt 3/i)).toBeInTheDocument();
  });

  it('displays connection status text', () => {
    render(<ConnectionStatus state={ConnectionState.Connected} />);

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('shows compact mode without text when compact prop is true', () => {
    render(<ConnectionStatus state={ConnectionState.Connected} compact />);

    expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run ConnectionStatus.test.tsx`

Expected: FAIL with "Cannot find module '../components/ConnectionStatus'"

**Step 3: Implement**

```typescript
// apps/player/src/components/ConnectionStatus.tsx
import { ConnectionState } from '@party-popper/shared';

interface ConnectionStatusProps {
  state: ConnectionState;
  reconnectAttempt?: number;
  compact?: boolean;
}

const statusConfig = {
  [ConnectionState.Connected]: {
    color: 'bg-green-500',
    text: 'Connected',
    animate: false,
  },
  [ConnectionState.Connecting]: {
    color: 'bg-yellow-500',
    text: 'Connecting...',
    animate: true,
  },
  [ConnectionState.Reconnecting]: {
    color: 'bg-yellow-500',
    text: 'Reconnecting',
    animate: true,
  },
  [ConnectionState.Disconnected]: {
    color: 'bg-red-500',
    text: 'Disconnected',
    animate: false,
  },
};

export function ConnectionStatus({
  state,
  reconnectAttempt = 0,
  compact = false
}: ConnectionStatusProps) {
  const config = statusConfig[state];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          w-2.5 h-2.5 rounded-full
          ${config.color}
          ${config.animate ? 'animate-pulse' : ''}
        `}
        role="status"
        aria-label={config.text}
      />

      {!compact && (
        <span className="text-sm text-slate-400">
          {config.text}
          {state === ConnectionState.Reconnecting && reconnectAttempt > 0 && (
            <span className="text-slate-500"> (attempt {reconnectAttempt})</span>
          )}
        </span>
      )}
    </div>
  );
}
```

```typescript
// apps/player/src/components/ReconnectingOverlay.tsx
import { ConnectionState } from '@party-popper/shared';

interface ReconnectingOverlayProps {
  state: ConnectionState;
  reconnectAttempt: number;
  maxAttempts?: number;
  onCancel?: () => void;
}

export function ReconnectingOverlay({
  state,
  reconnectAttempt,
  maxAttempts = 5,
  onCancel,
}: ReconnectingOverlayProps) {
  if (state !== ConnectionState.Reconnecting && state !== ConnectionState.Connecting) {
    return null;
  }

  const isConnecting = state === ConnectionState.Connecting;
  const progress = isConnecting ? 0 : (reconnectAttempt / maxAttempts) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 text-center">
        {/* Spinner */}
        <div className="flex justify-center mb-4">
          <svg
            className="w-12 h-12 text-purple-500 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>

        {/* Status text */}
        <h2 className="text-lg font-semibold text-white mb-2">
          {isConnecting ? 'Connecting...' : 'Reconnecting...'}
        </h2>

        <p className="text-slate-400 text-sm mb-4">
          {isConnecting
            ? 'Establishing connection to the game server'
            : `Attempt ${reconnectAttempt} of ${maxAttempts}`
          }
        </p>

        {/* Progress bar for reconnection */}
        {!isConnecting && (
          <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run ConnectionStatus.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/components/ConnectionStatus.tsx apps/player/src/components/ReconnectingOverlay.tsx apps/player/src/__tests__/ConnectionStatus.test.tsx
git commit -m "feat(player): add connection status indicator and reconnection overlay"
```

---

## Task player-008: Add localStorage session persistence for reconnection

**Files:**
- Create: `apps/player/src/utils/sessionStorage.ts`
- Modify: `apps/player/src/contexts/GameContext.tsx`
- Test: `apps/player/src/__tests__/sessionStorage.test.ts`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/sessionStorage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveSession,
  getSession,
  clearSession,
  isSessionValid,
  SESSION_TIMEOUT_MS
} from '../utils/sessionStorage';

describe('sessionStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('saveSession', () => {
    it('saves session data to localStorage', () => {
      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      const stored = localStorage.getItem('party-popper-session');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.sessionId).toBe('abc123');
      expect(parsed.gameCode).toBe('WXYZ');
      expect(parsed.playerName).toBe('Alice');
    });

    it('includes timestamp when saving', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      const parsed = JSON.parse(localStorage.getItem('party-popper-session')!);
      expect(parsed.timestamp).toBe(now);
    });
  });

  describe('getSession', () => {
    it('returns null when no session exists', () => {
      expect(getSession()).toBeNull();
    });

    it('returns session data when valid session exists', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      const session = getSession();
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe('abc123');
    });

    it('returns null for expired session (older than 5 minutes)', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      // Advance time past timeout
      vi.setSystemTime(now + SESSION_TIMEOUT_MS + 1000);

      expect(getSession()).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes session from localStorage', () => {
      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      clearSession();

      expect(localStorage.getItem('party-popper-session')).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('returns true for fresh session', () => {
      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      expect(isSessionValid()).toBe(true);
    });

    it('returns false for expired session', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession({
        sessionId: 'abc123',
        gameCode: 'WXYZ',
        playerName: 'Alice',
      });

      vi.setSystemTime(now + SESSION_TIMEOUT_MS + 1000);

      expect(isSessionValid()).toBe(false);
    });

    it('returns false when no session exists', () => {
      expect(isSessionValid()).toBe(false);
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run sessionStorage.test.ts`

Expected: FAIL with "Cannot find module '../utils/sessionStorage'"

**Step 3: Implement**

```typescript
// apps/player/src/utils/sessionStorage.ts
const STORAGE_KEY = 'party-popper-session';

// 5 minutes in milliseconds (matches backend reconnection window)
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

export interface SessionData {
  sessionId: string;
  gameCode: string;
  playerName: string;
  timestamp?: number;
}

export function saveSession(data: Omit<SessionData, 'timestamp'>): void {
  const sessionData: SessionData = {
    ...data,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.warn('Failed to save session to localStorage:', e);
  }
}

export function getSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session: SessionData = JSON.parse(stored);

    // Check if session is expired
    if (session.timestamp && Date.now() - session.timestamp > SESSION_TIMEOUT_MS) {
      clearSession();
      return null;
    }

    return session;
  } catch (e) {
    console.warn('Failed to read session from localStorage:', e);
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear session from localStorage:', e);
  }
}

export function isSessionValid(): boolean {
  return getSession() !== null;
}

export function updateSessionTimestamp(): void {
  const session = getSession();
  if (session) {
    saveSession({
      sessionId: session.sessionId,
      gameCode: session.gameCode,
      playerName: session.playerName,
    });
  }
}
```

Now update GameContext to use session persistence:

```typescript
// apps/player/src/contexts/GameContext.tsx - updated version
import { createContext, useContext, ReactNode, useCallback, useState, useEffect } from 'react';
import {
  useGameConnection,
  ConnectionState,
  WebSocketMessage
} from '@party-popper/shared';
import type { GameState, Player } from '@party-popper/shared';
import { saveSession, getSession, clearSession } from '../utils/sessionStorage';

interface GameContextValue {
  // Connection
  connectionState: ConnectionState;
  isConnected: boolean;
  reconnectAttempt: number;
  connect: (gameCode: string, playerName: string) => void;
  disconnect: () => void;
  attemptReconnect: () => void;

  // Game state
  gameState: GameState | null;
  currentPlayer: Player | null;
  sessionId: string | null;
  error: string | null;

  // Actions
  send: (message: WebSocketMessage) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
}

export function GameProvider({
  children,
  apiBaseUrl = import.meta.env.VITE_API_URL || ''
}: GameProviderProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState<{ name: string; isReconnect: boolean } | null>(null);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'state_sync':
        setGameState(message.payload as GameState);
        break;
      case 'joined':
        const { sessionId: newSessionId, player } = message.payload as {
          sessionId: string;
          player: Player;
        };
        setSessionId(newSessionId);
        setCurrentPlayer(player);
        // Update stored session with server-provided session ID
        const storedSession = getSession();
        if (storedSession) {
          saveSession({
            sessionId: newSessionId,
            gameCode: storedSession.gameCode,
            playerName: storedSession.playerName,
          });
        }
        break;
      case 'error':
        setError((message.payload as { message: string }).message);
        break;
      default:
        console.log('Unhandled message type:', message.type);
    }
  }, []);

  const handleConnect = useCallback(() => {
    setError(null);
    // Send join/reconnect message after connection established
    if (pendingJoin) {
      const storedSession = getSession();
      if (pendingJoin.isReconnect && storedSession?.sessionId) {
        send({
          type: 'reconnect',
          payload: { sessionId: storedSession.sessionId },
        });
      } else {
        send({
          type: 'join',
          payload: { playerName: pendingJoin.name },
        });
      }
      setPendingJoin(null);
    }
  }, [pendingJoin]);

  const handleDisconnect = useCallback(() => {
    // Keep game state and session for potential reconnection
  }, []);

  const handleError = useCallback(() => {
    setError('Connection error occurred');
  }, []);

  const {
    state: connectionState,
    isConnected,
    reconnectAttempt,
    connect: wsConnect,
    disconnect: wsDisconnect,
    send,
  } = useGameConnection({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  });

  const connect = useCallback(async (gameCode: string, playerName: string) => {
    setError(null);

    try {
      // Validate game exists
      const response = await fetch(`${apiBaseUrl}/api/games/${gameCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Game not found. Check the code and try again.');
          return;
        }
        throw new Error('Failed to join game');
      }

      const { wsUrl } = await response.json();

      // Save session for reconnection
      saveSession({
        sessionId: '', // Will be set by server
        gameCode,
        playerName,
      });

      // Set pending join to send after connection
      setPendingJoin({ name: playerName, isReconnect: false });

      // Connect to WebSocket
      wsConnect(wsUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    }
  }, [apiBaseUrl, wsConnect]);

  const attemptReconnect = useCallback(async () => {
    const session = getSession();
    if (!session) {
      setError('No active session to reconnect');
      return;
    }

    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/games/${session.gameCode}`);

      if (!response.ok) {
        clearSession();
        setError('Game no longer exists');
        return;
      }

      const { wsUrl } = await response.json();

      // Set pending reconnect
      setPendingJoin({ name: session.playerName, isReconnect: true });

      wsConnect(wsUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reconnect');
    }
  }, [apiBaseUrl, wsConnect]);

  const disconnect = useCallback(() => {
    clearSession();
    setGameState(null);
    setCurrentPlayer(null);
    setSessionId(null);
    wsDisconnect();
  }, [wsDisconnect]);

  // Check for existing session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      attemptReconnect();
    }
  }, []);

  const value: GameContextValue = {
    connectionState,
    isConnected,
    reconnectAttempt,
    connect,
    disconnect,
    attemptReconnect,
    gameState,
    currentPlayer,
    sessionId,
    error,
    send,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run sessionStorage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/utils/sessionStorage.ts apps/player/src/contexts/GameContext.tsx apps/player/src/__tests__/sessionStorage.test.ts
git commit -m "feat(player): add localStorage session persistence for reconnection"
```

---

## Task player-009: Handle mobile browser quirks (iOS Safari, Android Chrome)

**Files:**
- Modify: `apps/player/src/styles/globals.css`
- Create: `apps/player/src/hooks/useMobileViewport.ts`
- Create: `apps/player/src/hooks/useKeyboardHeight.ts`
- Test: `apps/player/src/__tests__/useMobileViewport.test.ts`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/useMobileViewport.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMobileViewport } from '../hooks/useMobileViewport';

describe('useMobileViewport', () => {
  let originalInnerHeight: number;
  let visualViewport: { height: number; addEventListener: any; removeEventListener: any };

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;

    visualViewport = {
      height: 800,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, 'visualViewport', {
      value: visualViewport,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
    });
  });

  it('returns initial viewport height', () => {
    const { result } = renderHook(() => useMobileViewport());

    expect(result.current.viewportHeight).toBe(800);
  });

  it('sets CSS variable for viewport height', () => {
    renderHook(() => useMobileViewport());

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--vh')).toBe('8px'); // 800 * 0.01
  });

  it('detects keyboard visibility based on viewport change', () => {
    const { result } = renderHook(() => useMobileViewport());

    expect(result.current.isKeyboardVisible).toBe(false);

    // Simulate keyboard opening (viewport shrinks significantly)
    act(() => {
      visualViewport.height = 400;
      const resizeHandler = visualViewport.addEventListener.mock.calls.find(
        (call: string[]) => call[0] === 'resize'
      )?.[1];
      resizeHandler?.();
    });

    expect(result.current.isKeyboardVisible).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useMobileViewport());

    unmount();

    expect(visualViewport.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run useMobileViewport.test.ts`

Expected: FAIL with "Cannot find module '../hooks/useMobileViewport'"

**Step 3: Implement**

```typescript
// apps/player/src/hooks/useMobileViewport.ts
import { useState, useEffect, useCallback } from 'react';

interface MobileViewportState {
  viewportHeight: number;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

export function useMobileViewport(): MobileViewportState {
  const [state, setState] = useState<MobileViewportState>(() => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    return {
      viewportHeight: height,
      isKeyboardVisible: false,
      keyboardHeight: 0,
    };
  });

  const updateViewport = useCallback(() => {
    const visualViewport = window.visualViewport;
    const currentHeight = visualViewport?.height ?? window.innerHeight;
    const fullHeight = window.innerHeight;

    // Keyboard is likely visible if viewport height is significantly less than window height
    // Threshold of 150px accounts for browser UI changes
    const heightDifference = fullHeight - currentHeight;
    const isKeyboardVisible = heightDifference > 150;

    setState({
      viewportHeight: currentHeight,
      isKeyboardVisible,
      keyboardHeight: isKeyboardVisible ? heightDifference : 0,
    });

    // Update CSS custom property for use in styles
    document.documentElement.style.setProperty('--vh', `${currentHeight * 0.01}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${heightDifference}px`);
  }, []);

  useEffect(() => {
    // Initial update
    updateViewport();

    // Listen to visualViewport for more accurate mobile viewport handling
    const visualViewport = window.visualViewport;

    if (visualViewport) {
      visualViewport.addEventListener('resize', updateViewport);
      visualViewport.addEventListener('scroll', updateViewport);
    }

    // Fallback for browsers without visualViewport
    window.addEventListener('resize', updateViewport);

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', updateViewport);
        visualViewport.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
    };
  }, [updateViewport]);

  return state;
}
```

```typescript
// apps/player/src/hooks/useKeyboardHeight.ts
import { useState, useEffect } from 'react';

/**
 * Hook specifically for handling virtual keyboard on mobile devices.
 * Returns the current keyboard height and whether it's visible.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Use Visual Viewport API for accurate keyboard detection
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let initialHeight = visualViewport.height;

    const handleResize = () => {
      const currentHeight = visualViewport.height;
      const difference = initialHeight - currentHeight;

      // Only consider it a keyboard if the height difference is significant
      if (difference > 100) {
        setKeyboardHeight(difference);
        setIsVisible(true);
      } else {
        setKeyboardHeight(0);
        setIsVisible(false);
        // Update initial height when keyboard closes
        initialHeight = currentHeight;
      }
    };

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  return { keyboardHeight, isVisible };
}
```

Now update globals.css with mobile browser quirk fixes:

```css
/* apps/player/src/styles/globals.css - updated with mobile quirks */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Default viewport height - updated by JS for mobile */
    --vh: 1vh;
    --keyboard-height: 0px;
  }

  html {
    /* Prevent text size adjustment on orientation change */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;

    /* Smooth scrolling */
    scroll-behavior: smooth;
  }

  body {
    @apply bg-slate-900 text-white antialiased;

    /* Prevent pull-to-refresh on mobile */
    overscroll-behavior-y: contain;

    /* Prevent iOS bounce scrolling */
    position: fixed;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  #root {
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Minimum touch target size (44x44px per Apple HIG) */
  button,
  [role="button"],
  input[type="submit"],
  input[type="button"],
  a {
    @apply min-h-[44px] min-w-[44px];
  }

  /* Prevent input zoom on iOS (requires 16px+ font) */
  input,
  select,
  textarea {
    @apply text-base;
    font-size: 16px; /* Explicit 16px prevents iOS zoom */
  }

  /* Remove iOS input styling */
  input,
  textarea {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-radius: 0;
  }

  /* Style autofill backgrounds */
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #1e293b inset;
    -webkit-text-fill-color: white;
    transition: background-color 5000s ease-in-out 0s;
  }
}

@layer utilities {
  /* Safe area padding for notched devices (iPhone X+) */
  .safe-area-inset {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }

  .safe-area-top {
    padding-top: env(safe-area-inset-top);
  }

  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Dynamic viewport height using CSS custom property */
  /* This is updated by useMobileViewport hook */
  .h-screen-dynamic {
    height: 100vh;
    height: calc(var(--vh, 1vh) * 100);
  }

  .min-h-screen-dynamic {
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);
  }

  .max-h-screen-dynamic {
    max-height: 100vh;
    max-height: calc(var(--vh, 1vh) * 100);
  }

  /* Keyboard-aware positioning */
  .keyboard-aware {
    transition: transform 0.2s ease-out;
    transform: translateY(calc(var(--keyboard-height) * -0.5));
  }

  /* Disable user selection on interactive elements */
  .no-select {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  /* Improve tap highlighting */
  .tap-highlight-none {
    -webkit-tap-highlight-color: transparent;
  }

  /* Hardware acceleration for smooth animations */
  .hardware-accelerated {
    transform: translateZ(0);
    backface-visibility: hidden;
  }
}

/* iOS Safari specific fixes */
@supports (-webkit-touch-callout: none) {
  /* Fix for iOS Safari 100vh issue */
  .h-screen-dynamic {
    height: -webkit-fill-available;
  }

  .min-h-screen-dynamic {
    min-height: -webkit-fill-available;
  }
}

/* Fix for Android Chrome address bar */
@media screen and (max-width: 768px) {
  .h-screen-dynamic {
    height: 100dvh;
  }

  .min-h-screen-dynamic {
    min-height: 100dvh;
  }
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run useMobileViewport.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/player/src/styles/globals.css apps/player/src/hooks/useMobileViewport.ts apps/player/src/hooks/useKeyboardHeight.ts apps/player/src/__tests__/useMobileViewport.test.ts
git commit -m "feat(player): handle iOS Safari and Android Chrome viewport quirks"
```

---

## Task player-010: Test responsive behavior across device sizes

**Files:**
- Create: `apps/player/src/__tests__/responsive.test.tsx`
- Create: `apps/player/playwright.config.ts`
- Create: `apps/player/e2e/responsive.spec.ts`

**Step 1: Write failing test**

```typescript
// apps/player/src/__tests__/responsive.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Layout } from '../components/Layout';
import { JoinScreen } from '../components/JoinScreen';

// Device viewport sizes to test
const DEVICE_SIZES = {
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 14 Pro Max': { width: 430, height: 932 },
  'Android Small': { width: 360, height: 640 },
  'Android Large': { width: 412, height: 915 },
};

describe('Responsive Layout', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
    });
  });

  const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: height,
      writable: true,
    });
    window.dispatchEvent(new Event('resize'));
  };

  Object.entries(DEVICE_SIZES).forEach(([deviceName, { width, height }]) => {
    describe(`on ${deviceName} (${width}x${height})`, () => {
      beforeEach(() => {
        setViewport(width, height);
      });

      it('renders Layout without horizontal overflow', () => {
        const { container } = render(
          <Layout>
            <div>Test content</div>
          </Layout>
        );

        const layout = container.firstChild as HTMLElement;
        expect(layout.scrollWidth).toBeLessThanOrEqual(width);
      });

      it('renders JoinScreen with accessible form elements', () => {
        const { container } = render(
          <JoinScreen onJoin={() => {}} />
        );

        // Check no element exceeds viewport width
        const allElements = container.querySelectorAll('*');
        allElements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          expect(rect.width).toBeLessThanOrEqual(width);
        });
      });

      it('has touch targets of at least 44x44px', () => {
        const { container } = render(
          <JoinScreen onJoin={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const inputs = container.querySelectorAll('input');

        buttons.forEach((button) => {
          const styles = window.getComputedStyle(button);
          const minHeight = parseInt(styles.minHeight) || button.offsetHeight;
          const minWidth = parseInt(styles.minWidth) || button.offsetWidth;

          // Elements should have min 44px touch targets
          expect(minHeight).toBeGreaterThanOrEqual(44);
          expect(minWidth).toBeGreaterThanOrEqual(44);
        });

        inputs.forEach((input) => {
          const styles = window.getComputedStyle(input);
          const height = parseInt(styles.height) || input.offsetHeight;

          // Input height should be comfortable for touch
          expect(height).toBeGreaterThanOrEqual(44);
        });
      });
    });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run responsive.test.tsx`

Expected: FAIL (tests should fail initially if components aren't properly responsive)

**Step 3: Implement E2E test configuration**

```typescript
// apps/player/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iPhone SE',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'iPhone 14 Pro Max',
      use: { ...devices['iPhone 14 Pro Max'] },
    },
    {
      name: 'Pixel 5',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Galaxy S9+',
      use: {
        viewport: { width: 360, height: 740 },
        userAgent: 'Mozilla/5.0 (Linux; Android 9; SM-G965F) AppleWebKit/537.36',
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
});
```

```typescript
// apps/player/e2e/responsive.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Responsive behavior', () => {
  test('join screen has no horizontal scroll', async ({ page }) => {
    await page.goto('/');

    // Check that the page doesn't have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('join code input is accessible', async ({ page }) => {
    await page.goto('/');

    const codeInput = page.getByLabel(/game code/i);
    await expect(codeInput).toBeVisible();

    // Check it's tappable (has sufficient size)
    const box = await codeInput.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('name input is accessible', async ({ page }) => {
    await page.goto('/');

    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible();

    const box = await nameInput.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('join button is tappable', async ({ page }) => {
    await page.goto('/');

    const joinButton = page.getByRole('button', { name: /join/i });
    await expect(joinButton).toBeVisible();

    const box = await joinButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });

  test('form remains visible when keyboard opens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Keyboard test only relevant on mobile');

    await page.goto('/');

    const nameInput = page.getByLabel(/your name/i);
    await nameInput.tap();

    // Wait for any keyboard animation
    await page.waitForTimeout(300);

    // Check that the submit button is still visible
    const joinButton = page.getByRole('button', { name: /join/i });
    await expect(joinButton).toBeVisible();
  });

  test('can complete join flow on mobile', async ({ page }) => {
    await page.goto('/');

    // Enter game code
    const codeInput = page.getByLabel(/game code/i);
    await codeInput.fill('ABCD');

    // Enter name
    const nameInput = page.getByLabel(/your name/i);
    await nameInput.fill('TestPlayer');

    // Verify button becomes enabled
    const joinButton = page.getByRole('button', { name: /join/i });
    await expect(joinButton).toBeEnabled();
  });
});
```

**Step 4: Run test, verify pass**

Run unit tests:
`cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter player test -- --run responsive.test.tsx`

Expected: PASS

Run E2E tests (requires playwright installed):
`cd /Users/shahar.cohen/Projects/my-projects/party-popper/apps/player && npx playwright test`

Expected: PASS on all device configurations

**Step 5: Commit**

```bash
git add apps/player/src/__tests__/responsive.test.tsx apps/player/playwright.config.ts apps/player/e2e/responsive.spec.ts
git commit -m "test(player): add responsive behavior tests for mobile device sizes"
```

---

## Summary

Phase 4 implements the complete mobile player interface with 10 tasks:

| Task ID | Description | Key Files |
|---------|-------------|-----------|
| player-001 | Mobile-optimized layout | `Layout.tsx`, `globals.css` |
| player-002 | Join screen with code/name | `JoinScreen.tsx`, `useJoinGame.ts` |
| player-003 | WebSocket connection | `useGameConnection.ts`, `GameContext.tsx` |
| player-004 | Team assignment screen | `TeamAssignment.tsx` |
| player-005 | Lobby view | `LobbyView.tsx` |
| player-006 | Touch-friendly inputs | `Button.tsx`, `TextInput.tsx`, `YearInput.tsx` |
| player-007 | Connection status UI | `ConnectionStatus.tsx`, `ReconnectingOverlay.tsx` |
| player-008 | Session persistence | `sessionStorage.ts` |
| player-009 | Mobile browser quirks | `useMobileViewport.ts`, updated `globals.css` |
| player-010 | Responsive testing | E2E tests with Playwright |

**Dependencies on other phases:**
- Phase 2: Backend WebSocket endpoints must exist for connection
- Phase 3: Host display must be working to verify join flow
- `packages/shared`: Types (`GameState`, `Player`, `Team`) and hooks (`useGameConnection`)

**Files created in apps/player:**
- `src/components/Layout.tsx`
- `src/components/JoinScreen.tsx`
- `src/components/TeamAssignment.tsx`
- `src/components/LobbyView.tsx`
- `src/components/ConnectionStatus.tsx`
- `src/components/ReconnectingOverlay.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/TextInput.tsx`
- `src/components/ui/YearInput.tsx`
- `src/components/ui/index.ts`
- `src/contexts/GameContext.tsx`
- `src/hooks/useJoinGame.ts`
- `src/hooks/useMobileViewport.ts`
- `src/hooks/useKeyboardHeight.ts`
- `src/utils/sessionStorage.ts`
- `src/styles/globals.css`
- `src/__tests__/*.test.tsx`
- `e2e/responsive.spec.ts`
- `playwright.config.ts`

**Files created in packages/shared:**
- `src/hooks/useGameConnection.ts`
- `src/hooks/index.ts`
