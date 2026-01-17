#!/bin/bash
set -e

cd packages/backend

# Test package.json exists
test -f "package.json" || (echo "FAIL: packages/backend/package.json missing" && exit 1)

# Test Worker entry point exists
test -f "src/index.ts" || (echo "FAIL: src/index.ts missing" && exit 1)

# Test Durable Object file exists
test -f "src/game.ts" || (echo "FAIL: src/game.ts missing" && exit 1)

# Test wrangler.toml exists with durable_objects binding
test -f "wrangler.toml" || (echo "FAIL: wrangler.toml missing" && exit 1)
grep -q "durable_objects" wrangler.toml || (echo "FAIL: durable_objects not in wrangler.toml" && exit 1)

# Test TypeScript compiles
npm run typecheck || (echo "FAIL: TypeScript compilation failed" && exit 1)

echo "PASS: Worker project configured"
