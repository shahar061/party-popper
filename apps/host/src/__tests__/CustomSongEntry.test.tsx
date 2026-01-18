// apps/host/src/__tests__/CustomSongEntry.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomSongEntry } from '../components/CustomSongEntry';

describe('CustomSongEntry', () => {
  it('should show input form for song details', () => {
    render(
      <CustomSongEntry
        songs={[]}
        onAddSong={vi.fn()}
        onRemoveSong={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/spotify url/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/artist/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/year/i)).toBeInTheDocument();
  });

  it('should call onAddSong when form is submitted', () => {
    const onAddSong = vi.fn();
    render(
      <CustomSongEntry
        songs={[]}
        onAddSong={onAddSong}
        onRemoveSong={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/spotify url/i), {
      target: { value: 'https://open.spotify.com/track/123' }
    });
    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: 'Queen' } });
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Bohemian Rhapsody' } });
    fireEvent.change(screen.getByPlaceholderText(/year/i), { target: { value: '1975' } });
    fireEvent.click(screen.getByRole('button', { name: /add song/i }));

    expect(onAddSong).toHaveBeenCalledWith({
      spotifyUrl: 'https://open.spotify.com/track/123',
      artist: 'Queen',
      title: 'Bohemian Rhapsody',
      year: '1975'
    });
  });

  it('should display song list', () => {
    const songs = [
      { id: '1', title: 'Song 1', artist: 'Artist 1', year: 1985, spotifyUri: '', spotifyUrl: '' },
      { id: '2', title: 'Song 2', artist: 'Artist 2', year: 1990, spotifyUri: '', spotifyUrl: '' }
    ];

    render(
      <CustomSongEntry
        songs={songs}
        onAddSong={vi.fn()}
        onRemoveSong={vi.fn()}
      />
    );

    expect(screen.getByText('Song 1')).toBeInTheDocument();
    expect(screen.getByText('Song 2')).toBeInTheDocument();
  });

  it('should have delete button for each song', () => {
    const songs = [
      { id: '1', title: 'Song 1', artist: 'Artist 1', year: 1985, spotifyUri: '', spotifyUrl: '' }
    ];

    render(
      <CustomSongEntry
        songs={songs}
        onAddSong={vi.fn()}
        onRemoveSong={vi.fn()}
      />
    );

    expect(screen.getByTestId('delete-song-1')).toBeInTheDocument();
  });

  it('should call onRemoveSong when delete is clicked', () => {
    const onRemoveSong = vi.fn();
    const songs = [
      { id: '1', title: 'Song 1', artist: 'Artist 1', year: 1985, spotifyUri: '', spotifyUrl: '' }
    ];

    render(
      <CustomSongEntry
        songs={songs}
        onAddSong={vi.fn()}
        onRemoveSong={onRemoveSong}
      />
    );

    fireEvent.click(screen.getByTestId('delete-song-1'));
    expect(onRemoveSong).toHaveBeenCalledWith('1');
  });

  it('should show minimum songs warning', () => {
    render(
      <CustomSongEntry
        songs={[]}
        onAddSong={vi.fn()}
        onRemoveSong={vi.fn()}
        minimumSongs={5}
      />
    );

    // Text is split across elements: "0" in span, "of 5" in text
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/of 5 songs/)).toBeInTheDocument();
  });
});
