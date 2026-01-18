#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE
API_URL="${VITE_API_URL:-https://party-popper-api.shahar-cohen.workers.dev}"
HOST_PROJECT="party-popper-host"
PLAYER_PROJECT="party-popper-player"

echo -e "${YELLOW}Party Popper Deployment Script${NC}"
echo "================================"
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler CLI not found${NC}"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Parse arguments
DEPLOY_BACKEND=false
DEPLOY_HOST=false
DEPLOY_PLAYER=false
DEPLOY_ALL=false

if [ $# -eq 0 ]; then
    DEPLOY_ALL=true
fi

for arg in "$@"; do
    case $arg in
        --backend)
            DEPLOY_BACKEND=true
            ;;
        --host)
            DEPLOY_HOST=true
            ;;
        --player)
            DEPLOY_PLAYER=true
            ;;
        --all)
            DEPLOY_ALL=true
            ;;
        --help)
            echo "Usage: ./scripts/deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend   Deploy only the backend Worker"
            echo "  --host      Deploy only the host frontend"
            echo "  --player    Deploy only the player frontend"
            echo "  --all       Deploy everything (default)"
            echo "  --help      Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  VITE_API_URL  Backend API URL (default: $API_URL)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            exit 1
            ;;
    esac
done

if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_BACKEND=true
    DEPLOY_HOST=true
    DEPLOY_PLAYER=true
fi

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install --frozen-lockfile

echo -e "${YELLOW}Running typecheck...${NC}"
pnpm typecheck

# Deploy backend
if [ "$DEPLOY_BACKEND" = true ]; then
    echo ""
    echo -e "${YELLOW}Deploying backend Worker...${NC}"
    cd packages/backend
    wrangler deploy
    cd "$PROJECT_ROOT"
    echo -e "${GREEN}✓ Backend deployed${NC}"
fi

# Deploy host
if [ "$DEPLOY_HOST" = true ]; then
    echo ""
    echo -e "${YELLOW}Building host app...${NC}"
    VITE_API_URL="$API_URL" pnpm --filter @party-popper/host build

    echo -e "${YELLOW}Deploying host to Cloudflare Pages...${NC}"
    wrangler pages deploy apps/host/dist --project-name="$HOST_PROJECT"
    echo -e "${GREEN}✓ Host deployed${NC}"
fi

# Deploy player
if [ "$DEPLOY_PLAYER" = true ]; then
    echo ""
    echo -e "${YELLOW}Building player app...${NC}"
    VITE_API_URL="$API_URL" pnpm --filter @party-popper/player build

    echo -e "${YELLOW}Deploying player to Cloudflare Pages...${NC}"
    wrangler pages deploy apps/player/dist --project-name="$PLAYER_PROJECT"
    echo -e "${GREEN}✓ Player deployed${NC}"
fi

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "URLs:"
[ "$DEPLOY_BACKEND" = true ] && echo "  Backend: https://party-popper-api.<your-subdomain>.workers.dev"
[ "$DEPLOY_HOST" = true ] && echo "  Host:    https://$HOST_PROJECT.pages.dev"
[ "$DEPLOY_PLAYER" = true ] && echo "  Player:  https://$PLAYER_PROJECT.pages.dev"
