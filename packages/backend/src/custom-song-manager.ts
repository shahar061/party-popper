// packages/backend/src/custom-song-manager.ts
import type { Song } from '@party-popper/shared';

interface CustomSongInput {
  title: string;
  artist: string;
  year: number;
  spotifyId: string;
}

export class CustomSongManager {
  private songs: Song[] = [];
  private idCounter = 0;

  addSong(input: CustomSongInput): Song {
    const spotifyId = this.extractSpotifyId(input.spotifyId);
    this.validateSpotifyId(spotifyId);
    this.validateYear(input.year);

    const song: Song = {
      id: `custom-${++this.idCounter}`,
      title: input.title.trim(),
      artist: input.artist.trim(),
      year: input.year,
      spotifyUri: `spotify:track:${spotifyId}`,
      spotifyUrl: `https://open.spotify.com/track/${spotifyId}`
    };

    this.songs.push(song);
    return song;
  }

  private extractSpotifyId(input: string): string {
    const urlMatch = input.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    return input;
  }

  private validateSpotifyId(id: string): void {
    const validPattern = /^[a-zA-Z0-9]{15,25}$/;
    if (!validPattern.test(id)) {
      throw new Error('Invalid Spotify ID format');
    }
  }

  private validateYear(year: number): void {
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear + 1) {
      throw new Error('Invalid year');
    }
  }

  removeSong(id: string): void {
    this.songs = this.songs.filter(song => song.id !== id);
  }

  getSongPool(): Song[] {
    return [...this.songs];
  }

  hasMinimumSongs(minimum: number): boolean {
    return this.songs.length >= minimum;
  }

  clear(): void {
    this.songs = [];
    this.idCounter = 0;
  }
}
