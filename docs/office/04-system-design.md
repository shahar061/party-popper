# System Design: Party Popper

## Architecture Overview

### High-Level Architecture

Party Popper uses a serverless, event-driven architecture optimized for minimal cost while supporting real-time gameplay. The system consists of three main components:

1. **Host Frontend** - React SPA displayed on TV/laptop showing game state, timelines, and QR codes
2. **Player Frontend** - Mobile-optimized React SPA for joining games and submitting answers
3. **Serverless Backend** - Edge functions handling game logic with managed WebSocket connections

```
┌─────────────────┐     ┌─────────────────┐
│   Host Display  │     │  Player Phones  │
│   (TV/Laptop)   │     │    (Mobile)     │
│                 │     │                 │
│  React + Vite   │     │  React + Vite   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    WebSocket          │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │    Cloudflare Edge    │
         │                       │
         │  ┌─────────────────┐  │
         │  │  Workers (API)  │  │
         │  └────────┬────────┘  │
         │           │           │
         │  ┌────────▼────────┐  │
         │  │ Durable Objects │  │
         │  │  (Game State)   │  │
         │  └─────────────────┘  │
         └───────────────────────┘
```

### Design Principles

- **Serverless-first**: No always-on infrastructure; pay only for actual usage. Cloudflare Workers free tier includes 100K requests/day - more than enough for a party game.
- **Edge-native real-time**: Durable Objects provide WebSocket support at the edge with built-in state persistence, eliminating the need for separate database and pub/sub services.
- **Single deployment target**: Both frontend and backend deploy to Cloudflare, simplifying DevOps and keeping everything within free tier.
- **Server-authoritative state**: All game logic runs server-side to prevent cheating and ensure consistency across all connected clients.
- **Graceful degradation**: Optimistic UI updates with server reconciliation; automatic reconnection handling.

## Components

### Host Frontend

- **Purpose**: Displays the main game interface on a shared screen (TV/laptop). Shows game state, team timelines, QR codes for songs, and real-time answer reveals.
- **Technology**: React 18 + Vite + TypeScript
- **Responsibilities**:
  - Create new game sessions and display join codes
  - Render team timelines with chronological song placement
  - Generate and display Spotify QR code deeplinks
  - Show real-time answer typing from players (gameshow effect)
  - Display veto token counts and veto interactions
  - Handle victory/tiebreaker screens

### Player Frontend

- **Purpose**: Mobile-optimized interface for players to join games and participate.
- **Technology**: React 18 + Vite + TypeScript (shared component library with Host)
- **Responsibilities**:
  - Join game via code entry
  - Display team assignment and game status
  - Provide answer input (artist, title, year)
  - Enable veto token usage
  - Handle reconnection after network interruption

### Game Server (Durable Object)

- **Purpose**: Manages game state and orchestrates real-time communication between all connected clients.
- **Technology**: Cloudflare Durable Objects (JavaScript/TypeScript)
- **Responsibilities**:
  - Maintain authoritative game state
  - Handle WebSocket connections for all players and host
  - Process answer submissions and validate against song data
  - Manage turn flow, scoring, and win conditions
  - Broadcast state updates to all connected clients
  - Handle veto challenges and token management
  - Manage player reconnection and session recovery

### API Layer (Workers)

- **Purpose**: HTTP endpoints for game creation, joining, and static data retrieval.
- **Technology**: Cloudflare Workers
- **Responsibilities**:
  - Create new game sessions (generates unique join code)
  - Route players to appropriate Durable Object
  - Serve curated song pool for Classic mode
  - Health checks and monitoring endpoints

## Data Architecture

### Data Models

```typescript
// Core game state - stored in Durable Object
interface GameState {
  id: string;                    // Unique game ID
  joinCode: string;              // 4-character alphanumeric code
  status: 'lobby' | 'playing' | 'finished';
  mode: 'classic' | 'custom';
  settings: GameSettings;
  teams: {
    A: Team;
    B: Team;
  };
  currentRound: Round | null;
  songPool: Song[];              // Remaining songs to play
  playedSongs: Song[];           // Songs already used
  createdAt: number;
  lastActivityAt: number;
}

interface Team {
  name: string;
  players: Player[];
  timeline: TimelineSong[];      // Songs in chronological order
  vetoTokens: number;
  score: number;                 // Number of songs on timeline
}

interface Player {
  id: string;                    // UUID
  name: string;
  connected: boolean;
  lastSeen: number;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  spotifyUri: string;            // spotify:track:XXXX
  spotifyUrl: string;            // Fallback web URL
}

interface Round {
  song: Song;
  activeTeam: 'A' | 'B';
  phase: 'guessing' | 'veto_window' | 'reveal';
  startedAt: number;
  currentAnswer: Answer | null;
  vetoChallenge: VetoChallenge | null;
}

interface Answer {
  artist: string;
  title: string;
  year: number;
  submittedBy: string;           // Player ID
  submittedAt: number;
}

interface VetoChallenge {
  challengedField: 'artist' | 'title' | 'year';
  challengingTeam: 'A' | 'B';
}
```

### Data Flow

1. **Game Creation**: Host frontend calls Worker API -> Worker creates Durable Object -> Returns join code
2. **Player Join**: Player enters code -> Worker routes to Durable Object -> WebSocket connection established
3. **Gameplay**: All game actions flow through WebSocket -> Durable Object validates and updates state -> Broadcasts to all clients
4. **Reconnection**: Player reconnects -> Worker routes to same Durable Object by game ID -> Full state sync

### Storage Strategy

- **Primary Storage**: Durable Object in-memory state with automatic persistence
  - Rationale: Durable Objects persist state to disk automatically; no separate database needed
  - Perfect for session-based games (no long-term user data)
  - Automatic cleanup when object is idle

- **Song Data**: Static JSON bundled with Worker
  - 100-song curated pool is small (~10KB); no database query needed
  - Custom mode songs stored in game state (temporary)

- **Caching**: Not required for MVP
  - Game state is real-time; caching would add complexity
  - Static assets served via Cloudflare CDN automatically

## API Design

### API Style

**WebSocket + REST hybrid**
- REST for session creation and initial join
- WebSocket for all real-time game communication
- Rationale: WebSockets are essential for real-time sync (<500ms latency requirement). REST handles simple request/response patterns.

### HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/games` | POST | Create new game session |
| `/api/games/:code` | GET | Get game info (for join page) |
| `/api/games/:code/join` | POST | Join game, returns WebSocket URL |
| `/api/songs/classic` | GET | Get curated song pool metadata |

### WebSocket Messages

**Client -> Server:**
```typescript
{ type: 'join', payload: { playerName: string, team?: 'A' | 'B' } }
{ type: 'start_game' }  // Host only
{ type: 'submit_answer', payload: { artist, title, year } }
{ type: 'use_veto', payload: { field: 'artist' | 'title' | 'year' } }
{ type: 'typing', payload: { field, value } }  // Real-time typing indicator
{ type: 'next_round' }  // Host only
{ type: 'reassign_team', payload: { playerId, team } }  // Host only
```

**Server -> Client:**
```typescript
{ type: 'state_sync', payload: GameState }  // Full state on connect/reconnect
{ type: 'player_joined', payload: Player }
{ type: 'round_started', payload: Round }
{ type: 'typing_update', payload: { playerId, field, value } }
{ type: 'answer_submitted', payload: Answer }
{ type: 'veto_initiated', payload: VetoChallenge }
{ type: 'round_result', payload: { correct, score, timeline } }
{ type: 'game_over', payload: { winner, finalState } }
{ type: 'error', payload: { code, message } }
```

## Technology Stack

### Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend Framework** | React 18 | Industry standard; excellent ecosystem; team likely familiar |
| **Build Tool** | Vite | Fast dev experience; optimized production builds; native TS support |
| **Language** | TypeScript | Type safety across frontend/backend; shared type definitions |
| **Styling** | Tailwind CSS | Rapid UI development; small bundle size; responsive utilities |
| **QR Generation** | qrcode.react | Lightweight; renders Spotify deeplinks as scannable QR codes |
| **Backend Runtime** | Cloudflare Workers | Free tier: 100K requests/day; edge deployment; no cold starts |
| **Real-time/State** | Cloudflare Durable Objects | Built-in WebSocket support; persistent state; free tier included |
| **Hosting (Frontend)** | Cloudflare Pages | Free tier; automatic deployments from Git; global CDN |
| **Domain/DNS** | Cloudflare | Free tier; integrates with Workers/Pages |

### Why Cloudflare Over Alternatives

| Alternative | Why Not |
|-------------|---------|
| **Vercel + Supabase** | Supabase Realtime has connection limits; more complex setup |
| **Firebase** | Realtime DB pricing can spike unexpectedly; Google lock-in |
| **AWS (Lambda + API Gateway + DynamoDB)** | More complex; WebSocket support requires additional services |
| **Railway/Render** | Always-on pricing doesn't fit $0-50 budget for minimal usage |
| **Fly.io** | Good option, but Durable Objects' built-in persistence is simpler |

**Cloudflare free tier includes:**
- Workers: 100,000 requests/day
- Durable Objects: 1 million requests/month, 1GB storage
- Pages: Unlimited sites, unlimited bandwidth
- WebSocket connections: Included with Durable Objects

For a party game with ~10 concurrent users per session and occasional play, this is more than sufficient.

## Security Considerations

### Authentication
- **No user accounts** - purely session-based as per requirements
- **Join codes**: 4-character alphanumeric (36^4 = 1.6M combinations), expire after game ends
- **Host identification**: First connection to a game becomes host; stored in Durable Object state
- **Player sessions**: UUID generated client-side, stored in localStorage for reconnection

### Authorization
- **Role-based actions**: Durable Object validates sender role (host vs player) before processing commands
- **Team-scoped actions**: Players can only submit answers/vetoes for their own team
- **Host-only controls**: Start game, next round, team reassignment protected server-side

### Data Protection
- **Minimal data collection**: Only display names stored; no PII required
- **Automatic cleanup**: Durable Objects garbage collected after 30 minutes of inactivity
- **No persistent storage**: Session data does not survive past game lifecycle

### Transport Security
- **HTTPS enforced**: Cloudflare provides automatic SSL for all endpoints
- **WSS for WebSockets**: Secure WebSocket connections by default

## Scalability Considerations

### Current Scale (MVP)
- **Designed for**: 1-10 concurrent games, 2-10 players each
- **Expected usage**: Occasional game nights, not continuous high traffic
- **Free tier headroom**: 100K requests/day supports ~1000 full games/day

### Growth Path

**Stage 1: Staying Free (100-1000 MAU)**
- Current architecture handles this easily
- Monitor Cloudflare dashboard for approaching limits

**Stage 2: Paid Tier ($5-20/month)**
- Cloudflare Workers Paid: $5/month for 10M requests
- Durable Objects: $0.15/million requests beyond free tier
- Likely needed if product gains traction (10K+ MAU)

**Stage 3: Horizontal Scaling (10K+ concurrent games)**
- Durable Objects automatically scale; one object per game
- Add Cloudflare R2 for song pool storage if catalog grows
- Consider caching layer for read-heavy data (song metadata)

**What doesn't need to change:**
- Architecture remains the same; Cloudflare handles scaling
- No database migrations or service additions needed
- WebSocket per-game isolation prevents cross-game interference

## Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │ Cloudflare Pages│    │        Cloudflare Workers           │ │
│  │                 │    │                                     │ │
│  │  ┌───────────┐  │    │  ┌─────────────┐  ┌──────────────┐ │ │
│  │  │Host App   │  │    │  │ API Router  │  │Game Durable  │ │ │
│  │  │(React SPA)│  │    │  │  (Worker)   │──│   Objects    │ │ │
│  │  └───────────┘  │    │  └─────────────┘  │              │ │ │
│  │  ┌───────────┐  │    │                   │ ┌──────────┐ │ │ │
│  │  │Player App │  │    │                   │ │ Game #1  │ │ │ │
│  │  │(React SPA)│  │    │                   │ │ - State  │ │ │ │
│  │  └───────────┘  │    │                   │ │ - WSocks │ │ │ │
│  └─────────────────┘    │                   │ └──────────┘ │ │ │
│                         │                   │ ┌──────────┐ │ │ │
│                         │                   │ │ Game #2  │ │ │ │
│                         │                   │ └──────────┘ │ │ │
│                         │                   └──────────────┘ │ │
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

        │                           │
        │ HTTPS                     │ WSS
        ▼                           ▼
┌─────────────┐             ┌─────────────┐
│ Host Device │             │Player Phones│
│  (Browser)  │             │ (Browsers)  │
└─────────────┘             └─────────────┘
```

## Open Technical Questions

1. **Join code collision handling**: With 4 characters, collisions are rare but possible. Should we check for active games with same code, or use longer codes?

2. **Song data source for Classic mode**: Where do we source the curated 100 songs? Need artist, title, year, and Spotify track IDs. Manual curation or use an existing dataset?

3. **Typing broadcast throttling**: Real-time typing indicators could generate many messages. Throttle to every 100ms? Or only send on field blur?

4. **Reconnection grace period**: PRD suggests 5 minutes. Should disconnected players block gameplay, or can team continue without them?

5. **QR code size optimization**: What's the minimum scannable QR size for TV viewing from 3 meters? Need to test with actual devices.

6. **Answer validation flexibility**: For year, should "+/- 1 year" be configurable? How fuzzy should title/artist matching be (handling "The Beatles" vs "Beatles")?

7. **Custom mode song limit**: What's the minimum/maximum songs for custom games? PRD suggests "at least target score + buffer" - is 15 minimum reasonable?
