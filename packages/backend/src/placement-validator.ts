import type { TimelineSong } from '@party-popper/shared';

/**
 * Validates if a song placement is correct.
 * Position 0 means before the first song, position N means after the Nth song.
 */
export function validatePlacement(
  timeline: TimelineSong[],
  songYear: number,
  position: number
): boolean {
  // Empty timeline - any position 0 is correct
  if (timeline.length === 0) {
    return position === 0;
  }

  // Get the years of songs before and after the position
  const yearBefore = position > 0 ? timeline[position - 1].year : -Infinity;
  const yearAfter = position < timeline.length ? timeline[position].year : Infinity;

  // Song year must be >= year before and <= year after
  return songYear >= yearBefore && songYear <= yearAfter;
}

/**
 * Gets the correct position for a song in the timeline.
 * Returns the index where the song should be inserted.
 */
export function getCorrectPosition(timeline: TimelineSong[], songYear: number): number {
  if (timeline.length === 0) {
    return 0;
  }

  // Find first song with year > songYear
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].year > songYear) {
      return i;
    }
  }

  // Song is after all existing songs
  return timeline.length;
}
