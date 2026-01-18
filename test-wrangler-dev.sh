#!/bin/bash
set -e

cd packages/backend

# Test wrangler.toml has local dev settings
grep -q '\[dev\]' wrangler.toml || (echo "FAIL: [dev] section missing" && exit 1)
grep -q 'port' wrangler.toml || (echo "FAIL: dev port not configured" && exit 1)

# Test .dev.vars.example exists
test -f ".dev.vars.example" || (echo "FAIL: .dev.vars.example missing" && exit 1)

# Test that TypeScript still compiles after changes
npm run typecheck || (echo "FAIL: TypeScript compilation failed" && exit 1)

echo "PASS: Wrangler dev configuration verified"
