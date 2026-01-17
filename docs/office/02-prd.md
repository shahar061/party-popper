# Product Requirements Document: Party Popper

## Overview

Party Popper is a digital music timeline game designed to bring gameshow night vibes to family gatherings and friend group hangouts. Two teams compete to build a timeline of songs by guessing the artist, song name, and release year. The game runs on a shared screen (TV or laptop) while players use their phones to participate. Music plays through Spotify via QR code deeplinks displayed on the TV, with one host's phone connected to a Bluetooth speaker for the whole group.

The experience is built around nostalgia and shared memories - moments where someone exclaims "I remember this song!" or debates whether a track came out before or after another. The veto token system adds strategic depth and dramatic tension, creating that competitive gameshow atmosphere.

## User Personas

### Primary: The Game Night Host
- **Who**: Someone who organizes social gatherings - could be a parent hosting family game night, a friend coordinating a party, or anyone who wants an easy activity for a group
- **Goals**: Run a fun, engaging activity that works for everyone regardless of age or music knowledge; create memorable moments through shared nostalgia
- **Pain Points**: Physical board games require setup and have limited song libraries; getting everyone engaged across generations is difficult; wants something that feels like a TV gameshow without the complexity

### Secondary: The Player
- **Who**: Anyone attending the gathering, ages spanning multiple generations
- **Goals**: Have fun, test music knowledge, bond with teammates, experience nostalgia
- **Pain Points**: Some trivia games feel exclusionary if you don't know the topic; wants to participate without needing their own Spotify account

## User Stories

### Epic: Game Setup
#### Story 1: Create Game Session
**As a** host, **I want** to start a new game from the host display, **so that** I can get everyone playing quickly.

**Acceptance Criteria:**
- [ ] Host can create a new game session from the web interface
- [ ] Game generates a unique join code displayed prominently on screen
- [ ] Host can choose between Classic mode (curated songs) or Custom mode (manual entry)
- [ ] Session persists until explicitly ended or times out after inactivity

#### Story 2: Join Game as Player
**As a** player, **I want** to join a game using my phone, **so that** I can participate without any app installation.

**Acceptance Criteria:**
- [ ] Players access the game via a short URL or QR code shown on host display
- [ ] Players enter the join code and their display name
- [ ] Players are assigned to Team A or Team B (host can reassign)
- [ ] Players see confirmation of successful join with their team assignment
- [ ] Supports 1-5 players per team (2-10 total players)

#### Story 3: Configure Game Settings
**As a** host, **I want** to configure game options before starting, **so that** I can tailor the experience to my group.

**Acceptance Criteria:**
- [ ] Host can set target score (default: 10 songs to win)
- [ ] Host can select decades/genres to include in Classic mode
- [ ] Host can add songs manually in Custom mode (artist, title, year, Spotify link)
- [ ] Host can view and edit team rosters before starting
- [ ] Host can start game once at least 1 player is on each team

### Epic: Core Gameplay Loop
#### Story 4: Play a Round
**As a** team, **I want** to hear a song and guess its details, **so that** I can add it to my timeline and score points.

**Acceptance Criteria:**
- [ ] Host display shows QR code linking to current song on Spotify
- [ ] Host scans QR with their phone to play music through connected speaker
- [ ] Current team sees input fields for: Artist, Song Title, Release Year
- [ ] Team has configurable time limit to submit their guess (e.g., 60 seconds)
- [ ] Partial credit system: points for correct artist, title, or year (exact scoring TBD)
- [ ] If team scores, song is added to their timeline in chronological position
- [ ] Turn passes to opposing team

#### Story 5: View Team Timelines
**As a** player, **I want** to see both teams' timelines on the host display, **so that** I can track progress and strategize.

**Acceptance Criteria:**
- [ ] Host display shows both team timelines side by side
- [ ] Each timeline shows songs in chronological order (by release year)
- [ ] Current score (song count) is prominently displayed for each team
- [ ] Visual indication of which team's turn it is
- [ ] Timeline updates in real-time as songs are added

#### Story 6: Real-time Answer Display
**As a** spectator/player, **I want** to see answers appear on the host display in real-time, **so that** the experience feels like a live gameshow.

**Acceptance Criteria:**
- [ ] As team members type, their answers appear on the host display
- [ ] Team can see what teammates are typing to coordinate
- [ ] Final submitted answer is clearly highlighted
- [ ] Correct/incorrect feedback is shown dramatically after submission

### Epic: Veto Token System
#### Story 7: Use Veto Token
**As a** team, **I want** to challenge the opposing team's answer with a veto token, **so that** I can add strategic drama to the game.

**Acceptance Criteria:**
- [ ] Each team starts with a limited number of veto tokens (e.g., 3)
- [ ] After opposing team submits, defending team has brief window to veto
- [ ] Veto challenges one component of the answer (artist, title, or year)
- [ ] If veto is correct (answer was wrong), vetoing team steals the opportunity
- [ ] If veto is incorrect (answer was right), vetoing team loses a token with no benefit
- [ ] Token count is visible on host display for both teams

### Epic: Game Conclusion
#### Story 8: Win the Game
**As a** team, **I want** to reach the target score first, **so that** we can celebrate victory.

**Acceptance Criteria:**
- [ ] Game ends when a team reaches target song count (default 10)
- [ ] Victory screen displays winning team with celebration animation
- [ ] Final timelines and scores are shown
- [ ] Host can choose to play again or end session

#### Story 9: Tiebreaker Round
**As a** player, **I want** a fair tiebreaker if both teams are close to winning, **so that** there's a clear winner.

**Acceptance Criteria:**
- [ ] If both teams reach target score on same round, tiebreaker activates
- [ ] Tiebreaker: both teams hear same song simultaneously
- [ ] First team to submit correct answer wins
- [ ] If neither correct, new tiebreaker song plays

### Epic: Session Resilience
#### Story 10: Reconnect After Disconnection
**As a** player, **I want** to rejoin if I lose connection, **so that** I don't miss the game.

**Acceptance Criteria:**
- [ ] Player's session is preserved for reasonable timeout period (e.g., 5 minutes)
- [ ] Returning player can rejoin with same name and team
- [ ] Game state syncs immediately upon reconnection
- [ ] Team can continue playing even if one member is temporarily disconnected

## Feature Priority

| Feature | Priority | Notes |
|---------|----------|-------|
| Host display with game state | P0 | Core experience anchor |
| Mobile player join/interface | P0 | Essential for participation |
| Real-time sync between host and players | P0 | Critical for gameshow feel |
| Team creation and management | P0 | Foundation of gameplay |
| Song QR code generation (Spotify deeplinks) | P0 | Music playback mechanism |
| Answer submission and validation | P0 | Core game mechanic |
| Timeline display and management | P0 | Visual score tracking |
| Classic mode (curated 100-song pool) | P0 | Out-of-box playability |
| Custom mode (manual song entry) | P0 | User flexibility |
| Veto token system | P0 | Strategic depth, gameshow drama |
| Tiebreaker mechanism | P0 | Clean game resolution |
| Player reconnection support | P1 | Resilience for real-world use |
| Configurable game settings | P1 | Host control |
| Decades/genre filtering (Classic mode) | P1 | Tailored experience |

## Non-Functional Requirements

### Performance
- Real-time sync latency < 500ms between player actions and host display
- Host display updates smoothly without page refreshes
- Support 10 simultaneous players without degradation
- QR codes generate instantly when song is selected

### Reliability
- Game state persists through brief network interruptions
- Player reconnection works within 5-minute window
- No data loss if host refreshes the page mid-game

### Compatibility
- Host display: Modern browsers (Chrome, Safari, Firefox, Edge - last 2 versions)
- Player interface: Mobile browsers on iOS Safari and Android Chrome
- Responsive design for various screen sizes
- QR deeplinks work with Spotify app on iOS and Android

### Security
- Join codes are short-lived and unguessable
- No authentication required (session-based only)
- No personal data collected beyond display names

### Accessibility
- High contrast mode for host display (visibility from distance)
- Large, readable text for TV viewing
- Touch-friendly interface for mobile players

## Technical Requirements

### Real-time Communication
- WebSocket or equivalent for bidirectional real-time updates
- Optimistic UI updates with server reconciliation
- Heartbeat mechanism for connection status

### State Management
- Server-authoritative game state
- Client-side caching for resilience
- Session recovery mechanism for reconnection

### Spotify Integration
- Generate QR codes containing Spotify deeplinks (spotify:track:XXXX format)
- Fallback to web URL if app not installed
- No Spotify API authentication required (deeplinks only)

## Out of Scope for v1

- User accounts and authentication
- Persistent profiles or player history
- Leaderboards or statistics
- Direct Spotify playlist import (manual entry only for Custom mode)
- Multiple game variations beyond timeline mechanic
- Offline play support
- Native mobile apps (web only)
- Monetization features
- Social sharing
- Spectator mode (non-playing viewers)

## Success Metrics

### Functional Completion
- A complete game can be played from start to finish (first team to 10 songs)
- Both Classic and Custom modes are fully functional
- QR code deeplinks successfully open songs in Spotify app
- Veto token system works correctly with proper steal/penalty mechanics
- Tiebreaker round successfully resolves ties
- Games support 2-10 players (1v1 up to 5v5)

### User Experience
- Game setup takes under 2 minutes
- Players can join within 30 seconds of seeing join code
- No player-facing errors during normal gameplay
- Real-time updates feel instantaneous

### Technical Health
- 99% uptime during active game sessions
- Zero game state corruption
- Successful reconnection rate > 95%

## Open Questions

1. **Curated Song Pool**: What specific decades and genres should the initial 100-song pool cover? Recommendation: 20 songs per decade from 1970s-2010s, weighted toward recognizable hits across genres.

2. **Scoring Details**: Exact point values for partial correct answers (artist only, title only, year within range)? Should year have a "close enough" tolerance (e.g., +/- 1 year)?

3. **Veto Timing**: How long does the opposing team have to decide on a veto? Recommendation: 10-15 seconds.

4. **Custom Mode Song Limit**: Minimum/maximum songs for a custom game? Need at least target score + buffer for variety.

5. **Inactivity Timeout**: How long before an inactive game session is cleaned up? Recommendation: 30 minutes.
