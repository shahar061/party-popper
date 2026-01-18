# P0 Fixes Design Document

## Overview

Three critical fixes needed before real play sessions:

1. **Quiz submission does nothing** - Player UI doesn't react to phase changes
2. **Placement confirmation** - Single tap instantly places, easy to misplace
3. **Server-side timeout enforcement** - Game stalls if host doesn't manually advance

## Fix 1: Handle `phase_changed` in Player App

### Problem
When player submits quiz answer, backend broadcasts `phase_changed` message but player app ignores it. The `gameState.currentRound.phase` stays as `'quiz'` so UI doesn't update.

### Solution
Add handler for `phase_changed` message in player's WebSocket message handler.

### Files Changed
- `apps/player/src/App.tsx`

### Implementation
Add case in `ws.onmessage` switch:

```typescript
case 'phase_changed': {
  const { phase, endsAt } = message.payload;
  setGameState(prev => {
    if (!prev || !prev.currentRound) return prev;
    return {
      ...prev,
      currentRound: {
        ...prev.currentRound,
        phase,
        endsAt,
      },
    };
  });
  break;
}
```

---

## Fix 2: Placement Confirmation

### Problem
In `TimelinePlacement.tsx`, tapping a slot immediately calls `onSelectPosition()` which submits the placement. Easy to accidentally misplace a song.

### Solution
Separate selection from submission:
1. Tap selects position (visual feedback only)
2. Show "Confirm Placement" button when position selected
3. Button click actually submits

### Files Changed
- `apps/player/src/components/TimelinePlacement.tsx`
- `apps/player/src/components/PlayingView.tsx`

### Implementation

**TimelinePlacement.tsx:**
- Add `onConfirm` prop for submission
- Keep `onSelectPosition` for selection only
- Add confirm button that appears when `selectedPosition !== null`

**PlayingView.tsx:**
- Keep selection as local state only
- Add confirm handler that calls the actual submit

---

## Fix 3: Server-side Timeout Enforcement

### Problem
Phases have timers (quiz: 45s, placement: 20s, etc.) but server doesn't enforce them. When time expires, nothing happens until host manually triggers "Next Round".

### Solution
Use Cloudflare Durable Object's `alarm()` API to schedule phase timeouts.

### Files Changed
- `packages/backend/src/game.ts`

### Implementation

1. **Set alarm when entering timed phase:**
   - In `transitionToPhase()`, after setting `endsAt`, schedule alarm: `this.ctx.storage.setAlarm(endsAt)`

2. **Handle alarm in `alarm()` method:**
   ```typescript
   async alarm(): Promise<void> {
     if (!this.state?.currentRound) return;

     const phase = this.state.currentRound.phase;

     switch (phase) {
       case 'quiz':
         // Timeout: no answer submitted, proceed without token
         await this.handleQuizTimeout();
         break;
       case 'placement':
         // Timeout: no placement, skip to veto window
         await this.handlePlacementTimeout();
         break;
       case 'veto_window':
         // Timeout: pass on veto
         await this.handleVetoTimeout();
         break;
       case 'veto_placement':
         // Timeout: veto team loses their chance
         await this.handleVetoPlacementTimeout();
         break;
     }
   }
   ```

3. **Cancel alarm when action taken:**
   - In `handleSubmitQuiz`, `handleSubmitPlacement`, etc., call `this.ctx.storage.deleteAlarm()`

### Timeout Behaviors

| Phase | Timeout Behavior |
|-------|------------------|
| `quiz` | Proceed to `placement`, no token earned, broadcast timeout message |
| `placement` | Proceed to `veto_window` with no placement (song won't be added) |
| `veto_window` | Auto-pass veto, proceed to `reveal` |
| `veto_placement` | Veto team loses chance, proceed to `reveal` |

---

## Testing Checklist

- [ ] Quiz: Submit answer → UI transitions to placement phase
- [ ] Quiz: Let timer expire → auto-advances to placement
- [ ] Placement: Tap position → shows confirm button, doesn't submit yet
- [ ] Placement: Tap confirm → submits placement
- [ ] Placement: Let timer expire → auto-advances to veto window
- [ ] Veto window: Let timer expire → auto-passes
- [ ] Veto placement: Let timer expire → auto-advances to reveal
