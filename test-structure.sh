#!/bin/bash
set -e

# Test directory structure exists
test -d "apps/host" || (echo "FAIL: apps/host missing" && exit 1)
test -d "apps/player" || (echo "FAIL: apps/player missing" && exit 1)
test -d "packages/shared" || (echo "FAIL: packages/shared missing" && exit 1)
test -d "packages/backend" || (echo "FAIL: packages/backend missing" && exit 1)

# Test root package.json has workspaces
grep -q '"workspaces"' package.json || (echo "FAIL: workspaces not in package.json" && exit 1)

# Test pnpm-workspace.yaml exists
test -f "pnpm-workspace.yaml" || (echo "FAIL: pnpm-workspace.yaml missing" && exit 1)

echo "PASS: Monorepo structure verified"
