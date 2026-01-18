import type { GameSettings, NewRoundPhase } from '@party-popper/shared';

export const PHASE_DURATIONS = {
  listening: 0,  // No timer - waits for QR scan
  quiz: 'quizTimeSeconds',
  placement: 'placementTimeSeconds',
  veto_window: 'vetoWindowSeconds',
  veto_placement: 'vetoPlacementSeconds',
  reveal: 0,  // No timer - host advances
} as const;

export class RoundPhaseManager {
  /**
   * Get the next phase in the round sequence.
   * @param currentPhase Current phase
   * @param vetoUsed Whether veto was used (only relevant for veto_window)
   * @returns Next phase or null if round is complete
   */
  static getNextPhase(
    currentPhase: NewRoundPhase,
    vetoUsed?: boolean
  ): NewRoundPhase | null {
    switch (currentPhase) {
      case 'listening':
        return 'quiz';
      case 'quiz':
        return 'placement';
      case 'placement':
        return 'veto_window';
      case 'veto_window':
        return vetoUsed ? 'veto_placement' : 'reveal';
      case 'veto_placement':
        return 'reveal';
      case 'reveal':
        return null;
      default:
        return null;
    }
  }

  /**
   * Get the duration of a phase in milliseconds.
   */
  static getPhaseDuration(phase: NewRoundPhase, settings: GameSettings): number {
    switch (phase) {
      case 'quiz':
        return settings.quizTimeSeconds * 1000;
      case 'placement':
        return settings.placementTimeSeconds * 1000;
      case 'veto_window':
        return settings.vetoWindowSeconds * 1000;
      case 'veto_placement':
        return settings.vetoPlacementSeconds * 1000;
      default:
        return 0;
    }
  }
}
