#!/bin/bash
set -e

cd apps/host

# Test package.json has vite and react
test -f "package.json" || (echo "FAIL: apps/host/package.json missing" && exit 1)
grep -q '"vite"' package.json || (echo "FAIL: vite not in dependencies" && exit 1)
grep -q '"react"' package.json || (echo "FAIL: react not in dependencies" && exit 1)

# Test vite.config.ts exists
test -f "vite.config.ts" || (echo "FAIL: vite.config.ts missing" && exit 1)

# Test can build
npm run build || (echo "FAIL: build failed" && exit 1)

echo "PASS: Host Vite setup verified"
