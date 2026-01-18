#!/bin/bash
set -e

# Test host wrangler.toml for Pages exists
test -f "apps/host/wrangler.toml" || (echo "FAIL: apps/host/wrangler.toml missing" && exit 1)
grep -q "pages_build_output_dir" apps/host/wrangler.toml || (echo "FAIL: pages_build_output_dir not in host wrangler.toml" && exit 1)

# Test player wrangler.toml for Pages exists
test -f "apps/player/wrangler.toml" || (echo "FAIL: apps/player/wrangler.toml missing" && exit 1)
grep -q "pages_build_output_dir" apps/player/wrangler.toml || (echo "FAIL: pages_build_output_dir not in player wrangler.toml" && exit 1)

# Test builds produce output
cd apps/host && npm run build && test -d "dist" || (echo "FAIL: host build does not produce dist" && exit 1)
cd ../player && npm run build && test -d "dist" || (echo "FAIL: player build does not produce dist" && exit 1)

echo "PASS: Cloudflare Pages configuration verified"
