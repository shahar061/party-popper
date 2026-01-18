// packages/backend/src/__tests__/integration/gameplay-loop.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';

// NOTE: These integration tests require full backend WebSocket implementation
// including API endpoints returning wsUrl and full message routing.
// They are skipped until Phase 6 (Integration & Polish) completes the backend.
describe.skip('Full Gameplay Loop Integration', () => {
  let worker: Unstable_DevWorker;

  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterEach(async () => {
    await worker.stop();
  });

  it('should complete a full game: create, join, play rounds, win', async () => {
    // Step 1: Create game
    const createRes = await worker.fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic', targetScore: 2 })
    });
    const { joinCode, wsUrl } = await createRes.json() as { joinCode: string; wsUrl: string };
    expect(joinCode).toMatch(/^[A-Z0-9]{4}$/);

    // Step 2: Connect host via WebSocket
    const hostWs = new WebSocket(wsUrl);
    await waitForOpen(hostWs);

    const hostMessages: any[] = [];
    hostWs.onmessage = (e) => hostMessages.push(JSON.parse(e.data));

    // Step 3: Join players
    const player1Ws = await connectPlayer(wsUrl, 'Player 1', 'A');
    const player2Ws = await connectPlayer(wsUrl, 'Player 2', 'B');

    // Wait for join confirmations
    await waitForMessage(hostMessages, 'player_joined');
    await waitForMessage(hostMessages, 'player_joined');

    // Step 4: Start game
    hostWs.send(JSON.stringify({ type: 'start_game' }));
    await waitForMessage(hostMessages, 'round_started');

    // Step 5: Team A submits answer
    player1Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }
    }));

    const roundResult1 = await waitForMessage(hostMessages, 'round_result');
    expect(roundResult1.payload.score).toBeGreaterThan(0);

    // Step 6: Next round, Team B's turn
    hostWs.send(JSON.stringify({ type: 'next_round' }));
    await waitForMessage(hostMessages, 'round_started');

    // Step 7: Team B submits answer
    player2Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'a-ha', title: 'Take On Me', year: 1985 }
    }));

    await waitForMessage(hostMessages, 'round_result');

    // Step 8: Continue until someone wins
    hostWs.send(JSON.stringify({ type: 'next_round' }));
    await waitForMessage(hostMessages, 'round_started');

    player1Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Michael Jackson', title: 'Thriller', year: 1982 }
    }));

    // Step 9: Check for game over
    const gameOver = await waitForMessage(hostMessages, 'game_over', 5000);
    expect(gameOver.payload.winner).toBe('A');

    // Cleanup
    hostWs.close();
    player1Ws.close();
    player2Ws.close();
  });

  it('should handle turn rotation correctly', async () => {
    const createRes = await worker.fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic', targetScore: 5 })
    });
    const { wsUrl } = await createRes.json() as { wsUrl: string };

    const hostWs = new WebSocket(wsUrl);
    await waitForOpen(hostWs);

    const messages: any[] = [];
    hostWs.onmessage = (e) => messages.push(JSON.parse(e.data));

    const player1Ws = await connectPlayer(wsUrl, 'P1', 'A');
    const player2Ws = await connectPlayer(wsUrl, 'P2', 'B');

    await waitForMessage(messages, 'player_joined');
    await waitForMessage(messages, 'player_joined');

    hostWs.send(JSON.stringify({ type: 'start_game' }));

    const round1 = await waitForMessage(messages, 'round_started');
    expect(round1.payload.activeTeam).toBe('A');

    // Submit and go to next round
    player1Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Test', title: 'Test', year: 2000 }
    }));
    await waitForMessage(messages, 'round_result');

    hostWs.send(JSON.stringify({ type: 'next_round' }));

    const round2 = await waitForMessage(messages, 'round_started');
    expect(round2.payload.activeTeam).toBe('B');

    hostWs.close();
    player1Ws.close();
    player2Ws.close();
  });

  it('should reject answer from wrong team', async () => {
    const createRes = await worker.fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'classic', targetScore: 5 })
    });
    const { wsUrl } = await createRes.json() as { wsUrl: string };

    const hostWs = new WebSocket(wsUrl);
    await waitForOpen(hostWs);

    const messages: any[] = [];
    hostWs.onmessage = (e) => messages.push(JSON.parse(e.data));

    const player1Ws = await connectPlayer(wsUrl, 'P1', 'A');
    const player2Ws = await connectPlayer(wsUrl, 'P2', 'B');

    await waitForMessage(messages, 'player_joined');
    await waitForMessage(messages, 'player_joined');

    hostWs.send(JSON.stringify({ type: 'start_game' }));
    await waitForMessage(messages, 'round_started');

    // Team B tries to submit during Team A's turn
    const player2Messages: any[] = [];
    player2Ws.onmessage = (e) => player2Messages.push(JSON.parse(e.data));

    player2Ws.send(JSON.stringify({
      type: 'submit_answer',
      payload: { artist: 'Test', title: 'Test', year: 2000 }
    }));

    const error = await waitForMessage(player2Messages, 'error');
    expect(error.payload.code).toBe('NOT_YOUR_TURN');

    hostWs.close();
    player1Ws.close();
    player2Ws.close();
  });
});

// Helper functions
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
    } else {
      ws.onopen = () => resolve();
    }
  });
}

async function connectPlayer(wsUrl: string, name: string, team: 'A' | 'B'): Promise<WebSocket> {
  const ws = new WebSocket(wsUrl);
  await waitForOpen(ws);
  ws.send(JSON.stringify({ type: 'join', payload: { playerName: name, team } }));
  return ws;
}

function waitForMessage(messages: any[], type: string, timeout = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const msg = messages.find(m => m.type === type);
      if (msg) {
        clearInterval(checkInterval);
        resolve(msg);
      }
    }, 50);

    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);
  });
}
