import { describe, it, expect } from 'vitest';
import { RoundPhaseManager, PHASE_DURATIONS } from '../round-phase-manager';
import type { GameSettings } from '@party-popper/shared';

describe('RoundPhaseManager', () => {
  const settings: GameSettings = {
    targetScore: 10,
    quizTimeSeconds: 45,
    placementTimeSeconds: 20,
    vetoWindowSeconds: 10,
    vetoPlacementSeconds: 15,
  };

  describe('getNextPhase', () => {
    it('listening -> quiz', () => {
      expect(RoundPhaseManager.getNextPhase('listening')).toBe('quiz');
    });

    it('quiz -> placement', () => {
      expect(RoundPhaseManager.getNextPhase('quiz')).toBe('placement');
    });

    it('placement -> veto_window', () => {
      expect(RoundPhaseManager.getNextPhase('placement')).toBe('veto_window');
    });

    it('veto_window -> veto_placement when veto used', () => {
      expect(RoundPhaseManager.getNextPhase('veto_window', true)).toBe('veto_placement');
    });

    it('veto_window -> reveal when veto not used', () => {
      expect(RoundPhaseManager.getNextPhase('veto_window', false)).toBe('reveal');
    });

    it('veto_placement -> reveal', () => {
      expect(RoundPhaseManager.getNextPhase('veto_placement')).toBe('reveal');
    });

    it('reveal -> null (end of round)', () => {
      expect(RoundPhaseManager.getNextPhase('reveal')).toBeNull();
    });
  });

  describe('getPhaseDuration', () => {
    it('returns correct quiz duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('quiz', settings)).toBe(45000);
    });

    it('returns correct placement duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('placement', settings)).toBe(20000);
    });

    it('returns correct veto_window duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('veto_window', settings)).toBe(10000);
    });

    it('returns correct veto_placement duration', () => {
      expect(RoundPhaseManager.getPhaseDuration('veto_placement', settings)).toBe(15000);
    });

    it('returns 0 for listening phase', () => {
      expect(RoundPhaseManager.getPhaseDuration('listening', settings)).toBe(0);
    });

    it('returns 0 for reveal phase', () => {
      expect(RoundPhaseManager.getPhaseDuration('reveal', settings)).toBe(0);
    });
  });
});
