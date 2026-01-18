// apps/host/src/__tests__/VictoryScreen.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VictoryScreen } from '../components/VictoryScreen';

describe('VictoryScreen', () => {
  const mockTimeline = [
    { id: '1', title: 'Song 1', artist: 'Artist 1', year: 1985, spotifyUri: '', spotifyUrl: '', pointsEarned: 2, addedAt: Date.now() },
    { id: '2', title: 'Song 2', artist: 'Artist 2', year: 1990, spotifyUri: '', spotifyUrl: '', pointsEarned: 3, addedAt: Date.now() }
  ];

  it('should display winning team prominently', () => {
    render(
      <VictoryScreen
        winnerName="The Champions"
        winnerTeam="A"
        teamAScore={10}
        teamBScore={7}
        teamATimeline={mockTimeline}
        teamBTimeline={[]}
      />
    );

    expect(screen.getByText('The Champions')).toBeInTheDocument();
    expect(screen.getByText(/winner/i)).toBeInTheDocument();
  });

  it('should show final scores', () => {
    render(
      <VictoryScreen
        winnerName="Team A"
        winnerTeam="A"
        teamAScore={10}
        teamBScore={7}
        teamATimeline={mockTimeline}
        teamBTimeline={[]}
      />
    );

    expect(screen.getByTestId('final-score-a')).toHaveTextContent('10');
    expect(screen.getByTestId('final-score-b')).toHaveTextContent('7');
  });

  it('should display timelines for both teams', () => {
    render(
      <VictoryScreen
        winnerName="Team A"
        winnerTeam="A"
        teamAScore={2}
        teamBScore={1}
        teamATimeline={mockTimeline}
        teamBTimeline={[mockTimeline[0]]}
      />
    );

    // Song 1 appears in both timelines (2 instances)
    expect(screen.getAllByText('Song 1')).toHaveLength(2);
    expect(screen.getByText('Song 2')).toBeInTheDocument();
  });

  it('should have confetti/celebration class', () => {
    render(
      <VictoryScreen
        winnerName="Team A"
        winnerTeam="A"
        teamAScore={10}
        teamBScore={7}
        teamATimeline={[]}
        teamBTimeline={[]}
      />
    );

    expect(screen.getByTestId('victory-screen')).toHaveClass('victory-celebration');
  });
});
