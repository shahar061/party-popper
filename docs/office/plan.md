# Implementation Plan: Party Popper

## Overview

Party Popper is a digital music timeline game where two teams compete to build song timelines by guessing artist, title, and release year. The implementation follows a serverless architecture using Cloudflare Workers and Durable Objects for real-time state management, with React frontends for both host display (TV/laptop) and mobile players.

The critical path runs through backend infrastructure first (Durable Objects must exist before any real-time features work), followed by the host display foundation, then mobile player interface, and finally the full gameplay loop. The veto system and tiebreaker are dependent on having working core gameplay. This plan is structured to deliver a playable end-to-end experience as early as possible, then layer on features.

## Phases

### Phase 1: Project Foundation
**Goal**: Establish the monorepo structure, tooling, and deploy pipeline so all subsequent work can be continuously integrated and tested.

**Milestone**: Empty React apps deploy to Cloudflare Pages; Worker deploys to Cloudflare Workers; local development works end-to-end.

#### Tasks
- [ ] Initialize monorepo structure (apps/host, apps/player, packages/shared, packages/backend)
- [ ] Configure TypeScript with shared tsconfig base and project references
- [ ] Set up Vite for host and player apps with React 18
- [ ] Configure Tailwind CSS for both frontends
- [ ] Create Cloudflare Worker project with Durable Object stub
- [ ] Set up Wrangler configuration for local development
- [ ] Configure Cloudflare Pages deployment for frontends
- [ ] Set up CI/CD pipeline (GitHub Actions) for automated deployments
- [ ] Create shared types package with core TypeScript interfaces (GameState, Player, Team, Song, etc.)
- [ ] Verify local dev environment: Worker + both frontends running together

**Dependencies**: None

---

### Phase 2: Backend Core - Game State and Real-time Infrastructure
**Goal**: Build the Durable Object that manages game state and WebSocket connections. This is the foundation all real-time features depend on.

**Milestone**: Can create a game via API, connect via WebSocket, and receive state updates. Verified with Postman/wscat.

#### Tasks
- [ ] Implement Game Durable Object class with WebSocket handling
- [ ] Create game state management (lobby, playing, finished states)
- [ ] Implement REST endpoints: POST /api/games (create), GET /api/games/:code (info)
- [ ] Implement join code generation (4-char alphanumeric, collision-safe)
- [ ] Build WebSocket message router with type-safe handlers
- [ ] Implement player join/leave logic with session tracking
- [ ] Implement team assignment (auto-assign and manual reassign)
- [ ] Build state broadcast mechanism (full sync and delta updates)
- [ ] Add heartbeat/ping-pong for connection health
- [ ] Implement player reconnection with session recovery
- [ ] Create curated 100-song pool JSON (20 songs per decade: 1970s-2010s)
- [ ] Add song pool loading for Classic mode
- [ ] Write integration tests for Durable Object behavior

**Dependencies**: Phase 1 complete (monorepo structure, shared types)

---

### Phase 3: Host Display Foundation
**Goal**: Build the host frontend that displays on TV/laptop - the visual anchor of the game experience.

**Milestone**: Host can create game, see join code, watch players join, assign teams, and start game. Real-time updates work.

#### Tasks
- [ ] Create WebSocket connection hook with reconnection logic
- [ ] Build game state context/store (Zustand or Context API)
- [ ] Design and implement lobby screen with join code display
- [ ] Generate QR code for player join URL (qrcode.react)
- [ ] Build team roster display with player names
- [ ] Implement team reassignment UI (drag-drop or buttons)
- [ ] Create game settings panel (target score, mode selection)
- [ ] Build "Start Game" flow with validation (min 1 player per team)
- [ ] Design TV-optimized layout (large text, high contrast, readable at distance)
- [ ] Implement connection status indicators
- [ ] Add error handling and user feedback toasts

**Dependencies**: Phase 2 complete (backend can accept connections and manage state)

---

### Phase 4: Mobile Player Interface
**Goal**: Build the mobile web app that players use to join and participate.

**Milestone**: Players can join via QR/code, see their team, and interact with the game. Ready for gameplay implementation.

#### Tasks
- [ ] Create mobile-optimized layout and navigation
- [ ] Build join screen with code entry and name input
- [ ] Implement WebSocket connection with same hooks as host (shared package)
- [ ] Create team assignment confirmation screen
- [ ] Build waiting/lobby view showing other players
- [ ] Design touch-friendly input components for gameplay
- [ ] Implement connection status and reconnection UI
- [ ] Add localStorage session persistence for reconnection
- [ ] Handle mobile browser quirks (iOS Safari, Android Chrome)
- [ ] Test responsive behavior across device sizes

**Dependencies**: Phase 3 complete (host display working, can verify player join flow end-to-end)

---

### Phase 5: Core Gameplay Loop
**Goal**: Implement the main game mechanics - playing songs, submitting answers, scoring, and building timelines.

**Milestone**: A complete round can be played: song QR shown, team submits answer, scoring calculated, timeline updated, turn passes. Game ends when target score reached.

#### Tasks
- [ ] Backend: Implement round state machine (guessing -> reveal -> next)
- [ ] Backend: Build answer submission and validation logic
- [ ] Backend: Implement scoring system (partial credit for artist/title/year)
- [ ] Backend: Add timeline management (insert song in chronological order)
- [ ] Backend: Implement turn rotation between teams
- [ ] Backend: Add win condition detection (first to target score)
- [ ] Host: Build current round display with song QR code (Spotify deeplink)
- [ ] Host: Create answer input area showing current team's submission
- [ ] Host: Implement real-time typing indicators (gameshow effect)
- [ ] Host: Build timeline visualization (side-by-side, chronological)
- [ ] Host: Create round result reveal animation
- [ ] Host: Add score display and turn indicator
- [ ] Player: Build answer submission form (artist, title, year fields)
- [ ] Player: Implement typing broadcast for real-time display
- [ ] Player: Add turn awareness (active vs waiting state)
- [ ] Player: Create answer confirmation and feedback UI
- [ ] Test full gameplay loop with multiple players

**Dependencies**: Phase 4 complete (both frontends connected, player can interact)

---

### Phase 6: Advanced Features and Polish
**Goal**: Complete the P0 feature set with veto system, tiebreaker, and Custom mode. Polish the experience.

**Milestone**: Full game playable with all features: veto challenges work, ties resolve correctly, Custom mode allows manual song entry. Ready for real user testing.

#### Tasks
- [ ] Backend: Implement veto token system (3 tokens per team)
- [ ] Backend: Add veto window phase after answer submission
- [ ] Backend: Handle veto resolution (steal opportunity or penalty)
- [ ] Backend: Implement tiebreaker round logic (simultaneous song)
- [ ] Backend: Build Custom mode song entry and validation
- [ ] Host: Create veto challenge UI with timer countdown
- [ ] Host: Display veto token counts for both teams
- [ ] Host: Build veto result animation (steal or failed challenge)
- [ ] Host: Implement tiebreaker screen with simultaneous play
- [ ] Host: Create victory celebration screen
- [ ] Host: Add "Play Again" and "End Session" options
- [ ] Player: Build veto button with confirmation
- [ ] Player: Add veto window countdown display
- [ ] Player: Implement tiebreaker rapid-answer UI
- [ ] Host: Build Custom mode song entry interface
- [ ] Test veto mechanics thoroughly (edge cases)
- [ ] Test tiebreaker scenarios
- [ ] Performance optimization (bundle size, WebSocket message batching)
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)
- [ ] Mobile device testing (iOS Safari, Android Chrome)
- [ ] Accessibility review (contrast, text size, touch targets)

**Dependencies**: Phase 5 complete (core gameplay working end-to-end)

---

## Timeline Overview

| Phase | Milestone | Dependencies |
|-------|-----------|--------------|
| 1. Project Foundation | Apps deploy to Cloudflare; local dev works | None |
| 2. Backend Core | Game creation and WebSocket connections work | Phase 1 |
| 3. Host Display Foundation | Create game, see players join, start game | Phase 2 |
| 4. Mobile Player Interface | Players join and see team assignment | Phase 3 |
| 5. Core Gameplay Loop | Complete round playable, game can be won | Phase 4 |
| 6. Advanced Features and Polish | Veto, tiebreaker, Custom mode all working | Phase 5 |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Cloudflare Durable Objects complexity | Start with minimal state; add features incrementally. Test WebSocket behavior early in Phase 2. |
| Real-time sync latency issues | Design for optimistic updates from start; measure latency in Phase 3 and adjust. |
| Mobile browser WebSocket reliability | Implement robust reconnection in shared package; test on real devices in Phase 4. |
| QR code scanning issues at distance | Test QR sizes early with actual TV setup; have fallback manual code entry. |
| Song data curation effort | Create minimal viable song pool (50 songs) first; expand to 100 after core gameplay works. |
| Scoring/validation edge cases | Define clear rules in Phase 5; use fuzzy matching library if needed for artist/title. |

## Definition of Done

- [ ] All P0 features implemented and functional
- [ ] A complete game playable from start to finish (lobby -> gameplay -> victory)
- [ ] Both Classic and Custom modes working
- [ ] QR code deeplinks open songs in Spotify app
- [ ] Veto token system functions correctly
- [ ] Tiebreaker resolves ties
- [ ] Player reconnection works within 5-minute window
- [ ] Host display readable from 3 meters on TV
- [ ] Mobile interface works on iOS Safari and Android Chrome
- [ ] Real-time sync latency under 500ms
- [ ] No critical bugs or game-breaking edge cases
- [ ] Deployed to Cloudflare and accessible via public URL

## Environment Setup

### Local Development

**Prerequisites**
- Node.js 20+ (LTS recommended)
- npm 10+ or pnpm 8+ (for monorepo workspaces)
- Wrangler CLI (`npm install -g wrangler`) - Cloudflare's CLI for Workers/Durable Objects
- Git

**Setup Steps**
1. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd party-popper
   npm install
   ```
2. Authenticate with Cloudflare (required for Durable Objects local dev):
   ```bash
   wrangler login
   ```
3. Start the development environment:
   ```bash
   # Terminal 1: Start the Worker + Durable Objects locally
   cd packages/backend
   wrangler dev --local

   # Terminal 2: Start Host frontend
   cd apps/host
   npm run dev

   # Terminal 3: Start Player frontend
   cd apps/player
   npm run dev
   ```
4. Access locally:
   - Host app: http://localhost:5173
   - Player app: http://localhost:5174
   - Worker API: http://localhost:8787

**Environment Variables**
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend Worker URL | Yes | `http://localhost:8787` (dev) |
| `VITE_WS_URL` | WebSocket endpoint | Yes | `ws://localhost:8787/ws` (dev) |

Note: Cloudflare Workers do not use `.env` files in production. Secrets are managed via `wrangler secret put <NAME>`. For local development, use `wrangler dev --var KEY:VALUE` or a `.dev.vars` file.

### CI/CD Pipeline

**Platform**: GitHub Actions

**Workflows**

1. **Pull Request Checks** (`.github/workflows/pr.yml`)
   - Trigger: Pull request to `main`
   - Steps:
     - Install dependencies
     - TypeScript type check (`npm run typecheck`)
     - Lint (`npm run lint`)
     - Unit tests (`npm run test`)
     - Build all packages (`npm run build`)

2. **Staging Deploy** (`.github/workflows/staging.yml`)
   - Trigger: Push to `main`
   - Steps:
     - Run all PR checks
     - Deploy Worker to staging environment (`wrangler deploy --env staging`)
     - Deploy Host app to Cloudflare Pages (staging branch)
     - Deploy Player app to Cloudflare Pages (staging branch)
     - Run smoke tests against staging

3. **Production Deploy** (`.github/workflows/production.yml`)
   - Trigger: Manual workflow dispatch or tag push (`v*`)
   - Steps:
     - Run all PR checks
     - Deploy Worker to production (`wrangler deploy --env production`)
     - Deploy Host app to Cloudflare Pages (production)
     - Deploy Player app to Cloudflare Pages (production)

**Required Secrets** (GitHub Repository Secrets):
- `CLOUDFLARE_API_TOKEN` - API token with Workers and Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account identifier

### Infrastructure

**Hosting**
- **Frontend Apps**: Cloudflare Pages (global CDN, automatic HTTPS)
- **Backend API/WebSocket**: Cloudflare Workers (edge deployment, no cold starts)
- **Game State**: Cloudflare Durable Objects (persistent WebSocket connections, in-memory state with automatic disk persistence)

**Database**
- No traditional database required
- Durable Objects provide per-game state persistence
- Static song pool bundled as JSON with the Worker
- Session data is ephemeral (no long-term user storage)

**Secrets Management**
- Development: `.dev.vars` file (gitignored)
- Production: Cloudflare dashboard or `wrangler secret put`
- GitHub Actions: Repository secrets for CI/CD

### Deployment Strategy

**Staging Environment**
- URL: `staging.partypopper.pages.dev` (or configured custom subdomain)
- Worker environment: `staging` (defined in `wrangler.toml`)
- Automatic deployment on every push to `main`
- Used for integration testing and QA

**Production Environment**
- URL: `partypopper.pages.dev` (or custom domain)
- Worker environment: `production`
- Manual deployment via GitHub Actions workflow dispatch or version tag
- Requires successful staging deployment first

**Rollback Procedure**
1. **Cloudflare Workers**: Rollback via Cloudflare dashboard (Deployments tab) or redeploy previous commit
   ```bash
   git checkout <previous-tag>
   wrangler deploy --env production
   ```
2. **Cloudflare Pages**: Rollback via Cloudflare dashboard (select previous deployment and "Rollback to this deploy")
3. **Emergency**: Both Workers and Pages support instant rollback to any previous deployment from the Cloudflare dashboard

**Wrangler Configuration** (`wrangler.toml`)
```toml
name = "party-popper-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "GAME", class_name = "Game" }
]

[[migrations]]
tag = "v1"
new_classes = ["Game"]

[env.staging]
name = "party-popper-api-staging"

[env.production]
name = "party-popper-api-production"
```
