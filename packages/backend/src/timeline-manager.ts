// packages/backend/src/timeline-manager.ts
import type { Song, TimelineSong } from '@party-popper/shared';

export class TimelineManager {
  addSong(timeline: TimelineSong[], song: Song, pointsEarned: number): TimelineSong[] {
    const newEntry: TimelineSong = {
      ...song,
      pointsEarned,
      addedAt: Date.now()
    };

    const newTimeline = [...timeline, newEntry];

    // Sort by year ascending
    newTimeline.sort((a, b) => a.year - b.year);

    return newTimeline;
  }

  isDuplicate(timeline: TimelineSong[], song: Song): boolean {
    return timeline.some(entry => entry.id === song.id);
  }

  getTimelineScore(timeline: TimelineSong[]): number {
    return timeline.length;
  }
}
