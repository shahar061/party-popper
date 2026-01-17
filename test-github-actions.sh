#!/bin/bash
set -e

# Test CI workflow exists
test -f ".github/workflows/ci.yml" || (echo "FAIL: .github/workflows/ci.yml missing" && exit 1)

# Test deploy workflow exists
test -f ".github/workflows/deploy.yml" || (echo "FAIL: .github/workflows/deploy.yml missing" && exit 1)

# Test CI has lint, typecheck, build jobs
grep -q "lint" .github/workflows/ci.yml || (echo "FAIL: lint not in CI workflow" && exit 1)
grep -q "typecheck" .github/workflows/ci.yml || (echo "FAIL: typecheck not in CI workflow" && exit 1)
grep -q "build" .github/workflows/ci.yml || (echo "FAIL: build not in CI workflow" && exit 1)

# Test deploy triggers on main
grep -q "main" .github/workflows/deploy.yml || (echo "FAIL: main branch trigger not in deploy workflow" && exit 1)

echo "PASS: GitHub Actions configured"
