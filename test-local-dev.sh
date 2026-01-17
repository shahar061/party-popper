#!/bin/bash
set -e

# Test dev:all script exists in root package.json
grep -q '"dev:all"' package.json || (echo "FAIL: dev:all script not in package.json" && exit 1)

# Test scripts/dev.sh exists
test -f "scripts/dev.sh" || (echo "FAIL: scripts/dev.sh missing" && exit 1)

# Test the script is executable (or can be run with bash)
test -r "scripts/dev.sh" || (echo "FAIL: scripts/dev.sh not readable" && exit 1)

echo "PASS: Local dev environment scripts configured"
