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
  typingState?: TypingState | null; // Not used in v1 minimal gameplay
  vetoChallenge?: VetoChallenge | null; // Not used in v1 minimal gameplay
}

export type RoundPhase = 'guessing' | 'reveal' | 'waiting';

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
