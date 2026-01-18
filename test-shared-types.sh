#!/bin/bash
set -e

cd packages/shared

# Test package.json exists
test -f "package.json" || (echo "FAIL: packages/shared/package.json missing" && exit 1)

# Test types file exists
test -f "src/types.ts" || (echo "FAIL: src/types.ts missing" && exit 1)

# Test exports GameState, Player, Team, Song interfaces
grep -q "export interface GameState" src/types.ts || (echo "FAIL: GameState not exported" && exit 1)
grep -q "export interface Player" src/types.ts || (echo "FAIL: Player not exported" && exit 1)
grep -q "export interface Team" src/types.ts || (echo "FAIL: Team not exported" && exit 1)
grep -q "export interface Song" src/types.ts || (echo "FAIL: Song not exported" && exit 1)

# Test messages file exists
test -f "src/messages.ts" || (echo "FAIL: src/messages.ts missing" && exit 1)

# Test TypeScript compiles
npm run typecheck || (echo "FAIL: TypeScript compilation failed" && exit 1)

echo "PASS: Shared types package configured"
