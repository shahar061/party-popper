// apps/player/src/__tests__/TurnStatus.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TurnStatus } from '../components/TurnStatus';

describe('TurnStatus', () => {
  it('should show active state when it is teams turn', () => {
    render(<TurnStatus isMyTurn={true} teamName="Team Alpha" />);

    expect(screen.getByText(/your turn/i)).toBeInTheDocument();
    expect(screen.getByTestId('turn-status')).toHaveClass('bg-green-500');
  });

  it('should show waiting state when it is not teams turn', () => {
    render(<TurnStatus isMyTurn={false} teamName="Team Alpha" />);

    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    expect(screen.getByTestId('turn-status')).toHaveClass('bg-gray-600');
  });

  it('should display team name', () => {
    render(<TurnStatus isMyTurn={true} teamName="Team Alpha" />);

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
  });

  it('should have visual distinction between states', () => {
    const { rerender } = render(<TurnStatus isMyTurn={true} teamName="Team A" />);
    const activeClassName = screen.getByTestId('turn-status').className;

    rerender(<TurnStatus isMyTurn={false} teamName="Team A" />);
    const waitingClassName = screen.getByTestId('turn-status').className;

    expect(activeClassName).not.toBe(waitingClassName);
  });

  it('should show opponent team name when waiting', () => {
    render(
      <TurnStatus
        isMyTurn={false}
        teamName="Team Alpha"
        opponentTeamName="Team Beta"
      />
    );

    expect(screen.getByText(/Team Beta/)).toBeInTheDocument();
  });
});
