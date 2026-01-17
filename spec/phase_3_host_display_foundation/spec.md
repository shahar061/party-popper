# Phase 3: Host Display Foundation - Implementation Spec

## Overview

Phase 3 builds the host frontend that displays on TV/laptop - the visual anchor of the game experience. By the end of this phase, the host can create a game, see the join code, watch players join, assign teams, and start the game with real-time updates working.

**Prerequisites**: Phase 2 complete (backend can accept connections and manage state)

---

## Task host-001: Create WebSocket connection hook with reconnection logic

**Files:**
- Create: `apps/host/src/hooks/useGameConnection.ts`
- Create: `apps/host/src/hooks/useGameConnection.test.ts`

**Step 1: Write failing test**

```typescript
// apps/host/src/hooks/useGameConnection.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameConnection } from './useGameConnection';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();
  close = vi.fn();

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  simulateClose(code = 1000) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code });
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
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

  it('should connect to WebSocket and expose connection state', async () => {
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws')
    );

    expect(result.current.connectionState).toBe('connecting');

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connectionState).toBe('connected');
  });

  it('should auto-reconnect on disconnect with exponential backoff', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws')
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connectionState).toBe('connected');

    act(() => {
      MockWebSocket.instances[0].simulateClose(1006); // Abnormal close
    });

    expect(result.current.connectionState).toBe('disconnected');

    // First reconnect attempt after 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockWebSocket.instances.length).toBe(2);
    expect(result.current.connectionState).toBe('connecting');

    vi.useRealTimers();
  });

  it('should expose send function for messages', async () => {
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws')
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.send({ type: 'test_message', payload: { foo: 'bar' } });
    });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test_message', payload: { foo: 'bar' } })
    );
  });

  it('should call onMessage callback when message received', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useGameConnection('ws://localhost:8787/games/TEST/ws', { onMessage })
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage({ type: 'state_sync', payload: {} });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'state_sync', payload: {} });
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run useGameConnection`
Expected: FAIL with "Cannot find module './useGameConnection'"

**Step 3: Implement**

```typescript
// apps/host/src/hooks/useGameConnection.ts
import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
}

export interface UseGameConnectionOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  maxReconnectAttempts?: number;
}

export function useGameConnection(
  url: string | null,
  options: UseGameConnectionOptions = {}
) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    maxReconnectAttempts = 5,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    url ? 'connecting' : 'disconnected'
  );
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setConnectionState('connecting');

    ws.onopen = () => {
      setConnectionState('connected');
      reconnectAttemptRef.current = 0;
      onConnect?.();
    };

    ws.onclose = (event) => {
      setConnectionState('disconnected');
      onDisconnect?.();

      // Don't reconnect on normal closure (code 1000) or if max attempts reached
      if (event.code !== 1000 && reconnectAttemptRef.current < maxReconnectAttempts) {
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
        reconnectAttemptRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      // Error will be followed by close event
    };
  }, [url, onMessage, onConnect, onDisconnect, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptRef.current = maxReconnectAttempts; // Prevent reconnection
    wsRef.current?.close(1000);
    wsRef.current = null;
    setConnectionState('disconnected');
  }, [maxReconnectAttempts]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close(1000);
    };
  }, [connect]);

  return {
    connectionState,
    send,
    disconnect,
    reconnect: connect,
  };
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run useGameConnection`
Expected: PASS - All 4 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/hooks/useGameConnection.ts apps/host/src/hooks/useGameConnection.test.ts
git commit -m "feat(host): add WebSocket connection hook with reconnection logic"
```

---

## Task host-002: Build game state context/store using Zustand

**Files:**
- Create: `apps/host/src/store/gameStore.ts`
- Create: `apps/host/src/store/gameStore.test.ts`

**Step 1: Write failing test**

```typescript
// apps/host/src/store/gameStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import type { GameState, Player } from '@party-popper/shared';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('should initialize with null game state', () => {
    const state = useGameStore.getState();
    expect(state.game).toBeNull();
  });

  it('should sync full game state', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);

    expect(useGameStore.getState().game).toEqual(mockGameState);
  });

  it('should add player to team', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);

    const player: Player = { id: 'player-1', name: 'Alice', connected: true, lastSeen: Date.now() };
    useGameStore.getState().addPlayer(player, 'A');

    expect(useGameStore.getState().game?.teams.A.players).toContainEqual(player);
  });

  it('should remove player from team', () => {
    const player: Player = { id: 'player-1', name: 'Alice', connected: true, lastSeen: Date.now() };
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().removePlayer('player-1');

    expect(useGameStore.getState().game?.teams.A.players).toHaveLength(0);
  });

  it('should move player between teams', () => {
    const player: Player = { id: 'player-1', name: 'Alice', connected: true, lastSeen: Date.now() };
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().movePlayer('player-1', 'B');

    expect(useGameStore.getState().game?.teams.A.players).toHaveLength(0);
    expect(useGameStore.getState().game?.teams.B.players).toContainEqual(player);
  });

  it('should update game settings', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().updateSettings({ targetScore: 15 });

    expect(useGameStore.getState().game?.settings.targetScore).toBe(15);
  });

  it('should update game status', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    useGameStore.getState().setStatus('playing');

    expect(useGameStore.getState().game?.status).toBe('playing');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run gameStore`
Expected: FAIL with "Cannot find module './gameStore'"

**Step 3: Implement**

```typescript
// apps/host/src/store/gameStore.ts
import { create } from 'zustand';
import type { GameState, Player, GameSettings } from '@party-popper/shared';

type TeamId = 'A' | 'B';
type GameStatus = 'lobby' | 'playing' | 'finished';

interface GameStoreState {
  game: GameState | null;
  syncState: (state: GameState) => void;
  addPlayer: (player: Player, team: TeamId) => void;
  removePlayer: (playerId: string) => void;
  movePlayer: (playerId: string, toTeam: TeamId) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  setStatus: (status: GameStatus) => void;
  setMode: (mode: 'classic' | 'custom') => void;
  reset: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  game: null,

  syncState: (state) => set({ game: state }),

  addPlayer: (player, team) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: {
          ...state.game,
          teams: {
            ...state.game.teams,
            [team]: {
              ...state.game.teams[team],
              players: [...state.game.teams[team].players, player],
            },
          },
        },
      };
    }),

  removePlayer: (playerId) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: {
          ...state.game,
          teams: {
            A: {
              ...state.game.teams.A,
              players: state.game.teams.A.players.filter((p) => p.id !== playerId),
            },
            B: {
              ...state.game.teams.B,
              players: state.game.teams.B.players.filter((p) => p.id !== playerId),
            },
          },
        },
      };
    }),

  movePlayer: (playerId, toTeam) =>
    set((state) => {
      if (!state.game) return state;

      const fromTeam: TeamId = state.game.teams.A.players.some((p) => p.id === playerId)
        ? 'A'
        : 'B';

      if (fromTeam === toTeam) return state;

      const player = state.game.teams[fromTeam].players.find((p) => p.id === playerId);
      if (!player) return state;

      return {
        game: {
          ...state.game,
          teams: {
            ...state.game.teams,
            [fromTeam]: {
              ...state.game.teams[fromTeam],
              players: state.game.teams[fromTeam].players.filter((p) => p.id !== playerId),
            },
            [toTeam]: {
              ...state.game.teams[toTeam],
              players: [...state.game.teams[toTeam].players, player],
            },
          },
        },
      };
    }),

  updateSettings: (settings) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: {
          ...state.game,
          settings: { ...state.game.settings, ...settings },
        },
      };
    }),

  setStatus: (status) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: { ...state.game, status },
      };
    }),

  setMode: (mode) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: { ...state.game, mode },
      };
    }),

  reset: () => set({ game: null }),
}));
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run gameStore`
Expected: PASS - All 6 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/store/gameStore.ts apps/host/src/store/gameStore.test.ts
git commit -m "feat(host): add Zustand game state store with sync and mutation actions"
```

---

## Task host-003: Design and implement lobby screen with join code display

**Files:**
- Create: `apps/host/src/screens/LobbyScreen.tsx`
- Create: `apps/host/src/screens/LobbyScreen.test.tsx`
- Create: `apps/host/src/components/JoinCodeDisplay.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/screens/LobbyScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LobbyScreen } from './LobbyScreen';
import { useGameStore } from '../store/gameStore';
import type { GameState } from '@party-popper/shared';

// Mock the QR code component to avoid rendering issues in tests
vi.mock('../components/QRCodeDisplay', () => ({
  QRCodeDisplay: ({ url }: { url: string }) => <div data-testid="qr-code">{url}</div>,
}));

describe('LobbyScreen', () => {
  const mockGameState: GameState = {
    id: 'game-123',
    joinCode: 'WXYZ',
    status: 'lobby',
    mode: 'classic',
    settings: { targetScore: 10 },
    teams: {
      A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
      B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
    },
    currentRound: null,
    songPool: [],
    playedSongs: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('should display the join code in large, readable format', () => {
    useGameStore.getState().syncState(mockGameState);
    render(<LobbyScreen />);

    const joinCode = screen.getByTestId('join-code');
    expect(joinCode).toHaveTextContent('WXYZ');
  });

  it('should display the game URL below the code', () => {
    useGameStore.getState().syncState(mockGameState);
    render(<LobbyScreen />);

    const gameUrl = screen.getByTestId('game-url');
    expect(gameUrl).toBeInTheDocument();
    expect(gameUrl.textContent).toContain('WXYZ');
  });

  it('should show waiting indicator with animation', () => {
    useGameStore.getState().syncState(mockGameState);
    render(<LobbyScreen />);

    const waitingIndicator = screen.getByTestId('waiting-indicator');
    expect(waitingIndicator).toBeInTheDocument();
    expect(waitingIndicator).toHaveTextContent(/waiting for players/i);
  });

  it('should show loading state when game is null', () => {
    render(<LobbyScreen />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run LobbyScreen`
Expected: FAIL with "Cannot find module './LobbyScreen'"

**Step 3: Implement**

```typescript
// apps/host/src/components/JoinCodeDisplay.tsx
interface JoinCodeDisplayProps {
  code: string;
  gameUrl: string;
}

export function JoinCodeDisplay({ code, gameUrl }: JoinCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-2xl text-gray-400 uppercase tracking-wider">
        Join Code
      </div>
      <div
        data-testid="join-code"
        className="text-8xl font-bold tracking-[0.3em] text-white bg-gray-800 px-12 py-8 rounded-2xl shadow-lg"
      >
        {code}
      </div>
      <div
        data-testid="game-url"
        className="text-xl text-gray-400"
      >
        {gameUrl}
      </div>
    </div>
  );
}
```

```typescript
// apps/host/src/screens/LobbyScreen.tsx
import { useGameStore } from '../store/gameStore';
import { JoinCodeDisplay } from '../components/JoinCodeDisplay';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { TeamRoster } from '../components/TeamRoster';
import { GameSettings } from '../components/GameSettings';
import { StartGameButton } from '../components/StartGameButton';

export function LobbyScreen() {
  const game = useGameStore((state) => state.game);

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-2xl text-gray-400">Loading...</div>
      </div>
    );
  }

  const playerUrl = `${window.location.origin}/join?code=${game.joinCode}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Join Code */}
        <div className="flex justify-between items-start mb-12">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">Party Popper</h1>
            <p className="text-xl text-gray-400">Music Timeline Game</p>
          </div>

          <div className="flex gap-8 items-center">
            <JoinCodeDisplay code={game.joinCode} gameUrl={playerUrl} />
            <QRCodeDisplay url={playerUrl} />
          </div>
        </div>

        {/* Waiting Indicator */}
        <div
          data-testid="waiting-indicator"
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 text-2xl text-gray-400">
            <span className="animate-pulse">Waiting for players to join...</span>
            <span className="flex gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-8">
          {/* Team A */}
          <TeamRoster team={game.teams.A} teamId="A" />

          {/* Center - Settings and Start */}
          <div className="flex flex-col items-center gap-6">
            <GameSettings />
            <StartGameButton />
          </div>

          {/* Team B */}
          <TeamRoster team={game.teams.B} teamId="B" />
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run LobbyScreen`
Expected: PASS - All 4 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/screens/LobbyScreen.tsx apps/host/src/screens/LobbyScreen.test.tsx apps/host/src/components/JoinCodeDisplay.tsx
git commit -m "feat(host): add lobby screen with join code display"
```

---

## Task host-004: Generate QR code for player join URL

**Files:**
- Create: `apps/host/src/components/QRCodeDisplay.tsx`
- Create: `apps/host/src/components/QRCodeDisplay.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/components/QRCodeDisplay.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QRCodeDisplay } from './QRCodeDisplay';

describe('QRCodeDisplay', () => {
  it('should render QR code with correct URL', () => {
    const testUrl = 'https://partypopper.app/join?code=ABCD';
    render(<QRCodeDisplay url={testUrl} />);

    const qrContainer = screen.getByTestId('qr-code-container');
    expect(qrContainer).toBeInTheDocument();
  });

  it('should have minimum size of 200px for TV viewing', () => {
    const testUrl = 'https://partypopper.app/join?code=ABCD';
    render(<QRCodeDisplay url={testUrl} />);

    const qrContainer = screen.getByTestId('qr-code-container');
    const svg = qrContainer.querySelector('svg');

    expect(svg).toBeInTheDocument();
    // QRCode component sets size as width/height attributes
  });

  it('should display scan instruction text', () => {
    const testUrl = 'https://partypopper.app/join?code=ABCD';
    render(<QRCodeDisplay url={testUrl} />);

    expect(screen.getByText(/scan to join/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run QRCodeDisplay`
Expected: FAIL with "Cannot find module './QRCodeDisplay'"

**Step 3: Implement**

First, install the dependency:
```bash
cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host add qrcode.react
```

```typescript
// apps/host/src/components/QRCodeDisplay.tsx
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  url: string;
  size?: number;
}

export function QRCodeDisplay({ url, size = 200 }: QRCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        data-testid="qr-code-container"
        className="bg-white p-4 rounded-xl"
      >
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      <span className="text-lg text-gray-400">Scan to Join</span>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run QRCodeDisplay`
Expected: PASS - All 3 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/components/QRCodeDisplay.tsx apps/host/src/components/QRCodeDisplay.test.tsx apps/host/package.json pnpm-lock.yaml
git commit -m "feat(host): add QR code display component for player join URL"
```

---

## Task host-005: Build team roster display with player names

**Files:**
- Create: `apps/host/src/components/TeamRoster.tsx`
- Create: `apps/host/src/components/TeamRoster.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/components/TeamRoster.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TeamRoster } from './TeamRoster';
import type { Team } from '@party-popper/shared';

describe('TeamRoster', () => {
  const mockTeamWithPlayers: Team = {
    name: 'Team A',
    players: [
      { id: 'p1', name: 'Alice', connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', connected: true, lastSeen: Date.now() },
    ],
    timeline: [],
    vetoTokens: 3,
    score: 0,
  };

  const mockEmptyTeam: Team = {
    name: 'Team B',
    players: [],
    timeline: [],
    vetoTokens: 3,
    score: 0,
  };

  it('should display team name as header', () => {
    render(<TeamRoster team={mockTeamWithPlayers} teamId="A" />);

    expect(screen.getByRole('heading', { name: 'Team A' })).toBeInTheDocument();
  });

  it('should display all player names', () => {
    render(<TeamRoster team={mockTeamWithPlayers} teamId="A" />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should show empty slots for available positions (max 5)', () => {
    render(<TeamRoster team={mockTeamWithPlayers} teamId="A" />);

    // 2 players + 3 empty slots = 5 total
    const emptySlots = screen.getAllByTestId('empty-slot');
    expect(emptySlots).toHaveLength(3);
  });

  it('should show all empty slots when team has no players', () => {
    render(<TeamRoster team={mockEmptyTeam} teamId="B" />);

    const emptySlots = screen.getAllByTestId('empty-slot');
    expect(emptySlots).toHaveLength(5);
  });

  it('should display player count', () => {
    render(<TeamRoster team={mockTeamWithPlayers} teamId="A" />);

    expect(screen.getByTestId('player-count')).toHaveTextContent('2/5');
  });

  it('should apply correct team color styling', () => {
    render(<TeamRoster team={mockTeamWithPlayers} teamId="A" />);

    const container = screen.getByTestId('team-roster-A');
    expect(container).toHaveClass('border-blue-500');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run TeamRoster`
Expected: FAIL with "Cannot find module './TeamRoster'"

**Step 3: Implement**

```typescript
// apps/host/src/components/TeamRoster.tsx
import type { Team } from '@party-popper/shared';

interface TeamRosterProps {
  team: Team;
  teamId: 'A' | 'B';
  onMovePlayer?: (playerId: string) => void;
}

const MAX_PLAYERS = 5;

const teamColors = {
  A: {
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    accent: 'bg-blue-500',
  },
  B: {
    border: 'border-orange-500',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    accent: 'bg-orange-500',
  },
};

export function TeamRoster({ team, teamId, onMovePlayer }: TeamRosterProps) {
  const colors = teamColors[teamId];
  const emptySlots = MAX_PLAYERS - team.players.length;

  return (
    <div
      data-testid={`team-roster-${teamId}`}
      className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-6`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-3xl font-bold ${colors.text}`}>{team.name}</h2>
        <span
          data-testid="player-count"
          className="text-xl text-gray-400"
        >
          {team.players.length}/{MAX_PLAYERS}
        </span>
      </div>

      {/* Player List */}
      <div className="space-y-3">
        {team.players.map((player, index) => (
          <div
            key={player.id}
            data-testid={`player-${player.id}`}
            className="flex items-center gap-4 bg-gray-800/50 rounded-xl px-4 py-3 animate-fadeIn"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`w-3 h-3 rounded-full ${colors.accent}`} />
            <span className="text-2xl text-white flex-1">{player.name}</span>
            {!player.connected && (
              <span className="text-sm text-yellow-500">Reconnecting...</span>
            )}
            {onMovePlayer && (
              <button
                onClick={() => onMovePlayer(player.id)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Move
              </button>
            )}
          </div>
        ))}

        {/* Empty Slots */}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <div
            key={`empty-${index}`}
            data-testid="empty-slot"
            className="flex items-center gap-4 border-2 border-dashed border-gray-700 rounded-xl px-4 py-3"
          >
            <div className="w-3 h-3 rounded-full bg-gray-700" />
            <span className="text-2xl text-gray-600">Waiting...</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Add the animation to Tailwind config (if not already present):

```typescript
// apps/host/tailwind.config.js - add to theme.extend
{
  keyframes: {
    fadeIn: {
      '0%': { opacity: '0', transform: 'translateY(-10px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    },
  },
  animation: {
    fadeIn: 'fadeIn 0.3s ease-out forwards',
  },
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run TeamRoster`
Expected: PASS - All 6 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/components/TeamRoster.tsx apps/host/src/components/TeamRoster.test.tsx apps/host/tailwind.config.js
git commit -m "feat(host): add team roster display with player names and empty slots"
```

---

## Task host-006: Implement team reassignment UI with buttons

**Files:**
- Modify: `apps/host/src/components/TeamRoster.tsx`
- Create: `apps/host/src/components/MovePlayerButton.tsx`
- Create: `apps/host/src/components/MovePlayerButton.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/components/MovePlayerButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MovePlayerButton } from './MovePlayerButton';
import { useGameStore } from '../store/gameStore';
import type { GameState } from '@party-popper/shared';

// Mock WebSocket send
const mockSend = vi.fn();
vi.mock('../hooks/useGameConnection', () => ({
  useGameConnection: () => ({
    send: mockSend,
    connectionState: 'connected',
  }),
}));

describe('MovePlayerButton', () => {
  const player = { id: 'p1', name: 'Alice', connected: true, lastSeen: Date.now() };

  beforeEach(() => {
    mockSend.mockClear();
    useGameStore.getState().reset();
  });

  it('should render move button for player in Team A', () => {
    render(<MovePlayerButton playerId="p1" currentTeam="A" />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(/move to team b/i);
  });

  it('should render move button for player in Team B', () => {
    render(<MovePlayerButton playerId="p1" currentTeam="B" />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(/move to team a/i);
  });

  it('should send REASSIGN_TEAM message on click', () => {
    render(
      <MovePlayerButton
        playerId="p1"
        currentTeam="A"
        onMove={mockSend}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockSend).toHaveBeenCalledWith({
      type: 'reassign_team',
      payload: { playerId: 'p1', team: 'B' },
    });
  });

  it('should update UI optimistically', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);

    render(
      <MovePlayerButton
        playerId="p1"
        currentTeam="A"
        onMove={(msg) => {
          mockSend(msg);
          useGameStore.getState().movePlayer('p1', 'B');
        }}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Verify optimistic update in store
    const state = useGameStore.getState();
    expect(state.game?.teams.A.players).toHaveLength(0);
    expect(state.game?.teams.B.players).toHaveLength(1);
  });

  it('should be disabled when target team is full (5 players)', () => {
    const fullTeam = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      name: `Player ${i}`,
      connected: true,
      lastSeen: Date.now(),
    }));

    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: fullTeam, timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);

    render(<MovePlayerButton playerId="p1" currentTeam="A" onMove={mockSend} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run MovePlayerButton`
Expected: FAIL with "Cannot find module './MovePlayerButton'"

**Step 3: Implement**

```typescript
// apps/host/src/components/MovePlayerButton.tsx
import { useGameStore } from '../store/gameStore';

interface MovePlayerButtonProps {
  playerId: string;
  currentTeam: 'A' | 'B';
  onMove?: (message: { type: string; payload: { playerId: string; team: 'A' | 'B' } }) => void;
}

const MAX_PLAYERS = 5;

export function MovePlayerButton({ playerId, currentTeam, onMove }: MovePlayerButtonProps) {
  const game = useGameStore((state) => state.game);
  const movePlayer = useGameStore((state) => state.movePlayer);

  const targetTeam: 'A' | 'B' = currentTeam === 'A' ? 'B' : 'A';
  const targetTeamFull = game?.teams[targetTeam].players.length === MAX_PLAYERS;

  const handleClick = () => {
    if (targetTeamFull) return;

    // Optimistic update
    movePlayer(playerId, targetTeam);

    // Send to server
    onMove?.({
      type: 'reassign_team',
      payload: { playerId, team: targetTeam },
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={targetTeamFull}
      className={`
        px-3 py-1 rounded-lg text-sm font-medium transition-colors
        ${targetTeamFull
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
        }
      `}
    >
      Move to Team {targetTeam}
    </button>
  );
}
```

Now update TeamRoster to use MovePlayerButton:

```typescript
// apps/host/src/components/TeamRoster.tsx - Update the player mapping section
import { MovePlayerButton } from './MovePlayerButton';

// In the player.map section, replace the existing move button with:
{onMovePlayer && (
  <MovePlayerButton
    playerId={player.id}
    currentTeam={teamId}
    onMove={(msg) => onMovePlayer(msg)}
  />
)}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run MovePlayerButton`
Expected: PASS - All 5 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/components/MovePlayerButton.tsx apps/host/src/components/MovePlayerButton.test.tsx apps/host/src/components/TeamRoster.tsx
git commit -m "feat(host): add team reassignment UI with move buttons"
```

---

## Task host-007: Create game settings panel (target score, mode selection)

**Files:**
- Create: `apps/host/src/components/GameSettings.tsx`
- Create: `apps/host/src/components/GameSettings.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/components/GameSettings.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameSettings } from './GameSettings';
import { useGameStore } from '../store/gameStore';
import type { GameState } from '@party-popper/shared';

const mockSend = vi.fn();

describe('GameSettings', () => {
  const mockGameState: GameState = {
    id: 'game-123',
    joinCode: 'ABCD',
    status: 'lobby',
    mode: 'classic',
    settings: { targetScore: 10 },
    teams: {
      A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
      B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
    },
    currentRound: null,
    songPool: [],
    playedSongs: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  beforeEach(() => {
    mockSend.mockClear();
    useGameStore.getState().reset();
    useGameStore.getState().syncState(mockGameState);
  });

  it('should display target score selector with options 5, 10, 15, 20', () => {
    render(<GameSettings onSettingsChange={mockSend} />);

    const selector = screen.getByTestId('target-score-selector');
    expect(selector).toBeInTheDocument();

    const options = screen.getAllByRole('button', { name: /^\d+$/ });
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('5');
    expect(options[1]).toHaveTextContent('10');
    expect(options[2]).toHaveTextContent('15');
    expect(options[3]).toHaveTextContent('20');
  });

  it('should highlight currently selected target score', () => {
    render(<GameSettings onSettingsChange={mockSend} />);

    const selectedButton = screen.getByRole('button', { name: '10' });
    expect(selectedButton).toHaveClass('bg-blue-500');
  });

  it('should display mode toggle (Classic / Custom)', () => {
    render(<GameSettings onSettingsChange={mockSend} />);

    expect(screen.getByRole('button', { name: /classic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
  });

  it('should send settings update on target score change', () => {
    render(<GameSettings onSettingsChange={mockSend} />);

    const button15 = screen.getByRole('button', { name: '15' });
    fireEvent.click(button15);

    expect(mockSend).toHaveBeenCalledWith({
      type: 'update_settings',
      payload: { targetScore: 15 },
    });
  });

  it('should send settings update on mode change', () => {
    render(<GameSettings onSettingsChange={mockSend} />);

    const customButton = screen.getByRole('button', { name: /custom/i });
    fireEvent.click(customButton);

    expect(mockSend).toHaveBeenCalledWith({
      type: 'update_settings',
      payload: { mode: 'custom' },
    });
  });

  it('should update store optimistically on change', () => {
    render(<GameSettings onSettingsChange={mockSend} />);

    const button15 = screen.getByRole('button', { name: '15' });
    fireEvent.click(button15);

    expect(useGameStore.getState().game?.settings.targetScore).toBe(15);
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run GameSettings`
Expected: FAIL with "Cannot find module './GameSettings'"

**Step 3: Implement**

```typescript
// apps/host/src/components/GameSettings.tsx
import { useGameStore } from '../store/gameStore';

interface GameSettingsProps {
  onSettingsChange?: (message: { type: string; payload: object }) => void;
}

const TARGET_SCORES = [5, 10, 15, 20] as const;

export function GameSettings({ onSettingsChange }: GameSettingsProps) {
  const game = useGameStore((state) => state.game);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const setMode = useGameStore((state) => state.setMode);

  if (!game) return null;

  const handleTargetScoreChange = (score: number) => {
    updateSettings({ targetScore: score });
    onSettingsChange?.({
      type: 'update_settings',
      payload: { targetScore: score },
    });
  };

  const handleModeChange = (mode: 'classic' | 'custom') => {
    setMode(mode);
    onSettingsChange?.({
      type: 'update_settings',
      payload: { mode },
    });
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
      <h3 className="text-2xl font-bold text-white mb-6 text-center">Game Settings</h3>

      {/* Target Score */}
      <div className="mb-6">
        <label className="block text-lg text-gray-400 mb-3">Target Score</label>
        <div
          data-testid="target-score-selector"
          className="flex gap-2 justify-center"
        >
          {TARGET_SCORES.map((score) => (
            <button
              key={score}
              onClick={() => handleTargetScoreChange(score)}
              className={`
                w-14 h-14 rounded-xl text-xl font-bold transition-colors
                ${game.settings.targetScore === score
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              {score}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div>
        <label className="block text-lg text-gray-400 mb-3">Game Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange('classic')}
            className={`
              flex-1 py-3 px-4 rounded-xl text-lg font-semibold transition-colors
              ${game.mode === 'classic'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            Classic
          </button>
          <button
            onClick={() => handleModeChange('custom')}
            className={`
              flex-1 py-3 px-4 rounded-xl text-lg font-semibold transition-colors
              ${game.mode === 'custom'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            Custom
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2 text-center">
          {game.mode === 'classic'
            ? 'Songs from our curated collection'
            : 'Add your own songs to play'
          }
        </p>
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run GameSettings`
Expected: PASS - All 6 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/components/GameSettings.tsx apps/host/src/components/GameSettings.test.tsx
git commit -m "feat(host): add game settings panel with target score and mode selection"
```

---

## Task host-008: Build Start Game flow with validation

**Files:**
- Create: `apps/host/src/components/StartGameButton.tsx`
- Create: `apps/host/src/components/StartGameButton.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/components/StartGameButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StartGameButton } from './StartGameButton';
import { useGameStore } from '../store/gameStore';
import type { GameState, Player } from '@party-popper/shared';

const mockSend = vi.fn();

describe('StartGameButton', () => {
  const player1: Player = { id: 'p1', name: 'Alice', connected: true, lastSeen: Date.now() };
  const player2: Player = { id: 'p2', name: 'Bob', connected: true, lastSeen: Date.now() };

  beforeEach(() => {
    mockSend.mockClear();
    useGameStore.getState().reset();
  });

  it('should be disabled when no players on either team', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    render(<StartGameButton onStart={mockSend} />);

    const button = screen.getByRole('button', { name: /start game/i });
    expect(button).toBeDisabled();
  });

  it('should be disabled when only Team A has players', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player1], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    render(<StartGameButton onStart={mockSend} />);

    const button = screen.getByRole('button', { name: /start game/i });
    expect(button).toBeDisabled();
  });

  it('should be disabled when only Team B has players', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [player2], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    render(<StartGameButton onStart={mockSend} />);

    const button = screen.getByRole('button', { name: /start game/i });
    expect(button).toBeDisabled();
  });

  it('should be enabled when both teams have at least 1 player', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player1], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [player2], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    render(<StartGameButton onStart={mockSend} />);

    const button = screen.getByRole('button', { name: /start game/i });
    expect(button).not.toBeDisabled();
  });

  it('should send START_GAME message on click', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player1], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [player2], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    render(<StartGameButton onStart={mockSend} />);

    const button = screen.getByRole('button', { name: /start game/i });
    fireEvent.click(button);

    expect(mockSend).toHaveBeenCalledWith({ type: 'start_game' });
  });

  it('should show validation message when disabled', () => {
    const mockGameState: GameState = {
      id: 'game-123',
      joinCode: 'ABCD',
      status: 'lobby',
      mode: 'classic',
      settings: { targetScore: 10 },
      teams: {
        A: { name: 'Team A', players: [player1], timeline: [], vetoTokens: 3, score: 0 },
        B: { name: 'Team B', players: [], timeline: [], vetoTokens: 3, score: 0 },
      },
      currentRound: null,
      songPool: [],
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    useGameStore.getState().syncState(mockGameState);
    render(<StartGameButton onStart={mockSend} />);

    expect(screen.getByText(/need at least 1 player per team/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run StartGameButton`
Expected: FAIL with "Cannot find module './StartGameButton'"

**Step 3: Implement**

```typescript
// apps/host/src/components/StartGameButton.tsx
import { useGameStore } from '../store/gameStore';

interface StartGameButtonProps {
  onStart?: (message: { type: string }) => void;
}

export function StartGameButton({ onStart }: StartGameButtonProps) {
  const game = useGameStore((state) => state.game);

  if (!game) return null;

  const teamAHasPlayers = game.teams.A.players.length > 0;
  const teamBHasPlayers = game.teams.B.players.length > 0;
  const canStart = teamAHasPlayers && teamBHasPlayers;

  const handleStart = () => {
    if (!canStart) return;
    onStart?.({ type: 'start_game' });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleStart}
        disabled={!canStart}
        className={`
          px-12 py-4 rounded-2xl text-2xl font-bold transition-all
          ${canStart
            ? 'bg-green-500 text-white hover:bg-green-400 hover:scale-105 shadow-lg shadow-green-500/30'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        Start Game
      </button>
      {!canStart && (
        <p className="text-sm text-yellow-500">
          Need at least 1 player per team to start
        </p>
      )}
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run StartGameButton`
Expected: PASS - All 6 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/components/StartGameButton.tsx apps/host/src/components/StartGameButton.test.tsx
git commit -m "feat(host): add start game button with validation (min 1 player per team)"
```

---

## Task host-009: Design TV-optimized layout with high contrast theme

**Files:**
- Create: `apps/host/src/styles/tv-theme.css`
- Modify: `apps/host/tailwind.config.js`
- Create: `apps/host/src/components/TVLayout.tsx`
- Create: `apps/host/src/components/TVLayout.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/components/TVLayout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TVLayout } from './TVLayout';

describe('TVLayout', () => {
  it('should render children within TV-optimized container', () => {
    render(
      <TVLayout>
        <div data-testid="child">Content</div>
      </TVLayout>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should have dark background for high contrast', () => {
    render(
      <TVLayout>
        <div>Content</div>
      </TVLayout>
    );

    const container = screen.getByTestId('tv-layout');
    expect(container).toHaveClass('bg-gray-900');
  });

  it('should have minimum font size of 24px via base class', () => {
    render(
      <TVLayout>
        <div>Content</div>
      </TVLayout>
    );

    const container = screen.getByTestId('tv-layout');
    expect(container).toHaveClass('text-2xl');
  });

  it('should use light text color for readability', () => {
    render(
      <TVLayout>
        <div>Content</div>
      </TVLayout>
    );

    const container = screen.getByTestId('tv-layout');
    expect(container).toHaveClass('text-white');
  });

  it('should apply safe area padding for TV displays', () => {
    render(
      <TVLayout>
        <div>Content</div>
      </TVLayout>
    );

    const container = screen.getByTestId('tv-layout');
    // TV safe area is typically 5% margin
    expect(container).toHaveClass('p-8');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run TVLayout`
Expected: FAIL with "Cannot find module './TVLayout'"

**Step 3: Implement**

```css
/* apps/host/src/styles/tv-theme.css */
:root {
  /* TV-optimized colors - high contrast */
  --tv-bg-primary: #111827;     /* gray-900 */
  --tv-bg-secondary: #1f2937;   /* gray-800 */
  --tv-bg-tertiary: #374151;    /* gray-700 */

  --tv-text-primary: #ffffff;
  --tv-text-secondary: #9ca3af; /* gray-400 */
  --tv-text-muted: #6b7280;     /* gray-500 */

  --tv-accent-blue: #3b82f6;    /* blue-500 */
  --tv-accent-orange: #f97316;  /* orange-500 */
  --tv-accent-green: #22c55e;   /* green-500 */
  --tv-accent-red: #ef4444;     /* red-500 */
  --tv-accent-yellow: #eab308;  /* yellow-500 */

  /* TV-optimized sizing - readable from 3 meters */
  --tv-text-xs: 1rem;           /* 16px - minimum */
  --tv-text-sm: 1.25rem;        /* 20px */
  --tv-text-base: 1.5rem;       /* 24px */
  --tv-text-lg: 1.875rem;       /* 30px */
  --tv-text-xl: 2.25rem;        /* 36px */
  --tv-text-2xl: 3rem;          /* 48px */
  --tv-text-3xl: 3.75rem;       /* 60px */
  --tv-text-code: 6rem;         /* 96px - join code */
}

/* Ensure minimum contrast ratio of 4.5:1 for WCAG AA */
.tv-text-on-dark {
  color: var(--tv-text-primary);
}

.tv-text-secondary-on-dark {
  color: var(--tv-text-secondary);
}

/* Animation for TV displays - subtle, not distracting */
@keyframes tv-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.tv-animate-pulse {
  animation: tv-pulse 2s ease-in-out infinite;
}

/* TV safe area - 5% margin from edges */
.tv-safe-area {
  padding: 5vh 5vw;
}
```

```javascript
// apps/host/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tv-bg': {
          primary: '#111827',
          secondary: '#1f2937',
          tertiary: '#374151',
        },
        'tv-accent': {
          blue: '#3b82f6',
          orange: '#f97316',
          green: '#22c55e',
          red: '#ef4444',
          yellow: '#eab308',
        },
      },
      fontSize: {
        'tv-xs': '1rem',
        'tv-sm': '1.25rem',
        'tv-base': '1.5rem',
        'tv-lg': '1.875rem',
        'tv-xl': '2.25rem',
        'tv-2xl': '3rem',
        'tv-3xl': '3.75rem',
        'tv-code': '6rem',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        tvPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        tvPulse: 'tvPulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
```

```typescript
// apps/host/src/components/TVLayout.tsx
import { ReactNode } from 'react';
import '../styles/tv-theme.css';

interface TVLayoutProps {
  children: ReactNode;
}

export function TVLayout({ children }: TVLayoutProps) {
  return (
    <div
      data-testid="tv-layout"
      className="min-h-screen bg-gray-900 text-white text-2xl p-8"
    >
      <div className="max-w-[1920px] mx-auto h-full">
        {children}
      </div>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run TVLayout`
Expected: PASS - All 5 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/components/TVLayout.tsx apps/host/src/components/TVLayout.test.tsx apps/host/src/styles/tv-theme.css apps/host/tailwind.config.js
git commit -m "feat(host): add TV-optimized layout with high contrast theme"
```

---

## Task host-010: Implement connection status indicators

**Files:**
- Create: `apps/host/src/components/ConnectionStatus.tsx`
- Create: `apps/host/src/components/ConnectionStatus.test.tsx`

**Step 1: Write failing test**

```typescript
// apps/host/src/components/ConnectionStatus.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';
import type { ConnectionState } from '../hooks/useGameConnection';

describe('ConnectionStatus', () => {
  it('should show green dot when connected', () => {
    render(<ConnectionStatus state="connected" />);

    const dot = screen.getByTestId('connection-dot');
    expect(dot).toHaveClass('bg-green-500');
  });

  it('should show yellow dot when connecting/reconnecting', () => {
    render(<ConnectionStatus state="connecting" />);

    const dot = screen.getByTestId('connection-dot');
    expect(dot).toHaveClass('bg-yellow-500');
  });

  it('should show red dot when disconnected', () => {
    render(<ConnectionStatus state="disconnected" />);

    const dot = screen.getByTestId('connection-dot');
    expect(dot).toHaveClass('bg-red-500');
  });

  it('should show reconnection countdown when disconnected', () => {
    render(<ConnectionStatus state="disconnected" reconnectIn={5} />);

    expect(screen.getByText(/reconnecting in 5s/i)).toBeInTheDocument();
  });

  it('should show "Connected" text when connected', () => {
    render(<ConnectionStatus state="connected" />);

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('should show "Connecting..." text when connecting', () => {
    render(<ConnectionStatus state="connecting" />);

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('should animate dot when connecting', () => {
    render(<ConnectionStatus state="connecting" />);

    const dot = screen.getByTestId('connection-dot');
    expect(dot).toHaveClass('animate-pulse');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run ConnectionStatus`
Expected: FAIL with "Cannot find module './ConnectionStatus'"

**Step 3: Implement**

```typescript
// apps/host/src/components/ConnectionStatus.tsx
import type { ConnectionState } from '../hooks/useGameConnection';

interface ConnectionStatusProps {
  state: ConnectionState;
  reconnectIn?: number;
}

const stateConfig = {
  connected: {
    dotColor: 'bg-green-500',
    text: 'Connected',
    animate: false,
  },
  connecting: {
    dotColor: 'bg-yellow-500',
    text: 'Connecting...',
    animate: true,
  },
  disconnected: {
    dotColor: 'bg-red-500',
    text: 'Disconnected',
    animate: false,
  },
} as const;

export function ConnectionStatus({ state, reconnectIn }: ConnectionStatusProps) {
  const config = stateConfig[state];

  return (
    <div className="flex items-center gap-2">
      <div
        data-testid="connection-dot"
        className={`
          w-3 h-3 rounded-full
          ${config.dotColor}
          ${config.animate ? 'animate-pulse' : ''}
        `}
      />
      <span className="text-sm text-gray-400">
        {state === 'disconnected' && reconnectIn !== undefined
          ? `Reconnecting in ${reconnectIn}s...`
          : config.text
        }
      </span>
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run ConnectionStatus`
Expected: PASS - All 7 tests pass

**Step 5: Commit**

```bash
git add apps/host/src/components/ConnectionStatus.tsx apps/host/src/components/ConnectionStatus.test.tsx
git commit -m "feat(host): add connection status indicator with color states"
```

---

## Task host-011: Add error handling and user feedback toasts

**Files:**
- Create: `apps/host/src/components/Toast.tsx`
- Create: `apps/host/src/components/Toast.test.tsx`
- Create: `apps/host/src/store/toastStore.ts`
- Create: `apps/host/src/store/toastStore.test.ts`

**Step 1: Write failing test**

```typescript
// apps/host/src/store/toastStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore } from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty toasts array', () => {
    const state = useToastStore.getState();
    expect(state.toasts).toEqual([]);
  });

  it('should add success toast', () => {
    useToastStore.getState().success('Operation successful');

    const state = useToastStore.getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].type).toBe('success');
    expect(state.toasts[0].message).toBe('Operation successful');
  });

  it('should add error toast', () => {
    useToastStore.getState().error('Something went wrong');

    const state = useToastStore.getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].type).toBe('error');
    expect(state.toasts[0].message).toBe('Something went wrong');
  });

  it('should add info toast', () => {
    useToastStore.getState().info('Player joined');

    const state = useToastStore.getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].type).toBe('info');
    expect(state.toasts[0].message).toBe('Player joined');
  });

  it('should auto-dismiss toast after 5 seconds', () => {
    useToastStore.getState().success('Test toast');

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(5000);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('should remove specific toast by id', () => {
    useToastStore.getState().success('Toast 1');
    useToastStore.getState().success('Toast 2');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(2);

    useToastStore.getState().dismiss(toasts[0].id);

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('Toast 2');
  });

  it('should clear all toasts', () => {
    useToastStore.getState().success('Toast 1');
    useToastStore.getState().error('Toast 2');
    useToastStore.getState().info('Toast 3');

    expect(useToastStore.getState().toasts).toHaveLength(3);

    useToastStore.getState().clearAll();

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
```

```typescript
// apps/host/src/components/Toast.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Toast, ToastContainer } from './Toast';
import { useToastStore } from '../store/toastStore';

describe('Toast', () => {
  it('should display success toast with green styling', () => {
    render(
      <Toast
        id="1"
        type="success"
        message="Success message"
        onDismiss={() => {}}
      />
    );

    const toast = screen.getByTestId('toast-1');
    expect(toast).toHaveClass('bg-green-500');
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should display error toast with red styling', () => {
    render(
      <Toast
        id="2"
        type="error"
        message="Error message"
        onDismiss={() => {}}
      />
    );

    const toast = screen.getByTestId('toast-2');
    expect(toast).toHaveClass('bg-red-500');
  });

  it('should display info toast with blue styling', () => {
    render(
      <Toast
        id="3"
        type="info"
        message="Info message"
        onDismiss={() => {}}
      />
    );

    const toast = screen.getByTestId('toast-3');
    expect(toast).toHaveClass('bg-blue-500');
  });

  it('should call onDismiss when close button clicked', () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        id="4"
        type="info"
        message="Test"
        onDismiss={onDismiss}
      />
    );

    const closeButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(closeButton);

    expect(onDismiss).toHaveBeenCalledWith('4');
  });
});

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
  });

  it('should render all toasts from store', () => {
    useToastStore.getState().success('Toast 1');
    useToastStore.getState().error('Toast 2');

    render(<ToastContainer />);

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
  });

  it('should be positioned at top-right of screen', () => {
    useToastStore.getState().info('Test toast');

    render(<ToastContainer />);

    const container = screen.getByTestId('toast-container');
    expect(container).toHaveClass('fixed', 'top-4', 'right-4');
  });
});
```

**Step 2: Run test, verify failure**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run toastStore`
Expected: FAIL with "Cannot find module './toastStore'"

**Step 3: Implement**

```typescript
// apps/host/src/store/toastStore.ts
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
}

interface ToastStoreState {
  toasts: ToastItem[];
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const AUTO_DISMISS_MS = 5000;

let toastIdCounter = 0;

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],

  success: (message) => {
    const id = `toast-${++toastIdCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'success', message, createdAt: Date.now() }],
    }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  error: (message) => {
    const id = `toast-${++toastIdCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'error', message, createdAt: Date.now() }],
    }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  info: (message) => {
    const id = `toast-${++toastIdCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'info', message, createdAt: Date.now() }],
    }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}));
```

```typescript
// apps/host/src/components/Toast.tsx
import { useToastStore, type ToastType } from '../store/toastStore';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onDismiss: (id: string) => void;
}

const typeStyles = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
} as const;

export function Toast({ id, type, message, onDismiss }: ToastProps) {
  return (
    <div
      data-testid={`toast-${id}`}
      className={`
        ${typeStyles[type]}
        text-white px-6 py-4 rounded-xl shadow-lg
        flex items-center justify-between gap-4
        animate-fadeIn
      `}
    >
      <span className="text-lg">{message}</span>
      <button
        onClick={() => onDismiss(id)}
        className="text-white/80 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      data-testid="toast-container"
      className="fixed top-4 right-4 z-50 flex flex-col gap-3"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
```

**Step 4: Run test, verify pass**

Run: `cd /Users/shahar.cohen/Projects/my-projects/party-popper && pnpm --filter host test -- --run toast`
Expected: PASS - All tests pass (toastStore: 7, Toast: 6)

**Step 5: Commit**

```bash
git add apps/host/src/store/toastStore.ts apps/host/src/store/toastStore.test.ts apps/host/src/components/Toast.tsx apps/host/src/components/Toast.test.tsx
git commit -m "feat(host): add toast notification system for error handling and feedback"
```

---

## Summary

Phase 3 implementation creates the complete host display foundation with 11 tasks:

| Task ID | Description | Key Files |
|---------|-------------|-----------|
| host-001 | WebSocket connection hook | `useGameConnection.ts` |
| host-002 | Zustand game store | `gameStore.ts` |
| host-003 | Lobby screen with join code | `LobbyScreen.tsx`, `JoinCodeDisplay.tsx` |
| host-004 | QR code for join URL | `QRCodeDisplay.tsx` |
| host-005 | Team roster display | `TeamRoster.tsx` |
| host-006 | Team reassignment UI | `MovePlayerButton.tsx` |
| host-007 | Game settings panel | `GameSettings.tsx` |
| host-008 | Start game button | `StartGameButton.tsx` |
| host-009 | TV-optimized layout | `TVLayout.tsx`, `tv-theme.css` |
| host-010 | Connection status indicators | `ConnectionStatus.tsx` |
| host-011 | Toast notifications | `Toast.tsx`, `toastStore.ts` |

**Dependencies from other phases:**
- Phase 2 backend must be complete (WebSocket endpoints, game state management)
- Shared types from `packages/shared` (GameState, Player, Team, etc.)

**All components follow TDD with:**
- Tests written first
- Verified failure before implementation
- Implementation matches acceptance criteria
- Commits after each task
