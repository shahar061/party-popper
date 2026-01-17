# Phase 1: Project Foundation - Implementation Spec

## Overview

This phase establishes the monorepo structure, tooling, and deployment pipeline for Party Popper. Upon completion, empty React apps will deploy to Cloudflare Pages, the Worker will deploy to Cloudflare Workers, and local development will work end-to-end.

---

## Task setup-001: Initialize monorepo structure

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/host/.gitkeep`
- Create: `apps/player/.gitkeep`
- Create: `packages/shared/.gitkeep`
- Create: `packages/backend/.gitkeep`

**Step 1: Write test script to verify structure**

Create a simple verification script:

```bash
# test-structure.sh
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
```

**Step 2: Run test to verify failure**

Run: `bash test-structure.sh`
Expected: FAIL with "apps/host missing"

**Step 3: Implement monorepo structure**

Create `package.json`:
```json
{
  "name": "party-popper",
  "version": "0.0.1",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "pnpm --parallel -r run dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Create directories:
```bash
mkdir -p apps/host apps/player packages/shared packages/backend
touch apps/host/.gitkeep apps/player/.gitkeep packages/shared/.gitkeep packages/backend/.gitkeep
```

**Step 4: Run test to verify pass**

Run: `bash test-structure.sh`
Expected: PASS: Monorepo structure verified

**Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml apps/ packages/ test-structure.sh
git commit -m "feat(setup): initialize monorepo structure with pnpm workspaces"
```

---

## Task setup-002: Configure TypeScript with shared tsconfig

**Files:**
- Create: `tsconfig.base.json`
- Create: `apps/host/tsconfig.json`
- Create: `apps/player/tsconfig.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/backend/tsconfig.json`

**Step 1: Write test script to verify TypeScript config**

```bash
# test-typescript.sh
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
```

**Step 2: Run test to verify failure**

Run: `bash test-typescript.sh`
Expected: FAIL with "tsconfig.base.json missing"

**Step 3: Implement TypeScript configuration**

Create `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

Create `apps/host/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/shared" }
  ]
}
```

Create `apps/player/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/shared" }
  ]
}
```

Create `packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `packages/backend/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/src/*"]
    }
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 4: Run test to verify pass**

Run: `bash test-typescript.sh`
Expected: PASS: TypeScript configuration verified

**Step 5: Commit**

```bash
git add tsconfig.base.json apps/*/tsconfig.json packages/*/tsconfig.json test-typescript.sh
git commit -m "feat(setup): configure TypeScript with strict settings and project references"
```

---

## Task setup-003: Set up Vite for host app with React 18

**Files:**
- Create: `apps/host/package.json`
- Create: `apps/host/vite.config.ts`
- Create: `apps/host/index.html`
- Create: `apps/host/src/main.tsx`
- Create: `apps/host/src/App.tsx`
- Create: `apps/host/src/vite-env.d.ts`

**Step 1: Write failing test**

```bash
# test-host-vite.sh
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
pnpm build || (echo "FAIL: build failed" && exit 1)

echo "PASS: Host Vite setup verified"
```

**Step 2: Run test to verify failure**

Run: `bash test-host-vite.sh`
Expected: FAIL with "apps/host/package.json missing"

**Step 3: Implement host app Vite setup**

Create `apps/host/package.json`:
```json
{
  "name": "@party-popper/host",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

Create `apps/host/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
```

Create `apps/host/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Party Popper - Host</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/host/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/host/src/App.tsx`:
```typescript
function App() {
  return (
    <div>
      <h1>Party Popper - Host Display</h1>
      <p>Host application is running.</p>
    </div>
  );
}

export default App;
```

Create `apps/host/src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

Install dependencies:
```bash
cd apps/host && pnpm install
```

**Step 4: Run test to verify pass**

Run: `bash test-host-vite.sh`
Expected: PASS: Host Vite setup verified

**Step 5: Commit**

```bash
git add apps/host/
git commit -m "feat(host): set up Vite with React 18 and TypeScript"
```

---

## Task setup-004: Set up Vite for player app with React 18

**Files:**
- Create: `apps/player/package.json`
- Create: `apps/player/vite.config.ts`
- Create: `apps/player/index.html`
- Create: `apps/player/src/main.tsx`
- Create: `apps/player/src/App.tsx`
- Create: `apps/player/src/vite-env.d.ts`

**Step 1: Write failing test**

```bash
# test-player-vite.sh
#!/bin/bash
set -e

cd apps/player

# Test package.json has vite and react
test -f "package.json" || (echo "FAIL: apps/player/package.json missing" && exit 1)
grep -q '"vite"' package.json || (echo "FAIL: vite not in dependencies" && exit 1)
grep -q '"react"' package.json || (echo "FAIL: react not in dependencies" && exit 1)

# Test vite.config.ts exists
test -f "vite.config.ts" || (echo "FAIL: vite.config.ts missing" && exit 1)

# Test can build
pnpm build || (echo "FAIL: build failed" && exit 1)

echo "PASS: Player Vite setup verified"
```

**Step 2: Run test to verify failure**

Run: `bash test-player-vite.sh`
Expected: FAIL with "apps/player/package.json missing"

**Step 3: Implement player app Vite setup**

Create `apps/player/package.json`:
```json
{
  "name": "@party-popper/player",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

Create `apps/player/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 3001,
  },
  build: {
    outDir: 'dist',
  },
});
```

Create `apps/player/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Party Popper - Player</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/player/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/player/src/App.tsx`:
```typescript
function App() {
  return (
    <div>
      <h1>Party Popper</h1>
      <p>Player application is running.</p>
    </div>
  );
}

export default App;
```

Create `apps/player/src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

Install dependencies:
```bash
cd apps/player && pnpm install
```

**Step 4: Run test to verify pass**

Run: `bash test-player-vite.sh`
Expected: PASS: Player Vite setup verified

**Step 5: Commit**

```bash
git add apps/player/
git commit -m "feat(player): set up Vite with React 18 and TypeScript"
```

---

## Task setup-005: Configure Tailwind CSS for host and player apps

**Files:**
- Create: `apps/host/tailwind.config.js`
- Create: `apps/host/postcss.config.js`
- Create: `apps/host/src/index.css`
- Modify: `apps/host/src/main.tsx`
- Create: `apps/player/tailwind.config.js`
- Create: `apps/player/postcss.config.js`
- Create: `apps/player/src/index.css`
- Modify: `apps/player/src/main.tsx`
- Create: `packages/shared/tailwind.preset.js`

**Step 1: Write failing test**

```bash
# test-tailwind.sh
#!/bin/bash
set -e

# Test tailwind configs exist
test -f "apps/host/tailwind.config.js" || (echo "FAIL: host tailwind.config.js missing" && exit 1)
test -f "apps/player/tailwind.config.js" || (echo "FAIL: player tailwind.config.js missing" && exit 1)

# Test shared preset exists
test -f "packages/shared/tailwind.preset.js" || (echo "FAIL: shared tailwind preset missing" && exit 1)

# Test CSS files exist with tailwind directives
grep -q "@tailwind" apps/host/src/index.css || (echo "FAIL: host index.css missing tailwind directives" && exit 1)
grep -q "@tailwind" apps/player/src/index.css || (echo "FAIL: player index.css missing tailwind directives" && exit 1)

# Test builds still work
cd apps/host && pnpm build || (echo "FAIL: host build failed" && exit 1)
cd ../player && pnpm build || (echo "FAIL: player build failed" && exit 1)

echo "PASS: Tailwind CSS configured"
```

**Step 2: Run test to verify failure**

Run: `bash test-tailwind.sh`
Expected: FAIL with "host tailwind.config.js missing"

**Step 3: Implement Tailwind configuration**

Create `packages/shared/tailwind.preset.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Team colors
        'team-a': {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        'team-b': {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Game UI colors
        'game': {
          bg: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          text: '#f8fafc',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // TV-optimized sizes (readable from 3m)
        'tv-sm': ['1.5rem', { lineHeight: '2rem' }],
        'tv-base': ['2rem', { lineHeight: '2.5rem' }],
        'tv-lg': ['2.5rem', { lineHeight: '3rem' }],
        'tv-xl': ['3rem', { lineHeight: '3.5rem' }],
        'tv-2xl': ['4rem', { lineHeight: '4.5rem' }],
        'tv-code': ['5rem', { lineHeight: '5.5rem', letterSpacing: '0.25em' }],
      },
    },
  },
};
```

Create `apps/host/tailwind.config.js`:
```javascript
const sharedPreset = require('../../packages/shared/tailwind.preset.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [sharedPreset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Create `apps/host/postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `apps/host/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-game-bg text-game-text;
}
```

Modify `apps/host/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Modify `apps/host/src/App.tsx` to use Tailwind:
```typescript
function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-tv-xl font-bold mb-4">Party Popper</h1>
        <p className="text-tv-base text-game-muted">Host Display</p>
      </div>
    </div>
  );
}

export default App;
```

Update `apps/host/package.json` devDependencies:
```json
{
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

Create `apps/player/tailwind.config.js`:
```javascript
const sharedPreset = require('../../packages/shared/tailwind.preset.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [sharedPreset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Create `apps/player/postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `apps/player/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-game-bg text-game-text;
}
```

Modify `apps/player/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Modify `apps/player/src/App.tsx` to use Tailwind:
```typescript
function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Party Popper</h1>
        <p className="text-game-muted">Player App</p>
      </div>
    </div>
  );
}

export default App;
```

Update `apps/player/package.json` devDependencies:
```json
{
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

Install dependencies:
```bash
cd apps/host && pnpm install
cd ../player && pnpm install
```

**Step 4: Run test to verify pass**

Run: `bash test-tailwind.sh`
Expected: PASS: Tailwind CSS configured

**Step 5: Commit**

```bash
git add apps/host/tailwind.config.js apps/host/postcss.config.js apps/host/src/index.css apps/host/src/main.tsx apps/host/src/App.tsx apps/host/package.json
git add apps/player/tailwind.config.js apps/player/postcss.config.js apps/player/src/index.css apps/player/src/main.tsx apps/player/src/App.tsx apps/player/package.json
git add packages/shared/tailwind.preset.js
git commit -m "feat(ui): configure Tailwind CSS with shared theme preset"
```

---

## Task setup-006: Create Cloudflare Worker project with Durable Object stub

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/backend/src/index.ts`
- Create: `packages/backend/src/game.ts`
- Create: `packages/backend/wrangler.toml`

**Step 1: Write failing test**

```bash
# test-worker.sh
#!/bin/bash
set -e

cd packages/backend

# Test package.json exists
test -f "package.json" || (echo "FAIL: packages/backend/package.json missing" && exit 1)

# Test Worker entry point exists
test -f "src/index.ts" || (echo "FAIL: src/index.ts missing" && exit 1)

# Test Durable Object file exists
test -f "src/game.ts" || (echo "FAIL: src/game.ts missing" && exit 1)

# Test wrangler.toml exists with durable_objects binding
test -f "wrangler.toml" || (echo "FAIL: wrangler.toml missing" && exit 1)
grep -q "durable_objects" wrangler.toml || (echo "FAIL: durable_objects not in wrangler.toml" && exit 1)

# Test TypeScript compiles
pnpm typecheck || (echo "FAIL: TypeScript compilation failed" && exit 1)

echo "PASS: Worker project configured"
```

**Step 2: Run test to verify failure**

Run: `bash test-worker.sh`
Expected: FAIL with "packages/backend/package.json missing"

**Step 3: Implement Worker project**

Create `packages/backend/package.json`:
```json
{
  "name": "@party-popper/backend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts"
  },
  "dependencies": {},
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20231218.0",
    "typescript": "^5.3.0",
    "wrangler": "^3.22.0"
  }
}
```

Create `packages/backend/src/index.ts`:
```typescript
import { GameDO } from './game';

export interface Env {
  GAME: DurableObjectNamespace;
}

export { GameDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (path === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Game routes will be added in Phase 2
    if (path.startsWith('/api/games')) {
      return new Response(JSON.stringify({ message: 'Games API coming soon' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

Create `packages/backend/src/game.ts`:
```typescript
import { DurableObject } from 'cloudflare:workers';

export interface Env {
  GAME: DurableObjectNamespace;
}

export class GameDO extends DurableObject {
  private connections: Set<WebSocket> = new Set();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.connections.add(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // HTTP endpoints for game info
    if (url.pathname === '/info') {
      return new Response(JSON.stringify({
        connections: this.connections.size,
        status: 'stub',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Message handling will be implemented in Phase 2
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
    console.log('Received message:', data);

    // Echo back for now (stub behavior)
    ws.send(JSON.stringify({ type: 'echo', data }));
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.connections.delete(ws);
    console.log(`WebSocket closed: ${code} ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    this.connections.delete(ws);
  }
}
```

Create `packages/backend/wrangler.toml`:
```toml
name = "party-popper-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "GAME", class_name = "GameDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["GameDO"]

[dev]
port = 8787
local_protocol = "http"
```

Install dependencies:
```bash
cd packages/backend && pnpm install
```

**Step 4: Run test to verify pass**

Run: `bash test-worker.sh`
Expected: PASS: Worker project configured

**Step 5: Commit**

```bash
git add packages/backend/
git commit -m "feat(backend): create Cloudflare Worker with Durable Object stub"
```

---

## Task setup-007: Set up Wrangler configuration for local development

**Files:**
- Modify: `packages/backend/wrangler.toml`
- Create: `packages/backend/.dev.vars.example`

**Step 1: Write failing test**

```bash
# test-wrangler-dev.sh
#!/bin/bash
set -e

cd packages/backend

# Test wrangler.toml has local dev settings
grep -q '\[dev\]' wrangler.toml || (echo "FAIL: [dev] section missing" && exit 1)
grep -q 'port' wrangler.toml || (echo "FAIL: dev port not configured" && exit 1)

# Test .dev.vars.example exists
test -f ".dev.vars.example" || (echo "FAIL: .dev.vars.example missing" && exit 1)

# Test wrangler dev can start (run for 3 seconds then kill)
timeout 5 pnpm dev &
DEV_PID=$!
sleep 3

# Check if process is running
if kill -0 $DEV_PID 2>/dev/null; then
  kill $DEV_PID 2>/dev/null || true
  echo "PASS: Wrangler dev starts successfully"
else
  echo "FAIL: Wrangler dev failed to start"
  exit 1
fi
```

**Step 2: Run test to verify failure**

Run: `bash test-wrangler-dev.sh`
Expected: FAIL with ".dev.vars.example missing"

**Step 3: Implement Wrangler local dev configuration**

Modify `packages/backend/wrangler.toml`:
```toml
name = "party-popper-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "GAME", class_name = "GameDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["GameDO"]

[dev]
port = 8787
local_protocol = "http"
ip = "0.0.0.0"

# Environment variables
[vars]
ENVIRONMENT = "development"

# CORS origins for local development
# In production, these would be the actual Cloudflare Pages URLs
ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3001"
```

Create `packages/backend/.dev.vars.example`:
```
# Copy this file to .dev.vars for local development
# These values are for local development only

# No secrets required for MVP
# Add any future secrets here:
# SPOTIFY_CLIENT_ID=your_client_id
# SPOTIFY_CLIENT_SECRET=your_client_secret
```

Update `packages/backend/src/index.ts` to use CORS configuration:
```typescript
import { GameDO } from './game';

export interface Env {
  GAME: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  ENVIRONMENT: string;
}

export { GameDO };

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || [];

  // In development, allow all origins
  if (env.ENVIRONMENT === 'development' || allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  return {};
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = getCorsHeaders(request, env);

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (path === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', environment: env.ENVIRONMENT }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Game routes will be added in Phase 2
    if (path.startsWith('/api/games')) {
      return new Response(JSON.stringify({ message: 'Games API coming soon' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

**Step 4: Run test to verify pass**

Run: `bash test-wrangler-dev.sh`
Expected: PASS: Wrangler dev starts successfully

**Step 5: Commit**

```bash
git add packages/backend/wrangler.toml packages/backend/.dev.vars.example packages/backend/src/index.ts
git commit -m "feat(backend): configure Wrangler for local development with CORS"
```

---

## Task setup-008: Create shared types package with core TypeScript interfaces

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/messages.ts`

**Step 1: Write failing test**

```bash
# test-shared-types.sh
#!/bin/bash
set -e

cd packages/shared

# Test package.json exists
test -f "package.json" || (echo "FAIL: packages/shared/package.json missing" && exit 1)

# Test types file exists
test -f "src/types.ts" || (echo "FAIL: src/types.ts missing" && exit 1)

# Test exports GameState, Player, Team, Song interfaces
grep -q "export interface GameState" src/types.ts || (echo "FAIL: GameState not exported" && exit 1)
grep -q "export interface Player" src/types.ts || (echo "FAIL: Player not exported" && exit 1)
grep -q "export interface Team" src/types.ts || (echo "FAIL: Team not exported" && exit 1)
grep -q "export interface Song" src/types.ts || (echo "FAIL: Song not exported" && exit 1)

# Test messages file exists
test -f "src/messages.ts" || (echo "FAIL: src/messages.ts missing" && exit 1)

# Test TypeScript compiles
pnpm typecheck || (echo "FAIL: TypeScript compilation failed" && exit 1)

echo "PASS: Shared types package configured"
```

**Step 2: Run test to verify failure**

Run: `bash test-shared-types.sh`
Expected: FAIL with "packages/shared/package.json missing"

**Step 3: Implement shared types package**

Create `packages/shared/package.json`:
```json
{
  "name": "@party-popper/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./messages": "./src/messages.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

Create `packages/shared/src/types.ts`:
```typescript
/**
 * Core game state - stored in Durable Object
 */
export interface GameState {
  id: string;
  joinCode: string;
  status: GameStatus;
  mode: GameMode;
  settings: GameSettings;
  teams: {
    A: Team;
    B: Team;
  };
  currentRound: Round | null;
  songPool: Song[];
  playedSongs: Song[];
  createdAt: number;
  lastActivityAt: number;
}

export type GameStatus = 'lobby' | 'playing' | 'finished';
export type GameMode = 'classic' | 'custom';

export interface GameSettings {
  targetScore: number;
  roundTimeSeconds: number;
  vetoWindowSeconds: number;
}

export interface Team {
  name: string;
  players: Player[];
  timeline: TimelineSong[];
  vetoTokens: number;
  score: number;
}

export interface Player {
  id: string;
  sessionId: string;
  name: string;
  team: 'A' | 'B';
  connected: boolean;
  lastSeen: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  spotifyUri: string;
  spotifyUrl: string;
}

export interface TimelineSong extends Song {
  addedAt: number;
  pointsEarned: number;
}

export interface Round {
  number: number;
  song: Song;
  activeTeam: 'A' | 'B';
  phase: RoundPhase;
  startedAt: number;
  endsAt: number;
  currentAnswer: Answer | null;
  typingState: TypingState | null;
  vetoChallenge: VetoChallenge | null;
}

export type RoundPhase = 'guessing' | 'veto_window' | 'reveal';

export interface Answer {
  artist: string;
  title: string;
  year: number;
  submittedBy: string;
  submittedAt: number;
}

export interface TypingState {
  artist: string;
  title: string;
  year: string;
  lastUpdatedBy: string;
  lastUpdatedAt: number;
}

export interface VetoChallenge {
  challengingTeam: 'A' | 'B';
  initiatedBy: string;
  initiatedAt: number;
}

export interface RoundResult {
  song: Song;
  answer: Answer | null;
  scoring: ScoringResult;
  vetoResult: VetoResult | null;
}

export interface ScoringResult {
  artistCorrect: boolean;
  titleCorrect: boolean;
  yearCorrect: boolean;
  yearDiff: number;
  totalPoints: number;
  addedToTimeline: boolean;
}

export interface VetoResult {
  success: boolean;
  stealAttempt: Answer | null;
  stealSuccess: boolean;
}

/**
 * Default game settings
 */
export const DEFAULT_SETTINGS: GameSettings = {
  targetScore: 10,
  roundTimeSeconds: 60,
  vetoWindowSeconds: 15,
};

/**
 * Game constants
 */
export const GAME_CONSTANTS = {
  MAX_PLAYERS_PER_TEAM: 5,
  MIN_PLAYERS_PER_TEAM: 1,
  INITIAL_VETO_TOKENS: 3,
  RECONNECTION_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  JOIN_CODE_LENGTH: 4,
} as const;
```

Create `packages/shared/src/messages.ts`:
```typescript
import type { GameState, Player, Round, Answer, TypingState, RoundResult, GameSettings } from './types';

/**
 * Client -> Server messages
 */
export type ClientMessage =
  | JoinMessage
  | ReconnectMessage
  | StartGameMessage
  | SubmitAnswerMessage
  | TypingMessage
  | UseVetoMessage
  | NextRoundMessage
  | ReassignTeamMessage
  | UpdateSettingsMessage
  | PongMessage;

export interface JoinMessage {
  type: 'join';
  payload: {
    playerName: string;
    team?: 'A' | 'B';
  };
}

export interface ReconnectMessage {
  type: 'reconnect';
  payload: {
    sessionId: string;
  };
}

export interface StartGameMessage {
  type: 'start_game';
}

export interface SubmitAnswerMessage {
  type: 'submit_answer';
  payload: {
    artist: string;
    title: string;
    year: number;
  };
}

export interface TypingMessage {
  type: 'typing';
  payload: {
    field: 'artist' | 'title' | 'year';
    value: string;
  };
}

export interface UseVetoMessage {
  type: 'use_veto';
}

export interface NextRoundMessage {
  type: 'next_round';
}

export interface ReassignTeamMessage {
  type: 'reassign_team';
  payload: {
    playerId: string;
    team: 'A' | 'B';
  };
}

export interface UpdateSettingsMessage {
  type: 'update_settings';
  payload: Partial<GameSettings>;
}

export interface PongMessage {
  type: 'pong';
}

/**
 * Server -> Client messages
 */
export type ServerMessage =
  | StateSyncMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerReconnectedMessage
  | TeamChangedMessage
  | SettingsUpdatedMessage
  | RoundStartedMessage
  | TypingUpdateMessage
  | AnswerSubmittedMessage
  | VetoInitiatedMessage
  | RoundResultMessage
  | GameOverMessage
  | ErrorMessage
  | PingMessage;

export interface StateSyncMessage {
  type: 'state_sync';
  payload: {
    gameState: GameState;
    playerId: string;
    sessionId: string;
  };
}

export interface PlayerJoinedMessage {
  type: 'player_joined';
  payload: {
    player: Player;
  };
}

export interface PlayerLeftMessage {
  type: 'player_left';
  payload: {
    playerId: string;
  };
}

export interface PlayerReconnectedMessage {
  type: 'player_reconnected';
  payload: {
    player: Player;
  };
}

export interface TeamChangedMessage {
  type: 'team_changed';
  payload: {
    playerId: string;
    fromTeam: 'A' | 'B';
    toTeam: 'A' | 'B';
  };
}

export interface SettingsUpdatedMessage {
  type: 'settings_updated';
  payload: {
    settings: GameSettings;
  };
}

export interface RoundStartedMessage {
  type: 'round_started';
  payload: {
    round: Round;
  };
}

export interface TypingUpdateMessage {
  type: 'typing_update';
  payload: {
    typingState: TypingState;
  };
}

export interface AnswerSubmittedMessage {
  type: 'answer_submitted';
  payload: {
    answer: Answer;
  };
}

export interface VetoInitiatedMessage {
  type: 'veto_initiated';
  payload: {
    team: 'A' | 'B';
    playerId: string;
  };
}

export interface RoundResultMessage {
  type: 'round_result';
  payload: {
    result: RoundResult;
    updatedTeams: {
      A: { score: number; vetoTokens: number };
      B: { score: number; vetoTokens: number };
    };
  };
}

export interface GameOverMessage {
  type: 'game_over';
  payload: {
    winner: 'A' | 'B' | 'tie';
    finalState: GameState;
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    code: ErrorCode;
    message: string;
  };
}

export interface PingMessage {
  type: 'ping';
  payload: {
    timestamp: number;
  };
}

export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'NOT_AUTHORIZED'
  | 'GAME_NOT_FOUND'
  | 'GAME_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'NOT_YOUR_TURN'
  | 'INVALID_ANSWER'
  | 'NO_VETO_TOKENS'
  | 'VETO_WINDOW_CLOSED'
  | 'RECONNECTION_EXPIRED'
  | 'PLAYER_NAME_TAKEN';

/**
 * Type guard helpers
 */
export function isClientMessage(msg: unknown): msg is ClientMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as { type: unknown }).type === 'string'
  );
}

export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (isClientMessage(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
```

Create `packages/shared/src/index.ts`:
```typescript
// Re-export all types
export * from './types';
export * from './messages';
```

Install dependencies:
```bash
cd packages/shared && pnpm install
```

**Step 4: Run test to verify pass**

Run: `bash test-shared-types.sh`
Expected: PASS: Shared types package configured

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): create shared types package with GameState, Player, Team, Song interfaces"
```

---

## Task setup-009: Configure Cloudflare Pages deployment for frontends

**Files:**
- Create: `apps/host/wrangler.toml`
- Create: `apps/player/wrangler.toml`

**Step 1: Write failing test**

```bash
# test-pages-config.sh
#!/bin/bash
set -e

# Test host wrangler.toml for Pages exists
test -f "apps/host/wrangler.toml" || (echo "FAIL: apps/host/wrangler.toml missing" && exit 1)
grep -q "pages_build_output_dir" apps/host/wrangler.toml || (echo "FAIL: pages_build_output_dir not in host wrangler.toml" && exit 1)

# Test player wrangler.toml for Pages exists
test -f "apps/player/wrangler.toml" || (echo "FAIL: apps/player/wrangler.toml missing" && exit 1)
grep -q "pages_build_output_dir" apps/player/wrangler.toml || (echo "FAIL: pages_build_output_dir not in player wrangler.toml" && exit 1)

# Test builds produce output
cd apps/host && pnpm build && test -d "dist" || (echo "FAIL: host build does not produce dist" && exit 1)
cd ../player && pnpm build && test -d "dist" || (echo "FAIL: player build does not produce dist" && exit 1)

echo "PASS: Cloudflare Pages configuration verified"
```

**Step 2: Run test to verify failure**

Run: `bash test-pages-config.sh`
Expected: FAIL with "apps/host/wrangler.toml missing"

**Step 3: Implement Cloudflare Pages configuration**

Create `apps/host/wrangler.toml`:
```toml
name = "party-popper-host"
pages_build_output_dir = "dist"
compatibility_date = "2024-01-01"

[env.production]
vars = { VITE_API_URL = "https://party-popper-api.workers.dev" }

[env.preview]
vars = { VITE_API_URL = "https://party-popper-api.workers.dev" }
```

Create `apps/player/wrangler.toml`:
```toml
name = "party-popper-player"
pages_build_output_dir = "dist"
compatibility_date = "2024-01-01"

[env.production]
vars = { VITE_API_URL = "https://party-popper-api.workers.dev" }

[env.preview]
vars = { VITE_API_URL = "https://party-popper-api.workers.dev" }
```

Add environment type declarations to both apps.

Update `apps/host/src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Update `apps/player/src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Create `.env.example` files for local development:

Create `apps/host/.env.example`:
```
VITE_API_URL=http://localhost:8787
```

Create `apps/player/.env.example`:
```
VITE_API_URL=http://localhost:8787
```

**Step 4: Run test to verify pass**

Run: `bash test-pages-config.sh`
Expected: PASS: Cloudflare Pages configuration verified

**Step 5: Commit**

```bash
git add apps/host/wrangler.toml apps/host/src/vite-env.d.ts apps/host/.env.example
git add apps/player/wrangler.toml apps/player/src/vite-env.d.ts apps/player/.env.example
git commit -m "feat(deploy): configure Cloudflare Pages for host and player apps"
```

---

## Task setup-010: Set up GitHub Actions CI/CD pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

**Step 1: Write failing test**

```bash
# test-github-actions.sh
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
```

**Step 2: Run test to verify failure**

Run: `bash test-github-actions.sh`
Expected: FAIL with ".github/workflows/ci.yml missing"

**Step 3: Implement GitHub Actions workflows**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint
        continue-on-error: true  # Lint is advisory for now

  build:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Upload host build artifact
        uses: actions/upload-artifact@v4
        with:
          name: host-dist
          path: apps/host/dist

      - name: Upload player build artifact
        uses: actions/upload-artifact@v4
        with:
          name: player-dist
          path: apps/player/dist
```

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-worker:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: packages/backend

  deploy-host:
    runs-on: ubuntu-latest
    needs: deploy-worker
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build host app
        run: pnpm --filter @party-popper/host build
        env:
          VITE_API_URL: https://party-popper-api.workers.dev

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy apps/host/dist --project-name=party-popper-host

  deploy-player:
    runs-on: ubuntu-latest
    needs: deploy-worker
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build player app
        run: pnpm --filter @party-popper/player build
        env:
          VITE_API_URL: https://party-popper-api.workers.dev

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy apps/player/dist --project-name=party-popper-player
```

Create the directories:
```bash
mkdir -p .github/workflows
```

**Step 4: Run test to verify pass**

Run: `bash test-github-actions.sh`
Expected: PASS: GitHub Actions configured

**Step 5: Commit**

```bash
git add .github/
git commit -m "feat(ci): set up GitHub Actions for CI/CD with Cloudflare deployment"
```

---

## Task setup-011: Verify local dev environment with Worker and both frontends

**Files:**
- Modify: `package.json` (add dev:all script)
- Create: `scripts/dev.sh`

**Step 1: Write failing test**

```bash
# test-local-dev.sh
#!/bin/bash
set -e

# Test dev:all script exists in root package.json
grep -q '"dev:all"' package.json || (echo "FAIL: dev:all script not in package.json" && exit 1)

# Test scripts/dev.sh exists
test -f "scripts/dev.sh" || (echo "FAIL: scripts/dev.sh missing" && exit 1)

# Start all services in background
bash scripts/dev.sh &
DEV_PID=$!
sleep 10

# Test Worker health endpoint
curl -s http://localhost:8787/api/health | grep -q "ok" || (echo "FAIL: Worker health check failed" && exit 1)

# Test Host app is running
curl -s http://localhost:3000 | grep -q "Party Popper" || (echo "FAIL: Host app not responding" && exit 1)

# Test Player app is running
curl -s http://localhost:3001 | grep -q "Party Popper" || (echo "FAIL: Player app not responding" && exit 1)

# Cleanup
kill $DEV_PID 2>/dev/null || true
pkill -f "wrangler dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "PASS: Local dev environment working"
```

**Step 2: Run test to verify failure**

Run: `bash test-local-dev.sh`
Expected: FAIL with "dev:all script not in package.json"

**Step 3: Implement local dev orchestration**

Update `package.json`:
```json
{
  "name": "party-popper",
  "version": "0.0.1",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "pnpm --parallel -r run dev",
    "dev:all": "bash scripts/dev.sh",
    "dev:host": "pnpm --filter @party-popper/host dev",
    "dev:player": "pnpm --filter @party-popper/player dev",
    "dev:backend": "pnpm --filter @party-popper/backend dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

Create `scripts/dev.sh`:
```bash
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

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed. Please install pnpm first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
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
cd packages/backend && pnpm dev &
WORKER_PID=$!
cd - > /dev/null

# Wait for Worker to be ready
sleep 3

# Start Host app
echo "Starting Host app on http://localhost:3000..."
cd apps/host && pnpm dev &
HOST_PID=$!
cd - > /dev/null

# Start Player app
echo "Starting Player app on http://localhost:3001..."
cd apps/player && pnpm dev &
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
```

Make the script executable:
```bash
chmod +x scripts/dev.sh
```

**Step 4: Run test to verify pass**

Run: `bash test-local-dev.sh`
Expected: PASS: Local dev environment working

**Step 5: Commit**

```bash
git add package.json scripts/
git commit -m "feat(dev): add local development script for running all services"
```

---

## Summary

Phase 1 establishes the complete project foundation:

| Task | Description | Key Files |
|------|-------------|-----------|
| setup-001 | Monorepo structure | `package.json`, `pnpm-workspace.yaml` |
| setup-002 | TypeScript configuration | `tsconfig.base.json`, per-package configs |
| setup-003 | Host app with Vite + React | `apps/host/*` |
| setup-004 | Player app with Vite + React | `apps/player/*` |
| setup-005 | Tailwind CSS | `tailwind.config.js`, shared preset |
| setup-006 | Cloudflare Worker + DO | `packages/backend/*` |
| setup-007 | Wrangler local dev | `wrangler.toml` |
| setup-008 | Shared types | `packages/shared/*` |
| setup-009 | Cloudflare Pages | App `wrangler.toml` files |
| setup-010 | GitHub Actions | `.github/workflows/*` |
| setup-011 | Local dev environment | `scripts/dev.sh` |

**Milestone verification**: After completing all tasks, run `bash scripts/dev.sh` and verify:
1. Worker responds at `http://localhost:8787/api/health`
2. Host app loads at `http://localhost:3000`
3. Player app loads at `http://localhost:3001`
4. No CORS errors in browser console
