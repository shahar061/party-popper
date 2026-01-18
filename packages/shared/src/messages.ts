import type { GameState, Player, Round, Answer, TypingState, RoundResult, GameSettings, QuizOptions, Song, TimelineSong, TeammateQuizVote, TeammatePlacementVote, TeammateVetoVote } from './types';

/**
 * Client -> Server message types
 */
export type ClientMessageType =
  | 'join'
  | 'leave'
  | 'reconnect'
  | 'start_game'
  | 'player_ready'
  | 'submit_answer'
  | 'use_veto'
  | 'typing'
  | 'next_round'
  | 'reassign_team'
  | 'update_settings'
  | 'pong'
  | 'submit_quiz'
  | 'submit_placement'
  | 'pass_veto'
  | 'submit_veto_placement'
  | 'claim_team_leader'
  | 'submit_quiz_suggestion'
  | 'submit_placement_suggestion'
  | 'submit_veto_suggestion';

/**
 * Client -> Server messages
 */
export type ClientMessage =
  | JoinMessage
  | LeaveMessage
  | ReconnectMessage
  | StartGameMessage
  | PlayerReadyMessage
  | SubmitAnswerMessage
  | TypingMessage
  | UseVetoMessage
  | NextRoundMessage
  | ReassignTeamMessage
  | UpdateSettingsMessage
  | PongMessage
  | SubmitQuizMessage
  | SubmitPlacementMessage
  | PassVetoMessage
  | SubmitVetoPlacementMessage
  | ClaimTeamLeaderMessage
  | SubmitQuizSuggestionMessage
  | SubmitPlacementSuggestionMessage
  | SubmitVetoSuggestionMessage;

export interface JoinMessage {
  type: 'join';
  payload: {
    playerName: string;
    sessionId: string;
    team?: 'A' | 'B';
  };
}

export interface LeaveMessage {
  type: 'leave';
  payload: Record<string, never>;
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

export interface PlayerReadyMessage {
  type: 'player_ready';
  payload: {
    playerId: string;
  };
}

export interface SubmitAnswerMessage {
  type: 'submit_answer';
  payload: {
    artist: string;
    title: string;
    year: number;
    submittedBy: string;
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

export interface SubmitQuizMessage {
  type: 'submit_quiz';
  payload: {
    artistIndex: number;
    titleIndex: number;
  };
}

export interface SubmitPlacementMessage {
  type: 'submit_placement';
  payload: {
    position: number;
  };
}

export interface PassVetoMessage {
  type: 'pass_veto';
}

export interface SubmitVetoPlacementMessage {
  type: 'submit_veto_placement';
  payload: {
    position: number;
  };
}

// Team Leader Messages - Client to Server
export interface ClaimTeamLeaderMessage {
  type: 'claim_team_leader';
  payload: Record<string, never>;  // No payload needed - uses session
}

export interface SubmitQuizSuggestionMessage {
  type: 'submit_quiz_suggestion';
  payload: {
    artistIndex: number | null;
    titleIndex: number | null;
  };
}

export interface SubmitPlacementSuggestionMessage {
  type: 'submit_placement_suggestion';
  payload: {
    position: number | null;
  };
}

export interface SubmitVetoSuggestionMessage {
  type: 'submit_veto_suggestion';
  payload: {
    useVeto: boolean | null;
  };
}

/**
 * Server -> Client messages
 */
export type ServerMessage =
  | StateSyncMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerReconnectedMessage
  | PlayerReadyNotificationMessage
  | QRScanDetectedMessage
  | TeamChangedMessage
  | SettingsUpdatedMessage
  | GameStartedMessage
  | RoundStartedMessage
  | TypingUpdateMessage
  | AnswerSubmittedMessage
  | VetoInitiatedMessage
  | RoundResultMessage
  | GameOverMessage
  | ErrorMessage
  | PingMessage
  | PhaseChangedMessage
  | QuizResultMessage
  | PlacementSubmittedMessage
  | VetoWindowOpenMessage
  | VetoDecisionMessage
  | NewRoundResultMessage
  | GameWonMessage
  | LeaderClaimedMessage
  | TeammateQuizVoteMessage
  | TeammatePlacementVoteMessage
  | TeammateVetoVoteMessage;

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

export interface PlayerReadyNotificationMessage {
  type: 'player_ready_notification';
  payload: {
    playerId: string;
    playerName: string;
    readyAt: number;
  };
}

export interface QRScanDetectedMessage {
  type: 'qr_scan_detected';
  payload: {
    scannedAt: number;
    userAgent?: string;
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

export interface GameStartedMessage {
  type: 'game_started';
  payload: Record<string, never>;
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

export interface PhaseChangedMessage {
  type: 'phase_changed';
  payload: {
    phase: string;
    quizOptions?: QuizOptions;
    endsAt: number;
  };
}

export interface QuizResultMessage {
  type: 'quiz_result';
  payload: {
    correct: boolean;
    earnedToken: boolean;
    correctArtist: string;
    correctTitle: string;
  };
}

export interface PlacementSubmittedMessage {
  type: 'placement_submitted';
  payload: {
    teamId: 'A' | 'B';
    position: number;
    timelineSongCount: number;
  };
}

export interface VetoWindowOpenMessage {
  type: 'veto_window_open';
  payload: {
    vetoTeamId: 'A' | 'B';
    activeTeamPlacement: number;
    tokensAvailable: number;
    endsAt: number;
  };
}

export interface VetoDecisionMessage {
  type: 'veto_decision';
  payload: {
    used: boolean;
    vetoTeamId: 'A' | 'B';
  };
}

export interface NewRoundResultMessage {
  type: 'new_round_result';
  payload: {
    song: Song;
    correctYear: number;
    activeTeamPlacement: number;
    activeTeamCorrect: boolean;
    vetoUsed: boolean;
    vetoTeamPlacement?: number;
    vetoTeamCorrect?: boolean;
    songAddedTo: 'A' | 'B' | null;
    updatedTeams: {
      A: { timeline: TimelineSong[]; tokens: number };
      B: { timeline: TimelineSong[]; tokens: number };
    };
  };
}

export interface GameWonMessage {
  type: 'game_won';
  payload: {
    winner: 'A' | 'B';
    finalTeams: {
      A: { timeline: TimelineSong[]; tokens: number };
      B: { timeline: TimelineSong[]; tokens: number };
    };
  };
}

// Team Leader Messages - Server to Client
export interface LeaderClaimedMessage {
  type: 'leader_claimed';
  payload: {
    team: 'A' | 'B';
    playerId: string;
    playerName: string;
  };
}

export interface TeammateQuizVoteMessage {
  type: 'teammate_quiz_vote';
  payload: TeammateQuizVote;
}

export interface TeammatePlacementVoteMessage {
  type: 'teammate_placement_vote';
  payload: TeammatePlacementVote;
}

export interface TeammateVetoVoteMessage {
  type: 'teammate_veto_vote';
  payload: TeammateVetoVote;
}

export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'INVALID_JSON'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'HANDLER_ERROR'
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

export interface ErrorPayload {
  code: string;
  message: string;
}

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
