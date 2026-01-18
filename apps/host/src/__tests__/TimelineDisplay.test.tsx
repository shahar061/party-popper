// apps/host/src/__tests__/TimelineDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineDisplay } from '../components/TimelineDisplay';
import type { TimelineSong } from '@party-popper/shared';

describe('TimelineDisplay', () => {
  const createTimelineSong = (year: number, title: string, artist: string): TimelineSong => ({
    id: `song-${year}`,
    title,
    artist,
    year,
    spotifyUri: `spotify:track:${year}`,
    spotifyUrl: `https://open.spotify.com/track/${year}`,
    pointsEarned: 2,
    addedAt: Date.now()
  });

  const teamATimeline: TimelineSong[] = [
    createTimelineSong(1975, 'Bohemian Rhapsody', 'Queen'),
    createTimelineSong(1985, 'Take On Me', 'a-ha'),
  ];

  const teamBTimeline: TimelineSong[] = [
    createTimelineSong(1980, 'Another One Bites the Dust', 'Queen'),
  ];

  it('should render two columns for teams', () => {
    render(
      <TimelineDisplay
        teamATimeline={teamATimeline}
        teamBTimeline={teamBTimeline}
        teamAName="Team Alpha"
        teamBName="Team Beta"
        teamATokens={2}
        teamBTokens={1}
      />
    );

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
  });

  it('should display songs in chronological order', () => {
    render(
      <TimelineDisplay
        teamATimeline={teamATimeline}
        teamBTimeline={teamBTimeline}
        teamAName="Team A"
        teamBName="Team B"
        teamATokens={0}
        teamBTokens={0}
      />
    );

    const teamAColumn = screen.getByTestId('timeline-team-a');
    const songs = teamAColumn.querySelectorAll('[data-testid="timeline-song"]');

    expect(songs[0]).toHaveTextContent('1975');
    expect(songs[1]).toHaveTextContent('1985');
  });

  it('should show year, title, and artist for each song', () => {
    render(
      <TimelineDisplay
        teamATimeline={teamATimeline}
        teamBTimeline={teamBTimeline}
        teamAName="Team A"
        teamBName="Team B"
        teamATokens={0}
        teamBTokens={0}
      />
    );

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getAllByText('Queen').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1975')).toBeInTheDocument();
  });

  it('should show empty state when timeline is empty', () => {
    render(
      <TimelineDisplay
        teamATimeline={[]}
        teamBTimeline={[]}
        teamAName="Team A"
        teamBName="Team B"
        teamATokens={0}
        teamBTokens={0}
      />
    );

    expect(screen.getAllByText('No songs yet')).toHaveLength(2);
  });
});
