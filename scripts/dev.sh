#!/bin/bash

# Party Popper - Local Development Script
# Starts all services: Worker (8787), Host (3000), Player (3001)

set -e

echo "Starting Party Popper development environment..."

# Cleanup function
cleanup() {
    echo "Shutting down services..."
    pkill -f "wrangler dev" 2>/dev/null || true
    pkill -f "vite.*3000" 2>/dev/null || true
    pkill -f "vite.*3001" 2>/dev/null || true
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

# Check if npm is available (pnpm may not be)
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
else
    echo "Error: Neither pnpm nor npm is installed."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    $PKG_MANAGER install
fi

# Create .env files if they don't exist
if [ ! -f "apps/host/.env" ]; then
    cp apps/host/.env.example apps/host/.env 2>/dev/null || echo "VITE_API_URL=http://localhost:8787" > apps/host/.env
fi

if [ ! -f "apps/player/.env" ]; then
    cp apps/player/.env.example apps/player/.env 2>/dev/null || echo "VITE_API_URL=http://localhost:8787" > apps/player/.env
fi

# Start backend Worker
echo "Starting Worker on http://localhost:8787..."
cd packages/backend && $PKG_MANAGER run dev &
WORKER_PID=$!
cd - > /dev/null

# Wait for Worker to be ready
sleep 3

# Start Host app
echo "Starting Host app on http://localhost:3000..."
cd apps/host && $PKG_MANAGER run dev &
HOST_PID=$!
cd - > /dev/null

# Start Player app
echo "Starting Player app on http://localhost:3001..."
cd apps/player && $PKG_MANAGER run dev &
PLAYER_PID=$!
cd - > /dev/null

echo ""
echo "============================================"
echo "Party Popper development environment ready!"
echo "============================================"
echo ""
echo "  Worker API:  http://localhost:8787"
echo "  Host App:    http://localhost:3000"
echo "  Player App:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all processes
wait
