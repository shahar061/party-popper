// apps/host/src/__tests__/TiebreakerScreen.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TiebreakerScreen } from '../components/TiebreakerScreen';

describe('TiebreakerScreen', () => {
  const mockSong = {
    id: 'tie-1',
    title: 'Tiebreaker Song',
    artist: 'Artist',
    year: 1990,
    spotifyUri: 'spotify:track:123',
    spotifyUrl: 'https://open.spotify.com/track/123'
  };

  it('should highlight both teams as active', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={false}
        teamBSubmitted={false}
      />
    );

    expect(screen.getByTestId('team-a-panel')).toHaveClass('border-blue-500');
    expect(screen.getByTestId('team-b-panel')).toHaveClass('border-orange-500');
  });

  it('should show race-style UI with both answer areas', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={false}
        teamBSubmitted={false}
      />
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText(/tiebreaker/i)).toBeInTheDocument();
  });

  it('should show submitted indicator when team submits', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={true}
        teamBSubmitted={false}
      />
    );

    expect(screen.getByTestId('team-a-submitted')).toBeInTheDocument();
    expect(screen.queryByTestId('team-b-submitted')).not.toBeInTheDocument();
  });

  it('should show winner announcement when complete', () => {
    render(
      <TiebreakerScreen
        song={mockSong}
        teamAName="Alpha"
        teamBName="Beta"
        teamASubmitted={true}
        teamBSubmitted={true}
        winner="A"
      />
    );

    expect(screen.getByText(/Alpha wins/i)).toBeInTheDocument();
  });
});
