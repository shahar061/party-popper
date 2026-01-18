#!/bin/bash
set -e

# Test base config exists with strict settings
test -f "tsconfig.base.json" || (echo "FAIL: tsconfig.base.json missing" && exit 1)
grep -q '"strict": true' tsconfig.base.json || (echo "FAIL: strict not enabled" && exit 1)

# Test each package has tsconfig extending base
for pkg in apps/host apps/player packages/shared packages/backend; do
  test -f "$pkg/tsconfig.json" || (echo "FAIL: $pkg/tsconfig.json missing" && exit 1)
  grep -q '"extends"' "$pkg/tsconfig.json" || (echo "FAIL: $pkg/tsconfig.json does not extend base" && exit 1)
done

echo "PASS: TypeScript configuration verified"
