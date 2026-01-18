import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TeamAssignment } from '../components/TeamAssignment';

const mockTeamA = {
  name: 'Team A',
  players: [
    { id: '1', sessionId: 's1', name: 'Alice', team: 'A' as const, connected: true, lastSeen: Date.now(), isTeamLeader: true },
    { id: '2', sessionId: 's2', name: 'Bob', team: 'A' as const, connected: true, lastSeen: Date.now(), isTeamLeader: false },
  ],
  timeline: [],
  tokens: 3,
  score: 0,
};

const mockTeamB = {
  name: 'Team B',
  players: [
    { id: '3', sessionId: 's3', name: 'Charlie', team: 'B' as const, connected: true, lastSeen: Date.now(), isTeamLeader: true },
  ],
  timeline: [],
  tokens: 3,
  score: 0,
};

describe('TeamAssignment', () => {
  it('renders assigned team name', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    expect(screen.getByText(/team a/i)).toBeInTheDocument();
  });

  it('shows team color indicator', () => {
    const { container } = render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    // Team A should have team-a color class
    const teamIndicator = container.querySelector('[class*="bg-team-a"]');
    expect(teamIndicator).toBeInTheDocument();
  });

  it('lists teammates', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('highlights current player name', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    const aliceElement = screen.getByText('Alice');
    expect(aliceElement.closest('[class*="font-bold"]') || aliceElement).toHaveClass('font-bold');
  });

  it('displays waiting for game start message', () => {
    render(
      <TeamAssignment
        assignedTeam="A"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Alice"
      />
    );

    expect(screen.getByText(/waiting for host to start/i)).toBeInTheDocument();
  });

  it('shows Team B styling when assigned to Team B', () => {
    const { container } = render(
      <TeamAssignment
        assignedTeam="B"
        teamA={mockTeamA}
        teamB={mockTeamB}
        playerName="Charlie"
      />
    );

    // Team B should have team-b color class
    const teamIndicator = container.querySelector('[class*="bg-team-b"]');
    expect(teamIndicator).toBeInTheDocument();
  });
});
