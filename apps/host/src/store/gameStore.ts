import { create } from 'zustand';
import type { GameState, Player, GameSettings, GameStatus } from '@party-popper/shared';

type TeamId = 'A' | 'B';

interface GameStoreState {
  game: GameState | null;
  syncState: (state: GameState) => void;
  addPlayer: (player: Player, team: TeamId) => void;
  removePlayer: (playerId: string) => void;
  movePlayer: (playerId: string, toTeam: TeamId) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  setStatus: (status: GameStatus) => void;
  setMode: (mode: 'classic' | 'custom') => void;
  reset: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  game: null,

  syncState: (state) => set({ game: state }),

  addPlayer: (player, team) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: {
          ...state.game,
          teams: {
            ...state.game.teams,
            [team]: {
              ...state.game.teams[team],
              players: [...state.game.teams[team].players, player],
            },
          },
        },
      };
    }),

  removePlayer: (playerId) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: {
          ...state.game,
          teams: {
            A: {
              ...state.game.teams.A,
              players: state.game.teams.A.players.filter((p) => p.id !== playerId),
            },
            B: {
              ...state.game.teams.B,
              players: state.game.teams.B.players.filter((p) => p.id !== playerId),
            },
          },
        },
      };
    }),

  movePlayer: (playerId, toTeam) =>
    set((state) => {
      if (!state.game) return state;

      const fromTeam: TeamId = state.game.teams.A.players.some((p) => p.id === playerId)
        ? 'A'
        : 'B';

      if (fromTeam === toTeam) return state;

      const player = state.game.teams[fromTeam].players.find((p) => p.id === playerId);
      if (!player) return state;

      return {
        game: {
          ...state.game,
          teams: {
            ...state.game.teams,
            [fromTeam]: {
              ...state.game.teams[fromTeam],
              players: state.game.teams[fromTeam].players.filter((p) => p.id !== playerId),
            },
            [toTeam]: {
              ...state.game.teams[toTeam],
              players: [...state.game.teams[toTeam].players, player],
            },
          },
        },
      };
    }),

  updateSettings: (settings) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: {
          ...state.game,
          settings: { ...state.game.settings, ...settings },
        },
      };
    }),

  setStatus: (status) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: { ...state.game, status },
      };
    }),

  setMode: (mode) =>
    set((state) => {
      if (!state.game) return state;
      return {
        game: { ...state.game, mode },
      };
    }),

  reset: () => set({ game: null }),
}));
