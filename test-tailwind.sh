#!/bin/bash
set -e

# Test tailwind configs exist (using .cjs for ESM compatibility)
test -f "apps/host/tailwind.config.cjs" || (echo "FAIL: host tailwind.config.cjs missing" && exit 1)
test -f "apps/player/tailwind.config.cjs" || (echo "FAIL: player tailwind.config.cjs missing" && exit 1)

# Test shared preset exists
test -f "packages/shared/tailwind.preset.cjs" || (echo "FAIL: shared tailwind preset missing" && exit 1)

# Test CSS files exist with tailwind directives
grep -q "@tailwind" apps/host/src/index.css || (echo "FAIL: host index.css missing tailwind directives" && exit 1)
grep -q "@tailwind" apps/player/src/index.css || (echo "FAIL: player index.css missing tailwind directives" && exit 1)

# Test builds still work
cd apps/host && npm run build || (echo "FAIL: host build failed" && exit 1)
cd ../player && npm run build || (echo "FAIL: player build failed" && exit 1)

echo "PASS: Tailwind CSS configured"
