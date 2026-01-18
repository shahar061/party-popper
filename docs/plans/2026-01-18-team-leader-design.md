# Team Leader Feature Design

## Overview

Add a Team Leader role to each team. The leader has special powers: their vote is the team's official answer, and they can see teammates' votes in real-time to inform their decision.

## Leader Selection

### Lobby Phase (Volunteer)
- Players see a "Be Team Leader" button on their phone
- First player to tap claims leadership for their team
- All teammates see the button disappear, replaced by "👑 [Name] is your Team Leader"
- Host screen shows crown next to leader names in team rosters

### Game Start (Random Fallback)
- Backend checks each team for a leader
- If missing: randomly assign one player from that team
- Brief notification: "No leader volunteered — [Name] was randomly chosen!"

### Leader Disconnects
- In lobby: leadership becomes available again for teammates to claim
- Mid-game: automatically reassign to another teammate (random)

## Data Model

### Player Object
```typescript
interface Player {
  // existing fields...
  isTeamLeader: boolean;
}
```

### Game State
- `leaderSelectionComplete: boolean` per team — tracks if leader was claimed or needs random assignment
- During quiz phase: `teamVotes: Map<playerId, answer>` for leader visibility

### WebSocket Messages
- `CLAIM_TEAM_LEADER` — player requests leadership
- `LEADER_CLAIMED` — broadcast: "[Name] is now Team X's leader"
- `TEAMMATE_VOTE` — sent only to team leader, showing teammate's current vote
- `LEADER_DECISION` — leader's final answer submission

## Player Status Row (UI)

A compact bar at the top of the player client, always visible throughout the game.

**Content:**
- Player's name (left-aligned)
- Team indicator (team color or "Team 1" / "Team 2")
- Crown emoji next to name if player is team leader

**Example:**
```
┌─────────────────────────────┐
│ 👑 Sarah          Team 1   │  ← Leader view
└─────────────────────────────┘

┌─────────────────────────────┐
│ Mike              Team 2   │  ← Regular player view
└─────────────────────────────┘
```

**Visibility:** Lobby, all gameplay phases, between rounds, scoreboard screens.

## Quiz Phase — Leader Powers

### Regular Teammates
- See quiz question and options as normal
- Tap to vote — selection sent to backend
- See "You voted: Option B" confirmation
- Cannot see what teammates picked
- Their vote is input for the leader (doesn't directly count)

### Team Leader
- Same quiz UI with additional "Team Votes" panel
- Shows teammates' votes updating in real-time:
  ```
  ┌─ Team Votes ─────────────┐
  │ Mike: Option A           │
  │ Lisa: Option B           │
  │ Jake: (thinking...)      │
  └──────────────────────────┘
  ```
- Leader's selection = team's final answer
- Can change answer anytime until timer ends
- Visual emphasis that their choice is "the official answer"

### Backend Logic
- Store all teammate votes for leader visibility
- Only leader's vote counts for scoring
- On timer end: if leader hasn't voted, use last selection (or random if none)

## Placement Phase — Leader Powers

### Regular Teammates
- See timeline, can tap/drag to propose a position
- Proposal sent to backend, shown to leader as suggestion
- See "You suggested: between Song A and Song B"
- Cannot submit final placement

### Team Leader
- Sees "Teammate Suggestions" showing where teammates propose:
  ```
  Timeline: [Song A] --- [?] --- [Song B] --- [Song C]
                          ↑
                    Mike suggests here
                    Lisa suggests here
  ```
- Leader drags/taps to place — their placement is final
- "Confirm Placement" button only visible to leader

## Veto Phases — Leader Powers

### Veto Window (deciding to challenge)

**Regular teammates:**
- See "Challenge this placement?" with Yes/No options
- Vote sent as input for leader
- See own choice but not teammates'

**Team leader:**
- Sees teammates' veto votes in real-time: "Mike: Yes, Lisa: No"
- Leader's decision = whether team uses a veto token
- "Use Veto" / "Accept Placement" buttons — only leader can submit

### Veto Placement (if challenged)
- Same as regular placement — leader sees suggestions, makes final call

## Implementation Scope

### Backend (`packages/backend`)
- Add `isTeamLeader` to player model
- Add `leaderSelectionComplete` per team in game state
- Store teammate votes during quiz/veto for leader visibility
- New message handlers: `CLAIM_TEAM_LEADER`, `TEAMMATE_VOTE`, `LEADER_DECISION`
- Auto-assign logic on game start
- Reassign logic if leader disconnects

### Shared Types (`packages/shared`)
- Update `Player` interface with `isTeamLeader`
- New WebSocket message types
- New event types for leader-related broadcasts

### Player App (`apps/player`)
- New `PlayerStatusRow` component (always visible)
- "Be Team Leader" button in lobby
- Leader-only "Team Votes" panel during quiz
- Leader-only "Teammate Suggestions" during placement
- Leader-only veto decision UI

### Host App (`apps/host`)
- Show crown next to leader names in lobby roster
- Show crown on scoreboard/team displays during gameplay
- "Waiting for leader" indicator in lobby (optional)

## Out of Scope (YAGNI)
- Host ability to reassign leaders
- Multiple leaders per team
- Leader "stepping down" voluntarily mid-game
- Vote history/analytics
