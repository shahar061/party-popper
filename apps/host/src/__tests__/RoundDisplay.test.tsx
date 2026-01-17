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
    phase: 'guessing',
    startedAt: now,
    endsAt: now + 60000,
    currentAnswer: null,
    typingState: null,
    vetoChallenge: null
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render QR code with Spotify deeplink', () => {
    render(<RoundDisplay round={mockRound} gameCode="TEST" />);

    const qrCode = screen.getByTestId('song-qr-code');
    expect(qrCode).toBeInTheDocument();
  });

  it('should show timer countdown', () => {
    render(<RoundDisplay round={mockRound} gameCode="TEST" />);

    expect(screen.getByTestId('round-timer')).toBeInTheDocument();
  });

  it('should hide song details during guessing phase', () => {
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

  it('should format timer correctly', () => {
    render(<RoundDisplay round={mockRound} gameCode="TEST" />);

    // Timer should show 1:00 initially
    expect(screen.getByTestId('round-timer')).toHaveTextContent('1:00');
  });
});
