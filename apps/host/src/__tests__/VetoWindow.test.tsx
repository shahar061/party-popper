// apps/host/src/__tests__/VetoWindow.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VetoWindow } from '../components/VetoWindow';

describe('VetoWindow', () => {
  it('should render veto window overlay', () => {
    render(
      <VetoWindow
        remainingTime={15000}
        vetoingTeam="B"
        isActive={true}
      />
    );

    expect(screen.getByTestId('veto-window')).toBeInTheDocument();
  });

  it('should show countdown timer', () => {
    render(
      <VetoWindow
        remainingTime={10000}
        vetoingTeam="B"
        isActive={true}
      />
    );

    expect(screen.getByTestId('veto-countdown')).toHaveTextContent('10');
  });

  it('should show which team can veto', () => {
    render(
      <VetoWindow
        remainingTime={15000}
        vetoingTeam="B"
        teamBName="The Challengers"
        isActive={true}
      />
    );

    expect(screen.getByText(/The Challengers/)).toBeInTheDocument();
    expect(screen.getByText(/can challenge/i)).toBeInTheDocument();
  });

  it('should have dramatic tension animation', () => {
    render(
      <VetoWindow
        remainingTime={5000}
        vetoingTeam="B"
        isActive={true}
      />
    );

    const countdown = screen.getByTestId('veto-countdown');
    expect(countdown).toHaveClass('animate-pulse');
  });

  it('should not render when inactive', () => {
    render(
      <VetoWindow
        remainingTime={15000}
        vetoingTeam="B"
        isActive={false}
      />
    );

    expect(screen.queryByTestId('veto-window')).not.toBeInTheDocument();
  });
});
