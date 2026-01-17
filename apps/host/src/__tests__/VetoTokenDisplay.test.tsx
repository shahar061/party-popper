// apps/host/src/__tests__/VetoTokenDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VetoTokenDisplay } from '../components/VetoTokenDisplay';

describe('VetoTokenDisplay', () => {
  it('should show 3 token icons per team', () => {
    render(<VetoTokenDisplay teamATokens={3} teamBTokens={3} />);

    const teamATokens = screen.getAllByTestId(/team-a-token/);
    const teamBTokens = screen.getAllByTestId(/team-b-token/);

    expect(teamATokens).toHaveLength(3);
    expect(teamBTokens).toHaveLength(3);
  });

  it('should dim used tokens', () => {
    render(<VetoTokenDisplay teamATokens={1} teamBTokens={2} />);

    const teamATokens = screen.getAllByTestId(/team-a-token/);

    expect(teamATokens[0]).toHaveClass('opacity-100');
    expect(teamATokens[1]).toHaveClass('opacity-30');
    expect(teamATokens[2]).toHaveClass('opacity-30');
  });

  it('should show team names', () => {
    render(
      <VetoTokenDisplay
        teamATokens={3}
        teamBTokens={3}
        teamAName="Alpha"
        teamBName="Beta"
      />
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('should show remaining count', () => {
    render(<VetoTokenDisplay teamATokens={2} teamBTokens={1} />);

    expect(screen.getByTestId('team-a-count')).toHaveTextContent('2');
    expect(screen.getByTestId('team-b-count')).toHaveTextContent('1');
  });
});
