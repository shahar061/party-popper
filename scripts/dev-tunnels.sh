#!/bin/bash

# Dev Tunnels Script
# Starts Cloudflare tunnels for all services and updates .env files with the tunnel URLs

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST_ENV="$PROJECT_ROOT/apps/host/.env"
PLAYER_ENV="$PROJECT_ROOT/apps/player/.env"
WRANGLER_TOML="$PROJECT_ROOT/packages/backend/wrangler.toml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting dev tunnels...${NC}"

# Kill any existing cloudflared tunnels
echo -e "${YELLOW}Cleaning up existing tunnels...${NC}"
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

# Temp files to capture tunnel output
BACKEND_LOG=$(mktemp)
PLAYER_LOG=$(mktemp)

# Start backend tunnel (port 8787)
echo -e "${YELLOW}Starting backend tunnel (localhost:8787)...${NC}"
cloudflared tunnel --url http://localhost:8787 > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Start player tunnel (port 3001)
echo -e "${YELLOW}Starting player tunnel (localhost:3001)...${NC}"
cloudflared tunnel --url http://localhost:3001 > "$PLAYER_LOG" 2>&1 &
PLAYER_PID=$!

# Wait for URLs to appear in logs (max 30 seconds)
echo -e "${YELLOW}Waiting for tunnel URLs...${NC}"
BACKEND_URL=""
PLAYER_URL=""

for i in {1..30}; do
    if [[ -z "$BACKEND_URL" ]]; then
        BACKEND_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$BACKEND_LOG" 2>/dev/null | head -1 || true)
    fi
    if [[ -z "$PLAYER_URL" ]]; then
        PLAYER_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$PLAYER_LOG" 2>/dev/null | head -1 || true)
    fi

    if [[ -n "$BACKEND_URL" && -n "$PLAYER_URL" ]]; then
        break
    fi
    sleep 1
done

# Verify we got the URLs
if [[ -z "$BACKEND_URL" ]]; then
    echo -e "${RED}Failed to get backend tunnel URL${NC}"
    echo "Backend log:"
    cat "$BACKEND_LOG"
    exit 1
fi

if [[ -z "$PLAYER_URL" ]]; then
    echo -e "${RED}Failed to get player tunnel URL${NC}"
    echo "Player log:"
    cat "$PLAYER_LOG"
    exit 1
fi

echo -e "${GREEN}Backend tunnel: $BACKEND_URL${NC}"
echo -e "${GREEN}Player tunnel: $PLAYER_URL${NC}"

# Update host .env
echo -e "${YELLOW}Updating $HOST_ENV...${NC}"
cat > "$HOST_ENV" << EOF
VITE_API_URL=http://localhost:8787
# QR code URL for phone scanning - must be the Cloudflare tunnel URL
VITE_QR_BASE_URL=$BACKEND_URL
# Player app URL for join link/QR - must be the Cloudflare tunnel URL for mobile access
VITE_PLAYER_URL=$PLAYER_URL
EOF

# Update player .env - player needs tunnel URL for API so phone can reach backend
echo -e "${YELLOW}Updating $PLAYER_ENV...${NC}"
cat > "$PLAYER_ENV" << EOF
# Use tunnel URL so mobile devices can connect to backend
VITE_API_URL=$BACKEND_URL
EOF

# Update CORS in wrangler.toml
echo -e "${YELLOW}Updating CORS in $WRANGLER_TOML...${NC}"
NEW_ORIGINS="http://localhost:3000,http://localhost:3001,$PLAYER_URL"
sed -i '' "s|ALLOWED_ORIGINS = \".*\"|ALLOWED_ORIGINS = \"$NEW_ORIGINS\"|" "$WRANGLER_TOML"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Tunnels are running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Backend API: ${YELLOW}$BACKEND_URL${NC}"
echo -e "Player App:  ${YELLOW}$PLAYER_URL${NC}"
echo ""
echo -e "Host .env and Player .env have been updated."
echo -e "CORS origins in wrangler.toml have been updated."
echo ""
echo -e "${YELLOW}Now start your dev servers in separate terminals:${NC}"
echo -e "  pnpm dev:backend # Backend API (start first)"
echo -e "  pnpm dev:host    # Host app (TV display)"
echo -e "  pnpm dev:player  # Player app"
echo ""
echo -e "Press Ctrl+C to stop tunnels"

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping tunnels...${NC}"
    kill $BACKEND_PID $PLAYER_PID 2>/dev/null || true
    rm -f "$BACKEND_LOG" "$PLAYER_LOG"
    echo -e "${GREEN}Done${NC}"
}
trap cleanup EXIT

# Tail the logs so user can see tunnel activity
tail -f "$BACKEND_LOG" "$PLAYER_LOG" &
TAIL_PID=$!

# Wait for tunnels (or Ctrl+C)
wait $BACKEND_PID $PLAYER_PID
