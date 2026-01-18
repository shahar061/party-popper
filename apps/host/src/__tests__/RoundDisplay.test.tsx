// apps/host/src/__tests__/RoundDisplay.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoundDisplay } from '../components/RoundDisplay';
import type { Round } from '@party-popper/shared';

describe('RoundDisplay', () => {
  const now = Date.now();

  const mockRound: Round = {
    number: 1,
    song: {
      id: 'song-1',
      title: 'Hidden Song',
      artist: 'Hidden Artist',
      year: 1985,
      spotifyUri: 'spotify:track:abc123',
      spotifyUrl: 'https://open.spotify.com/track/abc123'
    },
    activeTeam: 'A',
    phase: 'quiz',
    startedAt: now,
    endsAt: now + 60000,
    currentAnswer: null,
    typingState: null,
    vetoChallenge: null
  };

  const listeningRound: Round = {
    ...mockRound,
    phase: 'listening'
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render QR code with Spotify deeplink in listening phase', () => {
    render(<RoundDisplay round={listeningRound} gameCode="TEST" />);

    const qrCode = screen.getByTestId('song-qr-code');
    expect(qrCode).toBeInTheDocument();
  });

  it('should show timer countdown', () => {
    render(<RoundDisplay round={mockRound} gameCode="TEST" />);

    expect(screen.getByTestId('round-timer')).toBeInTheDocument();
  });

  it('should hide song details during quiz phase', () => {
    render(<RoundDisplay round={mockRound} gameCode="TEST" />);

    expect(screen.queryByText('Hidden Song')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden Artist')).not.toBeInTheDocument();
  });

  it('should show song details during reveal phase', () => {
    const revealRound: Round = { ...mockRound, phase: 'reveal' };
    render(<RoundDisplay round={revealRound} gameCode="TEST" />);

    expect(screen.getByText('Hidden Song')).toBeInTheDocument();
    expect(screen.getByText('Hidden Artist')).toBeInTheDocument();
    expect(screen.getByText('1985')).toBeInTheDocument();
  });

  it('should display active team name', () => {
    render(<RoundDisplay round={mockRound} teamName="Team Alpha" gameCode="TEST" />);

    expect(screen.getByText(/Team Alpha/)).toBeInTheDocument();
  });

  it('should format timer correctly in quiz phase', () => {
    render(<RoundDisplay round={mockRound} gameCode="TEST" />);

    // Timer should show 1:00 initially in quiz phase (not waiting for scan)
    expect(screen.getByTestId('round-timer')).toHaveTextContent('1:00');
  });

  it('should show waiting for scan in listening phase before timer starts', () => {
    // Create a round with endsAt far in the future (timer not started)
    const waitingRound: Round = {
      ...listeningRound,
      endsAt: now + 10 * 60 * 1000 // 10 minutes in future
    };
    render(<RoundDisplay round={waitingRound} gameCode="TEST" />);

    expect(screen.getByTestId('round-timer')).toHaveTextContent('Waiting for scan...');
  });
});
