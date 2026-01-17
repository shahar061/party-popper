// apps/host/src/__tests__/ScoreBoard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBoard } from '../components/ScoreBoard';

describe('ScoreBoard', () => {
  it('should show score prominently for each team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should highlight active team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    const teamASection = screen.getByTestId('score-team-a');
    expect(teamASection).toHaveClass('ring-4');
  });

  it('should show turn indicator arrow for active team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="B"
        targetScore={10}
      />
    );

    const turnIndicator = screen.getByTestId('turn-indicator-b');
    expect(turnIndicator).toBeInTheDocument();
  });

  it('should show target score', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('should apply glow effect to active team', () => {
    render(
      <ScoreBoard
        teamAScore={5}
        teamBScore={3}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        activeTeam="A"
        targetScore={10}
      />
    );

    const teamASection = screen.getByTestId('score-team-a');
    expect(teamASection).toHaveClass('shadow-glow');
  });
});
