import type { GameState, Player, Round, Answer, TypingState, RoundResult, GameSettings } from './types';

/**
 * Client -> Server message types
 */
export type ClientMessageType =
  | 'join'
  | 'leave'
  | 'reconnect'
  | 'start_game'
  | 'submit_answer'
  | 'use_veto'
  | 'typing'
  | 'next_round'
  | 'reassign_team'
  | 'update_settings'
  | 'pong';

/**
 * Client -> Server messages
 */
export type ClientMessage =
  | JoinMessage
  | LeaveMessage
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
  | GameStartedMessage
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
