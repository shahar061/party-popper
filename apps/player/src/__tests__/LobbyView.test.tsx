import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LobbyView } from '../components/LobbyView';

const mockTeamA = {
  name: 'Team A',
  players: [
    { id: '1', sessionId: 's1', name: 'Alice', team: 'A' as const, connected: true, lastSeen: Date.now() },
    { id: '2', sessionId: 's2', name: 'Bob', team: 'A' as const, connected: true, lastSeen: Date.now() },
  ],
  timeline: [],
  tokens: 3,
  score: 0,
};

const mockTeamB = {
  name: 'Team B',
  players: [
    { id: '3', sessionId: 's3', name: 'Charlie', team: 'B' as const, connected: true, lastSeen: Date.now() },
    { id: '4', sessionId: 's4', name: 'Diana', team: 'B' as const, connected: false, lastSeen: Date.now() - 60000 },
  ],
  timeline: [],
  tokens: 3,
  score: 0,
};

describe('LobbyView', () => {
  it('renders both team columns', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Team B')).toBeInTheDocument();
  });

  it('shows all players from both teams', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('shows connection status indicators', () => {
    const { container } = render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    // Should have green dots for connected players
    const greenDots = container.querySelectorAll('.bg-green-500');
    expect(greenDots.length).toBe(3); // Alice, Bob, Charlie

    // Should have gray/muted dot for disconnected Diana
    const grayDots = container.querySelectorAll('.bg-game-muted');
    expect(grayDots.length).toBe(1);
  });

  it('updates when players join or leave', () => {
    const { rerender } = render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.queryByText('Eve')).not.toBeInTheDocument();

    const updatedTeamA = {
      ...mockTeamA,
      players: [
        ...mockTeamA.players,
        { id: '5', sessionId: 's5', name: 'Eve', team: 'A' as const, connected: true, lastSeen: Date.now() },
      ],
    };

    rerender(
      <LobbyView
        teamA={updatedTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('displays game code', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
      />
    );

    expect(screen.getByText('ABCD')).toBeInTheDocument();
  });

  it('shows game starting indicator when isStarting is true', () => {
    render(
      <LobbyView
        teamA={mockTeamA}
        teamB={mockTeamB}
        currentPlayerId="1"
        gameCode="ABCD"
        isStarting={true}
      />
    );

    expect(screen.getByText(/game is starting/i)).toBeInTheDocument();
  });
});
