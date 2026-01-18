import { DurableObject } from 'cloudflare:workers';
import type { GameState, GameStatus, GameMode, Team, Player, Song, Answer } from '@party-popper/shared';
import { DEFAULT_SETTINGS, GAME_CONSTANTS } from '@party-popper/shared';
import songsData from '../data/songs.json';
import { generateQuizOptions } from './quiz-generator';
import { validatePlacement, getCorrectPosition } from './placement-validator';
import { RoundPhaseManager } from './round-phase-manager';
import type { NewRoundPhase, QuizOptions, TimelineSong } from '@party-popper/shared';

interface JoinPayload {
  playerName: string;
  sessionId: string;
  team?: "A" | "B";
}

export interface GameEnv {
  GAME: DurableObjectNamespace;
}

const VALID_TRANSITIONS: Record<GameStatus, GameStatus[]> = {
  lobby: ["playing"],
  playing: ["finished"],
  finished: [],
};

const PONG_TIMEOUT_MS = 10000; // 10 seconds
const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function createEmptyTeam(name: string): Team {
  return {
    name,
    players: [],
    timeline: [],
    tokens: 0,  // Changed from vetoTokens: 3
    score: 0,
  };
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class Game extends DurableObject {
  private connections: Map<WebSocket, { playerId?: string }> = new Map();
  private wsToPlayer: Map<WebSocket, string> = new Map(); // ws -> sessionId
  private pendingPongs: Map<WebSocket, number> = new Map(); // ws -> ping sent timestamp
  private state: GameState | null = null;
  private teammateQuizVotes: Map<string, { artistIndex: number | null; titleIndex: number | null }> = new Map();
  private teammatePlacementVotes: Map<string, { position: number }> = new Map();
  private teammateVetoVotes: Map<string, { useVeto: boolean }> = new Map();

  constructor(ctx: DurableObjectState, env: GameEnv) {
    super(ctx, env);
  }

  async initialize(joinCode: string, mode: GameMode): Promise<void> {
    // Load and shuffle songs for Classic mode
    const songPool: Song[] =
      mode === "classic"
        ? shuffleArray((songsData as { songs: Song[] }).songs)
        : [];

    this.state = {
      id: crypto.randomUUID(),
      joinCode,
      status: "lobby",
      mode,
      settings: { ...DEFAULT_SETTINGS },
      teams: {
        A: createEmptyTeam("Team A"),
        B: createEmptyTeam("Team B"),
      },
      currentRound: null,
      songPool,
      playedSongs: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await this.persistState();
  }

  getState(): GameState {
    if (!this.state) {
      throw new Error("Game not initialized");
    }
    return this.state;
  }

  async transitionTo(
    newStatus: GameStatus
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: "Game not initialized" };
    }

    const currentStatus = this.state.status;
    const validNextStates = VALID_TRANSITIONS[currentStatus];

    if (!validNextStates.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid state transition: ${currentStatus} -> ${newStatus}`,
      };
    }

    this.state.status = newStatus;
    this.state.lastActivityAt = Date.now();
    await this.persistState();

    return { success: true };
  }

  // Player management methods
  async handleJoin(payload: JoinPayload, ws: WebSocket): Promise<void> {
    if (!this.state) {
      throw new Error("Game not initialized");
    }

    const { playerName, sessionId, team } = payload;

    // Check if player with this session already exists (reconnection case)
    const existingPlayer = this.findPlayerBySession(sessionId);
    if (existingPlayer) {
      existingPlayer.connected = true;
      existingPlayer.lastSeen = Date.now();
      this.wsToPlayer.set(ws, sessionId);
      this.connections.set(ws, { playerId: existingPlayer.id });
      await this.persistState();
      return;
    }

    // Create new player
    const player: Player = {
      id: crypto.randomUUID(),
      name: playerName,
      sessionId,
      team: team || this.getTeamWithFewerPlayers(),
      connected: true,
      lastSeen: Date.now(),
      isTeamLeader: false,
    };

    // Assign to team (check capacity)
    let targetTeam = player.team;
    if (
      this.state.teams[targetTeam].players.length >=
      GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM
    ) {
      // Team full, try other team
      const otherTeam = targetTeam === "A" ? "B" : "A";
      if (
        this.state.teams[otherTeam].players.length <
        GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM
      ) {
        targetTeam = otherTeam;
        player.team = targetTeam;
      }
      // If both full, player still gets added (graceful degradation)
    }
    this.state.teams[targetTeam].players.push(player);

    // Track connection
    this.wsToPlayer.set(ws, sessionId);
    this.connections.set(ws, { playerId: player.id });

    this.state.lastActivityAt = Date.now();
    await this.persistState();

    // Send state sync to newly joined player
    this.sendStateSync(ws, player);

    // Broadcast player joined to all other players
    this.broadcast({ type: "player_joined", payload: { player } }, ws);
  }

  async handleLeave(ws: WebSocket): Promise<void> {
    if (!this.state) return;

    const sessionId = this.wsToPlayer.get(ws);
    if (!sessionId) return;

    // Remove player from team
    for (const teamKey of ["A", "B"] as const) {
      const team = this.state.teams[teamKey];
      const index = team.players.findIndex((p) => p.sessionId === sessionId);
      if (index !== -1) {
        team.players.splice(index, 1);
        break;
      }
    }

    this.wsToPlayer.delete(ws);
    this.connections.delete(ws);
    this.state.lastActivityAt = Date.now();
    await this.persistState();
  }

  async handleDisconnect(ws: WebSocket): Promise<void> {
    if (!this.state) return;

    const sessionId = this.wsToPlayer.get(ws);
    if (!sessionId) return;

    const player = this.findPlayerBySession(sessionId);
    if (player) {
      player.connected = false;
      player.lastSeen = Date.now();
    }

    this.wsToPlayer.delete(ws);
    this.connections.delete(ws);
    await this.persistState();
  }

  async handleReconnect(
    payload: { sessionId: string },
    ws: WebSocket
  ): Promise<{ success: boolean; playerName?: string; error?: string }> {
    if (!this.state) {
      return { success: false, error: "Game not initialized" };
    }

    const { sessionId } = payload;

    // Find player by session
    const player = this.findPlayerBySession(sessionId);

    if (!player) {
      return { success: false, error: "Session not found" };
    }

    // Check if within reconnection window
    const timeSinceLastSeen = Date.now() - player.lastSeen;
    if (timeSinceLastSeen > RECONNECT_WINDOW_MS) {
      return { success: false, error: "Reconnection window expired" };
    }

    // Restore connection
    player.connected = true;
    player.lastSeen = Date.now();

    this.wsToPlayer.set(ws, sessionId);
    this.connections.set(ws, { playerId: player.id });

    await this.persistState();

    // Send full state sync
    this.sendStateSync(ws, player);

    return { success: true, playerName: player.name };
  }

  findPlayerBySession(sessionId: string): Player | undefined {
    if (!this.state) return undefined;

    for (const teamKey of ["A", "B"] as const) {
      const player = this.state.teams[teamKey].players.find(
        (p) => p.sessionId === sessionId
      );
      if (player) return player;
    }
    return undefined;
  }

  findPlayerById(playerId: string): Player | undefined {
    if (!this.state) return undefined;

    for (const teamKey of ["A", "B"] as const) {
      const player = this.state.teams[teamKey].players.find(
        (p) => p.id === playerId
      );
      if (player) return player;
    }
    return undefined;
  }

  async reassignTeam(
    playerId: string,
    newTeam: "A" | "B"
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: "Game not initialized" };
    }

    // Find and remove player from current team
    let player: Player | undefined;
    for (const teamKey of ["A", "B"] as const) {
      const team = this.state.teams[teamKey];
      const index = team.players.findIndex((p) => p.id === playerId);
      if (index !== -1) {
        player = team.players[index];
        team.players.splice(index, 1);
        break;
      }
    }

    if (!player) {
      return { success: false, error: "Player not found" };
    }

    // Check if target team has capacity
    if (
      this.state.teams[newTeam].players.length >=
      GAME_CONSTANTS.MAX_PLAYERS_PER_TEAM
    ) {
      // Put player back
      this.state.teams[player.team].players.push(player);
      return { success: false, error: "Target team is full" };
    }

    // Add to new team
    player.team = newTeam;
    this.state.teams[newTeam].players.push(player);
    this.state.lastActivityAt = Date.now();
    await this.persistState();

    return { success: true };
  }

  async handlePlayerReady(playerId: string): Promise<void> {
    if (!this.state) return;

    const player = this.findPlayerById(playerId);
    if (!player) return;

    // Broadcast to all clients that player is ready
    this.broadcast({
      type: "player_ready_notification",
      payload: {
        playerId,
        playerName: player.name,
        readyAt: Date.now(),
      },
    });
  }

  async handleClaimTeamLeader(
    sessionId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: 'Game not initialized' };
    }

    const player = this.findPlayerBySession(sessionId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    const team = this.state.teams[player.team];
    const existingLeader = team.players.find(p => p.isTeamLeader);

    if (existingLeader) {
      return { success: false, error: 'Team already has a leader' };
    }

    // Set this player as leader
    player.isTeamLeader = true;
    await this.persistState();

    // Broadcast to all clients
    this.broadcast({
      type: 'leader_claimed',
      payload: {
        team: player.team,
        playerId: player.id,
        playerName: player.name,
      },
    });

    return { success: true };
  }

  async handleStartGame(
    _sessionId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: 'Game not initialized' };
    }

    // Auto-assign leaders for teams without one
    for (const teamId of ['A', 'B'] as const) {
      const team = this.state.teams[teamId];
      const hasLeader = team.players.some(p => p.isTeamLeader);

      if (!hasLeader && team.players.length > 0) {
        // Randomly select a leader
        const randomIndex = Math.floor(Math.random() * team.players.length);
        team.players[randomIndex].isTeamLeader = true;

        this.broadcast({
          type: 'leader_claimed',
          payload: {
            team: teamId,
            playerId: team.players[randomIndex].id,
            playerName: team.players[randomIndex].name,
          },
        });
      }
    }

    // Transition to playing state
    const transitionResult = await this.transitionTo('playing');
    if (!transitionResult.success) {
      return transitionResult;
    }

    // Start the first round
    const roundResult = await this.startQuizRound();
    if (!roundResult.success) {
      return roundResult;
    }

    this.broadcast({ type: 'game_started', payload: {} });
    this.broadcast({
      type: 'state_sync',
      payload: { gameState: this.state },
    });

    return { success: true };
  }

  private getTeamWithFewerPlayers(): "A" | "B" {
    if (!this.state) return "A";

    const teamACount = this.state.teams.A.players.length;
    const teamBCount = this.state.teams.B.players.length;

    return teamACount <= teamBCount ? "A" : "B";
  }

  // Round management methods
  async startRound(): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: "Game not initialized" };
    }

    if (this.state.status !== "playing") {
      return { success: false, error: "Game must be in playing state" };
    }

    // Pick next song
    if (this.state.songPool.length === 0) {
      return { success: false, error: "No more songs available" };
    }

    const song = this.state.songPool.shift()!;
    this.state.playedSongs.push(song);

    // Determine active team (alternate based on round number)
    const roundNumber = this.state.playedSongs.length;
    const activeTeam: "A" | "B" = roundNumber % 2 === 1 ? "A" : "B";

    // Create round
    const now = Date.now();
    const roundDuration = this.state.settings.quizTimeSeconds * 1000;

    this.state.currentRound = {
      number: roundNumber,
      song,
      activeTeam,
      phase: "guessing",
      startedAt: now,
      // Timer starts at a far future time - will be updated when QR code is scanned
      endsAt: now + 365 * 24 * 60 * 60 * 1000, // 1 year in the future (effectively no countdown)
      currentAnswer: null,
    };

    this.state.lastActivityAt = now;
    await this.persistState();

    return { success: true };
  }

  async submitAnswer(
    answer: Answer
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.state || !this.state.currentRound) {
      return { success: false, error: "No active round" };
    }

    if (this.state.currentRound.phase !== "guessing") {
      return { success: false, error: "Round is not in guessing phase" };
    }

    // Store answer
    this.state.currentRound.currentAnswer = answer;

    // Transition to reveal phase
    this.state.currentRound.phase = "reveal";
    this.state.lastActivityAt = Date.now();
    await this.persistState();

    return { success: true };
  }

  async completeRound(): Promise<{
    success: boolean;
    error?: string;
    gameFinished?: boolean;
  }> {
    if (!this.state || !this.state.currentRound) {
      return { success: false, error: "No active round" };
    }

    const round = this.state.currentRound;
    const answer = round.currentAnswer;
    const activeTeam = this.state.teams[round.activeTeam];

    // Calculate score (binary: all correct = 1 point, otherwise 0)
    if (answer) {
      const artistCorrect =
        answer.artist.toLowerCase().trim() ===
        round.song.artist.toLowerCase().trim();
      const titleCorrect =
        answer.title.toLowerCase().trim() ===
        round.song.title.toLowerCase().trim();
      const yearCorrect = answer.year === round.song.year;

      if (artistCorrect && titleCorrect && yearCorrect) {
        activeTeam.score += 1;

        // Add to timeline
        activeTeam.timeline.push({
          ...round.song,
          addedAt: Date.now(),
          pointsEarned: 1,
        });
      }
    }

    // Check if game is finished
    const gameFinished = activeTeam.score >= this.state.settings.targetScore;

    if (gameFinished) {
      this.state.status = "finished";
      this.state.currentRound = null;
    } else {
      // Transition to waiting phase
      this.state.currentRound.phase = "waiting";
    }

    this.state.lastActivityAt = Date.now();
    await this.persistState();

    return { success: true, gameFinished };
  }

  async startQuizRound(): Promise<{ success: boolean; error?: string }> {
    if (!this.state) {
      return { success: false, error: 'Game not initialized' };
    }

    if (this.state.status !== 'playing') {
      return { success: false, error: 'Game must be in playing state' };
    }

    if (this.state.songPool.length === 0) {
      return { success: false, error: 'No more songs available' };
    }

    const song = this.state.songPool.shift()!;
    this.state.playedSongs.push(song);

    const roundNumber = this.state.playedSongs.length;
    const activeTeam: 'A' | 'B' = (roundNumber % 2 === 1) ? 'A' : 'B';

    const quizOptions = generateQuizOptions(song, [...this.state.songPool, ...this.state.playedSongs]);

    const now = Date.now();

    this.state.currentRound = {
      number: roundNumber,
      song,
      activeTeam,
      phase: 'listening' as NewRoundPhase,
      startedAt: now,
      endsAt: now + (365 * 24 * 60 * 60 * 1000),
      currentAnswer: null,
      quizOptions,
    };

    this.state.lastActivityAt = now;
    await this.persistState();

    return { success: true };
  }

  /**
   * Clear all teammate vote maps between phases
   */
  clearTeammateVotes(): void {
    this.teammateQuizVotes.clear();
    this.teammatePlacementVotes.clear();
    this.teammateVetoVotes.clear();
  }

  async transitionToPhase(phase: NewRoundPhase): Promise<void> {
    if (!this.state || !this.state.currentRound) return;

    // Clear teammate votes when entering quiz, placement, veto_window, or veto_placement phases
    if (phase === 'quiz' || phase === 'placement' || phase === 'veto_window' || phase === 'veto_placement') {
      this.clearTeammateVotes();
    }

    const now = Date.now();
    const duration = RoundPhaseManager.getPhaseDuration(phase, this.state.settings);

    this.state.currentRound.phase = phase;
    this.state.currentRound.endsAt = duration > 0 ? now + duration : now + (365 * 24 * 60 * 60 * 1000);

    await this.persistState();

    // Schedule alarm for timed phases
    if (duration > 0) {
      await this.ctx.storage.setAlarm(this.state.currentRound.endsAt);
    }

    this.broadcast({
      type: 'phase_changed',
      payload: {
        phase,
        quizOptions: phase === 'quiz' ? this.state.currentRound.quizOptions : undefined,
        endsAt: this.state.currentRound.endsAt,
      },
    });
  }

  /**
   * Durable Object alarm handler - called when phase timer expires
   */
  async alarm(): Promise<void> {
    // Load state if not loaded
    if (!this.state) {
      await this.loadState();
    }

    if (!this.state || !this.state.currentRound) return;

    const phase = this.state.currentRound.phase as NewRoundPhase;
    console.log(`[Game] Alarm triggered for phase: ${phase}`);

    switch (phase) {
      case 'quiz':
        await this.handleQuizTimeout();
        break;
      case 'placement':
        await this.handlePlacementTimeout();
        break;
      case 'veto_window':
        await this.handleVetoWindowTimeout();
        break;
      case 'veto_placement':
        await this.handleVetoPlacementTimeout();
        break;
      default:
        // No timeout handling for listening or reveal phases
        break;
    }
  }

  /**
   * Quiz timeout: No answer submitted, proceed to placement without token
   */
  private async handleQuizTimeout(): Promise<void> {
    if (!this.state || !this.state.currentRound) return;
    if (this.state.currentRound.phase !== 'quiz') return;

    const round = this.state.currentRound;
    const quizOptions = round.quizOptions;

    // Mark as timed out (no correct answer)
    round.quizAnswer = {
      selectedArtistIndex: -1,
      selectedTitleIndex: -1,
      correct: false,
    };

    await this.persistState();

    // Broadcast timeout result
    this.broadcast({
      type: 'quiz_result',
      payload: {
        correct: false,
        earnedToken: false,
        correctArtist: quizOptions?.artists[quizOptions.correctArtistIndex] ?? '',
        correctTitle: quizOptions?.songTitles[quizOptions.correctTitleIndex] ?? '',
        timedOut: true,
      },
    });

    await this.transitionToPhase('placement');
  }

  /**
   * Placement timeout: No placement made, skip to veto window (song won't be added)
   */
  private async handlePlacementTimeout(): Promise<void> {
    if (!this.state || !this.state.currentRound) return;
    if (this.state.currentRound.phase !== 'placement') return;

    const round = this.state.currentRound;

    // Mark placement as timed out (position -1 indicates no placement)
    round.placement = {
      position: -1,
      placedAt: Date.now(),
    };

    await this.persistState();

    this.broadcast({
      type: 'placement_submitted',
      payload: {
        teamId: round.activeTeam,
        position: -1,
        timelineSongCount: this.state.teams[round.activeTeam].timeline.length,
        timedOut: true,
      },
    });

    await this.transitionToPhase('veto_window');

    const vetoTeam = round.activeTeam === 'A' ? 'B' : 'A';
    this.broadcast({
      type: 'veto_window_open',
      payload: {
        vetoTeamId: vetoTeam,
        activeTeamPlacement: -1,
        tokensAvailable: this.state.teams[vetoTeam].tokens,
        endsAt: this.state.currentRound.endsAt,
      },
    });
  }

  /**
   * Veto window timeout: Auto-pass veto, proceed to reveal
   */
  private async handleVetoWindowTimeout(): Promise<void> {
    if (!this.state || !this.state.currentRound) return;
    if (this.state.currentRound.phase !== 'veto_window') return;

    const round = this.state.currentRound;
    const vetoTeam = round.activeTeam === 'A' ? 'B' : 'A';

    // Auto-pass veto
    round.vetoDecision = {
      used: false,
      decidedAt: Date.now(),
    };

    await this.persistState();

    this.broadcast({
      type: 'veto_decision',
      payload: {
        used: false,
        vetoTeamId: vetoTeam,
        timedOut: true,
      },
    });

    await this.transitionToPhase('reveal');
  }

  /**
   * Veto placement timeout: Veto team loses their chance, proceed to reveal
   */
  private async handleVetoPlacementTimeout(): Promise<void> {
    if (!this.state || !this.state.currentRound) return;
    if (this.state.currentRound.phase !== 'veto_placement') return;

    const round = this.state.currentRound;

    // Mark veto placement as timed out (position -1 indicates no placement)
    round.vetoPlacement = {
      position: -1,
      placedAt: Date.now(),
    };

    await this.persistState();

    await this.transitionToPhase('reveal');
  }

  async handleSubmitQuiz(
    artistIndex: number,
    titleIndex: number,
    playerId: string
  ): Promise<{ success: boolean; correct: boolean; earnedToken: boolean }> {
    if (!this.state || !this.state.currentRound) {
      return { success: false, correct: false, earnedToken: false };
    }

    const round = this.state.currentRound;
    if (round.phase !== 'quiz') {
      return { success: false, correct: false, earnedToken: false };
    }

    // Verify player is on active team and is team leader
    const allPlayers = [...this.state.teams.A.players, ...this.state.teams.B.players];
    const player = allPlayers.find(p => p.id === playerId);
    if (!player || player.team !== round.activeTeam) {
      return { success: false, correct: false, earnedToken: false };
    }

    // Only team leader can submit final quiz answer
    if (!player.isTeamLeader) {
      return { success: false, correct: false, earnedToken: false };
    }

    const quizOptions = round.quizOptions;
    if (!quizOptions) {
      return { success: false, correct: false, earnedToken: false };
    }

    const artistCorrect = artistIndex === quizOptions.correctArtistIndex;
    const titleCorrect = titleIndex === quizOptions.correctTitleIndex;
    const bothCorrect = artistCorrect && titleCorrect;

    round.quizAnswer = {
      selectedArtistIndex: artistIndex,
      selectedTitleIndex: titleIndex,
      correct: bothCorrect,
    };

    if (bothCorrect) {
      this.state.teams[round.activeTeam].tokens += 1;
    }

    // Cancel the timeout alarm since action was taken
    await this.ctx.storage.deleteAlarm();

    await this.persistState();

    this.broadcast({
      type: 'quiz_result',
      payload: {
        correct: bothCorrect,
        earnedToken: bothCorrect,
        correctArtist: quizOptions.artists[quizOptions.correctArtistIndex],
        correctTitle: quizOptions.songTitles[quizOptions.correctTitleIndex],
      },
    });

    await this.transitionToPhase('placement');

    return { success: true, correct: bothCorrect, earnedToken: bothCorrect };
  }

  async handleSubmitPlacement(position: number, playerId: string): Promise<{ success: boolean }> {
    if (!this.state || !this.state.currentRound) {
      return { success: false };
    }

    const round = this.state.currentRound;
    if (round.phase !== 'placement') {
      return { success: false };
    }

    // Verify player is on active team and is team leader
    const allPlayers = [...this.state.teams.A.players, ...this.state.teams.B.players];
    const player = allPlayers.find(p => p.id === playerId);
    if (!player || player.team !== round.activeTeam) {
      return { success: false };
    }

    // Only team leader can submit final placement
    if (!player.isTeamLeader) {
      return { success: false };
    }

    round.placement = {
      position,
      placedAt: Date.now(),
    };

    // Cancel the timeout alarm since action was taken
    await this.ctx.storage.deleteAlarm();

    await this.persistState();

    this.broadcast({
      type: 'placement_submitted',
      payload: {
        teamId: round.activeTeam,
        position,
        timelineSongCount: this.state.teams[round.activeTeam].timeline.length,
      },
    });

    await this.transitionToPhase('veto_window');

    const vetoTeam = round.activeTeam === 'A' ? 'B' : 'A';
    this.broadcast({
      type: 'veto_window_open',
      payload: {
        vetoTeamId: vetoTeam,
        activeTeamPlacement: position,
        tokensAvailable: this.state.teams[vetoTeam].tokens,
        endsAt: this.state.currentRound.endsAt,
      },
    });

    return { success: true };
  }

  async handleVetoDecision(useVeto: boolean, playerId: string): Promise<{ success: boolean }> {
    if (!this.state || !this.state.currentRound) {
      return { success: false };
    }

    const round = this.state.currentRound;
    if (round.phase !== 'veto_window') {
      return { success: false };
    }

    const vetoTeam = round.activeTeam === 'A' ? 'B' : 'A';

    // Verify player is on veto team (opposing team) and is team leader
    const allPlayers = [...this.state.teams.A.players, ...this.state.teams.B.players];
    const player = allPlayers.find(p => p.id === playerId);
    if (!player || player.team !== vetoTeam) {
      return { success: false };
    }

    // Only team leader can make veto decision
    if (!player.isTeamLeader) {
      return { success: false };
    }

    if (useVeto && this.state.teams[vetoTeam].tokens < 1) {
      return { success: false };
    }

    round.vetoDecision = {
      used: useVeto,
      decidedAt: Date.now(),
    };

    if (useVeto) {
      this.state.teams[vetoTeam].tokens -= 1;
    }

    // Cancel the timeout alarm since action was taken
    await this.ctx.storage.deleteAlarm();

    await this.persistState();

    this.broadcast({
      type: 'veto_decision',
      payload: {
        used: useVeto,
        vetoTeamId: vetoTeam,
      },
    });

    const nextPhase = RoundPhaseManager.getNextPhase('veto_window', useVeto);
    if (nextPhase) {
      await this.transitionToPhase(nextPhase);
    }

    return { success: true };
  }

  async handleVetoPlacement(position: number, playerId: string): Promise<{ success: boolean }> {
    if (!this.state || !this.state.currentRound) {
      return { success: false };
    }

    const round = this.state.currentRound;
    if (round.phase !== 'veto_placement') {
      return { success: false };
    }

    // Verify player is on veto team (opposing team)
    const vetoTeam = round.activeTeam === 'A' ? 'B' : 'A';
    const allPlayers = [...this.state.teams.A.players, ...this.state.teams.B.players];
    const player = allPlayers.find(p => p.id === playerId);
    if (!player || player.team !== vetoTeam) {
      return { success: false };
    }

    if (round.placement && position === round.placement.position) {
      return { success: false };
    }

    round.vetoPlacement = {
      position,
      placedAt: Date.now(),
    };

    // Cancel the timeout alarm since action was taken
    await this.ctx.storage.deleteAlarm();

    await this.persistState();

    await this.transitionToPhase('reveal');

    return { success: true };
  }

  async resolveRound(): Promise<{
    success: boolean;
    songAddedTo: 'A' | 'B' | null;
    gameFinished: boolean;
  }> {
    if (!this.state || !this.state.currentRound) {
      return { success: false, songAddedTo: null, gameFinished: false };
    }

    const round = this.state.currentRound;
    const song = round.song;
    const activeTeam = round.activeTeam;
    const vetoTeam = activeTeam === 'A' ? 'B' : 'A';

    let songAddedTo: 'A' | 'B' | null = null;

    const activeTeamTimeline = this.state.teams[activeTeam].timeline;
    const vetoTeamTimeline = this.state.teams[vetoTeam].timeline;

    const activeTeamCorrect = round.placement
      ? validatePlacement(activeTeamTimeline, song.year, round.placement.position)
      : false;

    const vetoUsed = round.vetoDecision?.used ?? false;
    const vetoTeamCorrect = round.vetoPlacement
      ? validatePlacement(vetoTeamTimeline, song.year, round.vetoPlacement.position)
      : false;

    if (vetoUsed) {
      if (vetoTeamCorrect) {
        songAddedTo = vetoTeam;
        this.addSongToTimeline(vetoTeam, song, round.vetoPlacement!.position);
      }
    } else {
      if (activeTeamCorrect) {
        songAddedTo = activeTeam;
        this.addSongToTimeline(activeTeam, song, round.placement!.position);
      }
    }

    this.state.teams.A.score = this.state.teams.A.timeline.length;
    this.state.teams.B.score = this.state.teams.B.timeline.length;

    const gameFinished =
      this.state.teams.A.score >= this.state.settings.targetScore ||
      this.state.teams.B.score >= this.state.settings.targetScore;

    if (gameFinished) {
      this.state.status = 'finished';
    }

    this.broadcast({
      type: 'new_round_result',
      payload: {
        song,
        correctYear: song.year,
        activeTeamPlacement: round.placement?.position ?? -1,
        activeTeamCorrect,
        vetoUsed,
        vetoTeamPlacement: round.vetoPlacement?.position,
        vetoTeamCorrect: vetoUsed ? vetoTeamCorrect : undefined,
        songAddedTo,
        updatedTeams: {
          A: { timeline: this.state.teams.A.timeline, tokens: this.state.teams.A.tokens },
          B: { timeline: this.state.teams.B.timeline, tokens: this.state.teams.B.tokens },
        },
      },
    });

    if (gameFinished) {
      const winner = this.state.teams.A.score >= this.state.settings.targetScore ? 'A' : 'B';
      this.broadcast({
        type: 'game_won',
        payload: {
          winner,
          finalTeams: {
            A: { timeline: this.state.teams.A.timeline, tokens: this.state.teams.A.tokens },
            B: { timeline: this.state.teams.B.timeline, tokens: this.state.teams.B.tokens },
          },
        },
      });
    }

    this.state.currentRound = null;
    await this.persistState();

    return { success: true, songAddedTo, gameFinished };
  }

  private addSongToTimeline(team: 'A' | 'B', song: Song, position: number): void {
    if (!this.state) return;

    const timelineSong: TimelineSong = {
      ...song,
      addedAt: Date.now(),
      pointsEarned: 1,
    };

    this.state.teams[team].timeline.splice(position, 0, timelineSong);
    this.state.teams[team].timeline.sort((a, b) => a.year - b.year);
  }

  // Teammate suggestion methods
  async handleQuizSuggestion(
    sessionId: string,
    suggestion: { artistIndex: number | null; titleIndex: number | null }
  ): Promise<{ success: boolean }> {
    if (!this.state) return { success: false };

    const player = this.findPlayerBySession(sessionId);
    if (!player) return { success: false };

    // Store the suggestion
    this.teammateQuizVotes.set(sessionId, suggestion);

    // Find team leader to send the suggestion to
    const team = this.state.teams[player.team];
    const leader = team.players.find(p => p.isTeamLeader && p.connected);

    if (leader) {
      // Find leader's WebSocket
      for (const [ws, wsSessionId] of this.wsToPlayer.entries()) {
        if (wsSessionId === leader.sessionId) {
          this.sendToWs(ws, {
            type: 'teammate_quiz_vote',
            payload: {
              playerId: player.id,
              playerName: player.name,
              artistIndex: suggestion.artistIndex,
              titleIndex: suggestion.titleIndex,
            },
          });
          break;
        }
      }
    }

    return { success: true };
  }

  async handlePlacementSuggestion(
    sessionId: string,
    suggestion: { position: number }
  ): Promise<{ success: boolean }> {
    if (!this.state) return { success: false };

    const player = this.findPlayerBySession(sessionId);
    if (!player) return { success: false };

    // Store the suggestion
    this.teammatePlacementVotes.set(sessionId, suggestion);

    // Find team leader to send the suggestion to
    const team = this.state.teams[player.team];
    const leader = team.players.find(p => p.isTeamLeader && p.connected);

    if (leader) {
      // Find leader's WebSocket
      for (const [ws, wsSessionId] of this.wsToPlayer.entries()) {
        if (wsSessionId === leader.sessionId) {
          this.sendToWs(ws, {
            type: 'teammate_placement_vote',
            payload: {
              playerId: player.id,
              playerName: player.name,
              position: suggestion.position,
            },
          });
          break;
        }
      }
    }

    return { success: true };
  }

  async handleVetoSuggestion(
    sessionId: string,
    suggestion: { useVeto: boolean }
  ): Promise<{ success: boolean }> {
    if (!this.state) return { success: false };

    const player = this.findPlayerBySession(sessionId);
    if (!player) return { success: false };

    // Store the suggestion
    this.teammateVetoVotes.set(sessionId, suggestion);

    // Find team leader to send the suggestion to
    const team = this.state.teams[player.team];
    const leader = team.players.find(p => p.isTeamLeader && p.connected);

    if (leader) {
      // Find leader's WebSocket
      for (const [ws, wsSessionId] of this.wsToPlayer.entries()) {
        if (wsSessionId === leader.sessionId) {
          this.sendToWs(ws, {
            type: 'teammate_veto_vote',
            payload: {
              playerId: player.id,
              playerName: player.name,
              useVeto: suggestion.useVeto,
            },
          });
          break;
        }
      }
    }

    return { success: true };
  }

  // Broadcast methods
  private sendStateSync(ws: WebSocket, player: Player): void {
    if (!this.state) return;

    const message = {
      type: "state_sync",
      payload: {
        gameState: this.state,
        playerId: player.id,
        sessionId: player.sessionId,
      },
    };

    this.sendToWs(ws, message);
  }

  broadcast(message: unknown, excludeWs?: WebSocket): void {
    const messageStr = JSON.stringify(message);

    // Use ctx.getWebSockets() to get all active connections (survives hibernation)
    const allWebSockets = this.ctx.getWebSockets();

    for (const ws of allWebSockets) {
      if (ws !== excludeWs) {
        this.sendToWs(ws, message, messageStr);
      }
    }
  }

  private sendToWs(ws: WebSocket, message: unknown, messageStr?: string): void {
    try {
      const readyState = (ws as any).readyState;
      if (readyState === 1) {
        ws.send(messageStr || JSON.stringify(message));
        console.log("[Game] Message sent to WebSocket");
      } else {
        console.log("[Game] WebSocket not ready, readyState:", readyState);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }

  // Heartbeat methods
  async sendHeartbeat(): Promise<void> {
    const pingMessage = JSON.stringify({ type: "ping", payload: {} });

    // Use ctx.getWebSockets() to get all active connections
    const allWebSockets = this.ctx.getWebSockets();

    for (const ws of allWebSockets) {
      if ((ws as any).readyState === 1) {
        this.sendToWs(ws, pingMessage, pingMessage);
        this.recordPingSent(ws);
      }
    }
  }

  recordPingSent(ws: WebSocket): void {
    this.pendingPongs.set(ws, Date.now());
  }

  handlePong(ws: WebSocket): void {
    this.pendingPongs.delete(ws);
  }

  isConnectionHealthy(ws: WebSocket): boolean {
    const pingTime = this.pendingPongs.get(ws);
    if (!pingTime) return true; // No pending ping

    return Date.now() - pingTime < PONG_TIMEOUT_MS;
  }

  async checkPongTimeouts(): Promise<void> {
    const now = Date.now();

    for (const [ws, pingSentAt] of this.pendingPongs) {
      if (now - pingSentAt > PONG_TIMEOUT_MS) {
        // Close timed out connection
        try {
          (ws as any).close(1000, "Ping timeout");
        } catch {
          // Connection may already be closed
        }
        this.pendingPongs.delete(ws);
        await this.handleDisconnect(ws);
      }
    }
  }

  // Song pool methods
  async getNextSong(): Promise<Song | null> {
    if (!this.state || this.state.songPool.length === 0) {
      return null;
    }

    // Take first song from pool
    const song = this.state.songPool.shift()!;

    // Add to played songs
    this.state.playedSongs.push(song);

    await this.persistState();

    return song;
  }

  hasSongsAvailable(): boolean {
    return this.state !== null && this.state.songPool.length > 0;
  }

  private async persistState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put("gameState", this.state);
    }
  }

  private async loadState(): Promise<void> {
    const stored = await this.ctx.storage.get<GameState>("gameState");
    if (stored) {
      this.state = stored;
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Load state if not already loaded
    if (!this.state) {
      await this.loadState();
    }

    const url = new URL(request.url);

    // Internal: Initialize game
    if (url.pathname === "/initialize" && request.method === "POST") {
      const body = (await request.json()) as {
        joinCode: string;
        mode: "classic" | "custom";
      };
      await this.initialize(body.joinCode, body.mode);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Internal: Get game info
    if (url.pathname === "/info" && request.method === "GET") {
      if (!this.state) {
        return new Response(JSON.stringify({ error: "Game not found" }), {
          status: 404,
        });
      }
      return new Response(
        JSON.stringify({
          joinCode: this.state.joinCode,
          status: this.state.status,
          mode: this.state.mode,
          playerCount:
            this.state.teams.A.players.length +
            this.state.teams.B.players.length,
          teams: {
            A: {
              name: this.state.teams.A.name,
              playerCount: this.state.teams.A.players.length,
            },
            B: {
              name: this.state.teams.B.name,
              playerCount: this.state.teams.B.players.length,
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Internal: Track QR scan
    if (url.pathname === "/qr-scan" && request.method === "POST") {
      console.log("[Game] QR scan notification received");
      console.log("[Game] this.state exists:", !!this.state);
      console.log(
        "[Game] this.state.currentRound exists:",
        !!this.state?.currentRound
      );
      console.log("[Game] this.state.status:", this.state?.status);
      let body: { scannedAt: number; userAgent?: string };
      try {
        body = (await request.json()) as {
          scannedAt: number;
          userAgent?: string;
        };
        console.log("[Game] Body parsed:", body);
      } catch (e) {
        console.log("[Game] Body parse error:", e);
        body = { scannedAt: Date.now() };
      }

      // Start the round timer if not already started
      if (this.state && this.state.currentRound) {
        const now = Date.now();
        const roundDuration = this.state.settings.quizTimeSeconds * 1000;
        const currentEndsAt = this.state.currentRound.endsAt;

        console.log(
          "[Game] Current round timer endsAt:",
          new Date(currentEndsAt).toISOString()
        );
        console.log(
          "[Game] Now + roundDuration * 2:",
          new Date(now + roundDuration * 2).toISOString()
        );

        // Only update if timer hasn't been started yet (check if it's in the far future)
        if (currentEndsAt > now + roundDuration * 2) {
          console.log(
            "[Game] Starting timer! New endsAt:",
            new Date(now + roundDuration).toISOString()
          );
          this.state.currentRound.endsAt = now + roundDuration;
          await this.persistState();

          // After updating endsAt, transition to quiz phase
          if (this.state.currentRound.phase === 'listening') {
            await this.transitionToPhase('quiz');
          }

          // Broadcast state_sync so host gets the updated timer
          this.broadcast({
            type: "state_sync",
            payload: { gameState: this.state },
          });
        } else {
          console.log("[Game] Timer already started, skipping update");
        }
      } else {
        console.log("[Game] No current round, cannot start timer");
      }

      // Broadcast scan detection to all clients
      const allWs = this.ctx.getWebSockets();
      console.log(
        "[Game] Broadcasting scan detection to",
        allWs.length,
        "WebSockets (connections map:",
        this.connections.size,
        ")"
      );
      this.broadcast({
        type: "qr_scan_detected",
        payload: {
          scannedAt: body.scannedAt,
          userAgent: body.userAgent,
        },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // WebSocket upgrade
    if (
      url.pathname === "/ws" ||
      request.headers.get("Upgrade") === "websocket"
    ) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Tag the WebSocket with its role - tags survive hibernation
      const role = url.searchParams.get("role");
      const tags = role === "host" ? ["host"] : ["player"];
      this.ctx.acceptWebSocket(server, tags);
      this.connections.set(server, {});

      // For host connections, send state_sync immediately
      if (role === "host" && this.state) {
        server.send(
          JSON.stringify({
            type: "state_sync",
            payload: {
              gameState: this.state,
            },
          })
        );
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketOpen(ws: WebSocket): Promise<void> {
    // Load state if not already loaded (can happen after hibernation wake-up)
    if (!this.state) {
      await this.loadState();
    }

    // Check if this is a host connection using WebSocket tags (survive hibernation)
    const tags = this.ctx.getTags(ws);
    const isHost = tags.includes("host");

    // If this is a host connection, send state sync
    // (Also sent in fetch handler, but this covers hibernation wake-up scenarios)
    if (isHost && this.state) {
      this.sendToWs(ws, {
        type: "state_sync",
        payload: {
          gameState: this.state,
        },
      });
    }
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    // Load state if not already loaded (can happen after hibernation)
    if (!this.state) {
      await this.loadState();
    }

    const data =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    try {
      const parsed = JSON.parse(data);
      const { type, payload } = parsed;

      switch (type) {
        case "join":
          await this.handleJoin(payload, ws);
          break;

        case "reconnect":
          const result = await this.handleReconnect(payload, ws);
          this.sendToWs(ws, { type: "reconnect_result", payload: result });
          break;

        case "pong":
          this.handlePong(ws);
          break;

        case "reassign_team":
          if (payload.playerId && payload.team) {
            const reassignResult = await this.reassignTeam(
              payload.playerId,
              payload.team
            );
            if (reassignResult.success) {
              this.broadcast({
                type: "team_changed",
                payload: { playerId: payload.playerId, toTeam: payload.team },
              });
            } else {
              this.sendToWs(ws, {
                type: "error",
                payload: { message: reassignResult.error },
              });
            }
          }
          break;

        case "update_settings":
          if (this.state && payload) {
            this.state.settings = { ...this.state.settings, ...payload };
            await this.persistState();
            this.broadcast({
              type: "settings_updated",
              payload: { settings: this.state.settings },
            });
          }
          break;

        case "start_game":
          {
            const sessionId = this.wsToPlayer.get(ws);
            const startResult = await this.handleStartGame(sessionId || '');
            if (!startResult.success) {
              this.sendToWs(ws, {
                type: "error",
                payload: { message: startResult.error },
              });
            }
          }
          break;

        case "player_ready":
          if (payload && payload.playerId) {
            await this.handlePlayerReady(payload.playerId);
          }
          break;

        case "submit_answer":
          if (
            payload &&
            payload.artist &&
            payload.title &&
            payload.year !== undefined &&
            payload.submittedBy
          ) {
            const answer: Answer = {
              artist: payload.artist,
              title: payload.title,
              year: payload.year,
              submittedBy: payload.submittedBy,
              submittedAt: Date.now(),
            };

            const submitResult = await this.submitAnswer(answer);
            if (submitResult.success) {
              // Broadcast updated state with answer and reveal phase
              this.broadcast({
                type: "state_sync",
                payload: { gameState: this.state },
              });
            } else {
              this.sendToWs(ws, {
                type: "error",
                payload: { message: submitResult.error },
              });
            }
          } else {
            this.sendToWs(ws, {
              type: "error",
              payload: { message: "Invalid answer format" },
            });
          }
          break;

        case 'next_round':
          if (this.state?.currentRound?.phase === 'reveal') {
            const resolveResult = await this.resolveRound();
            if (resolveResult.success && !resolveResult.gameFinished) {
              const nextRoundResult = await this.startQuizRound();
              if (nextRoundResult.success) {
                this.broadcast({
                  type: "state_sync",
                  payload: { gameState: this.state },
                });
              }
            }
          } else {
            const completeResult = await this.completeRound();
            if (completeResult.success) {
              if (!completeResult.gameFinished) {
                const nextRoundResult = await this.startQuizRound();
                if (nextRoundResult.success) {
                  this.broadcast({
                    type: 'state_sync',
                    payload: { gameState: this.state }
                  });
                }
              }
            }
          }
          break;

        case 'submit_quiz':
          if (payload && payload.artistIndex !== undefined && payload.titleIndex !== undefined) {
            const sessionId = this.wsToPlayer.get(ws);
            const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
            if (player) {
              const result = await this.handleSubmitQuiz(payload.artistIndex, payload.titleIndex, player.id);
              if (!result.success) {
                this.sendToWs(ws, { type: 'error', payload: { code: 'HANDLER_ERROR', message: 'Failed to submit quiz' } });
              }
            }
          }
          break;

        case 'submit_placement':
          if (payload && payload.position !== undefined) {
            const sessionId = this.wsToPlayer.get(ws);
            const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
            if (player) {
              const result = await this.handleSubmitPlacement(payload.position, player.id);
              if (!result.success) {
                this.sendToWs(ws, { type: 'error', payload: { code: 'HANDLER_ERROR', message: 'Failed to submit placement' } });
              }
            }
          }
          break;

        case 'use_veto':
          {
            const sessionId = this.wsToPlayer.get(ws);
            const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
            if (player) {
              const result = await this.handleVetoDecision(true, player.id);
              if (!result.success) {
                this.sendToWs(ws, { type: 'error', payload: { code: 'HANDLER_ERROR', message: 'Failed to use veto' } });
              }
            }
          }
          break;

        case 'pass_veto':
          {
            const sessionId = this.wsToPlayer.get(ws);
            const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
            if (player) {
              const result = await this.handleVetoDecision(false, player.id);
              if (!result.success) {
                this.sendToWs(ws, { type: 'error', payload: { code: 'HANDLER_ERROR', message: 'Failed to pass veto' } });
              }
            }
          }
          break;

        case 'submit_veto_placement':
          if (payload && payload.position !== undefined) {
            const sessionId = this.wsToPlayer.get(ws);
            const player = sessionId ? this.findPlayerBySession(sessionId) : undefined;
            if (player) {
              const result = await this.handleVetoPlacement(payload.position, player.id);
              if (!result.success) {
                this.sendToWs(ws, { type: 'error', payload: { code: 'HANDLER_ERROR', message: 'Failed to submit veto placement' } });
              }
            }
          }
          break;

        case 'claim_team_leader':
          {
            const sessionId = this.wsToPlayer.get(ws);
            if (sessionId) {
              const result = await this.handleClaimTeamLeader(sessionId);
              if (!result.success) {
                this.sendToWs(ws, { type: 'error', payload: { code: 'CLAIM_LEADER_ERROR', message: result.error } });
              }
            }
          }
          break;

        case 'submit_quiz_suggestion':
          {
            const sessionId = this.wsToPlayer.get(ws);
            if (sessionId && payload) {
              await this.handleQuizSuggestion(sessionId, {
                artistIndex: payload.artistIndex ?? null,
                titleIndex: payload.titleIndex ?? null,
              });
            }
          }
          break;

        case 'submit_placement_suggestion':
          {
            const sessionId = this.wsToPlayer.get(ws);
            if (sessionId && payload && payload.position !== undefined) {
              await this.handlePlacementSuggestion(sessionId, {
                position: payload.position,
              });
            }
          }
          break;

        case 'submit_veto_suggestion':
          {
            const sessionId = this.wsToPlayer.get(ws);
            if (sessionId && payload && payload.useVeto !== undefined) {
              await this.handleVetoSuggestion(sessionId, {
                useVeto: payload.useVeto,
              });
            }
          }
          break;

        default:
          console.log("Unknown message type:", type);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      this.sendToWs(ws, {
        type: "error",
        payload: { message: "Invalid message format" },
      });
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string
  ): Promise<void> {
    console.log(`WebSocket closed: ${code} ${reason}`);
    await this.handleClose(ws);
  }

  async handleClose(ws: WebSocket): Promise<void> {
    // Handle player disconnect
    const sessionId = this.wsToPlayer.get(ws);
    if (sessionId) {
      const player = this.findPlayerBySession(sessionId);
      if (player) {
        // Mark player as disconnected
        player.connected = false;
        player.lastSeen = Date.now();

        // Handle leader disconnect
        if (player.isTeamLeader) {
          player.isTeamLeader = false;

          // If game is playing, auto-assign to first connected teammate
          if (this.state && this.state.status === 'playing') {
            const team = this.state.teams[player.team];
            const connectedTeammate = team.players.find(
              p => p.sessionId !== sessionId && p.connected
            );
            if (connectedTeammate) {
              connectedTeammate.isTeamLeader = true;

              // Broadcast leader_claimed for the new leader
              this.broadcast({
                type: 'leader_claimed',
                payload: {
                  team: player.team,
                  playerId: connectedTeammate.id,
                  playerName: connectedTeammate.name,
                },
              });
            }
          }
        }

        // Broadcast player_left to all other connections
        this.broadcast({
          type: "player_left",
          payload: { playerId: player.id },
        });

        await this.persistState();
      }

      this.wsToPlayer.delete(ws);
    }

    this.connections.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    this.connections.delete(ws);
  }
}
