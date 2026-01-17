// apps/host/src/__tests__/RoundResult.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoundResult, ValidationResult } from '../components/RoundResult';
import type { Song } from '@party-popper/shared';

describe('RoundResult', () => {
  const mockSong: Song = {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    year: 1975,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  const mockValidation: ValidationResult = {
    artistCorrect: true,
    titleCorrect: true,
    yearScore: 1,
    totalScore: 3
  };

  it('should reveal correct answer dramatically', () => {
    render(
      <RoundResult
        song={mockSong}
        validation={mockValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('1975')).toBeInTheDocument();
  });

  it('should show points awarded with animation', () => {
    render(
      <RoundResult
        song={mockSong}
        validation={mockValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByTestId('points-animation')).toHaveClass('animate-bounce');
  });

  it('should indicate which parts were correct', () => {
    const partialValidation: ValidationResult = {
      artistCorrect: true,
      titleCorrect: false,
      yearScore: 0.5,
      totalScore: 1.5
    };

    render(
      <RoundResult
        song={mockSong}
        validation={partialValidation}
        teamName="Team Alpha"
      />
    );

    const artistBadge = screen.getByTestId('result-artist');
    const titleBadge = screen.getByTestId('result-title');
    const yearBadge = screen.getByTestId('result-year');

    expect(artistBadge).toHaveClass('bg-green-500');
    expect(titleBadge).toHaveClass('bg-red-500');
    expect(yearBadge).toHaveClass('bg-yellow-500');
  });

  it('should show song added message when points scored', () => {
    render(
      <RoundResult
        song={mockSong}
        validation={mockValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText(/added to timeline/i)).toBeInTheDocument();
  });

  it('should show no points message when zero scored', () => {
    const zeroValidation: ValidationResult = {
      artistCorrect: false,
      titleCorrect: false,
      yearScore: 0,
      totalScore: 0
    };

    render(
      <RoundResult
        song={mockSong}
        validation={zeroValidation}
        teamName="Team Alpha"
      />
    );

    expect(screen.getByText(/no points/i)).toBeInTheDocument();
  });
});
