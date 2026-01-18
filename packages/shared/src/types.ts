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
  tokens: number;  // Renamed from vetoTokens - earned from correct quizzes
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
  phase: RoundPhase | NewRoundPhase;
  startedAt: number;
  endsAt: number;
  // Old fields (deprecated but kept for compatibility)
  currentAnswer: Answer | null;
  typingState?: TypingState | null;
  vetoChallenge?: VetoChallenge | null;
  // New quiz fields
  quizOptions?: QuizOptions;
  quizAnswer?: QuizAnswer;
  placement?: TimelinePlacement;
  vetoDecision?: VetoDecision;
  vetoPlacement?: VetoPlacement;
}

export type RoundPhase = 'guessing' | 'reveal' | 'waiting';

// New 6-phase round system
export type NewRoundPhase =
  | 'listening'      // QR scan, waiting for song to play
  | 'quiz'           // Multiple choice artist + song
  | 'placement'      // Timeline placement by active team
  | 'veto_window'    // Other team decides to challenge
  | 'veto_placement' // Veto team places their guess
  | 'reveal';        // Show correct answer, update timelines

export interface QuizOptions {
  artists: string[];      // 4 options, 1 correct
  songTitles: string[];   // 4 options, 1 correct
  correctArtistIndex: number;
  correctTitleIndex: number;
}

export interface QuizAnswer {
  selectedArtistIndex: number;
  selectedTitleIndex: number;
  correct: boolean;  // Both must match
}

export interface TimelinePlacement {
  position: number;  // Index where song would be inserted (0 = before first, etc.)
  placedAt: number;  // Timestamp
}

export interface VetoDecision {
  used: boolean;
  decidedAt: number;
}

export interface VetoPlacement {
  position: number;
  placedAt: number;
}

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
