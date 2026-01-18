import type { TimelineSong } from '@party-popper/shared';

interface TimelineDisplayProps {
  teamATimeline: TimelineSong[];
  teamBTimeline: TimelineSong[];
  teamAName: string;
  teamBName: string;
  teamATokens: number;
  teamBTokens: number;
}

export function TimelineDisplay({
  teamATimeline,
  teamBTimeline,
  teamAName,
  teamBName,
  teamATokens,
  teamBTokens
}: TimelineDisplayProps) {
  return (
    <div className="grid grid-cols-2 gap-8 w-full max-w-6xl">
      <TimelineColumn
        timeline={teamATimeline}
        teamName={teamAName}
        tokens={teamATokens}
        testId="timeline-team-a"
      />
      <TimelineColumn
        timeline={teamBTimeline}
        teamName={teamBName}
        tokens={teamBTokens}
        testId="timeline-team-b"
      />
    </div>
  );
}

interface TimelineColumnProps {
  timeline: TimelineSong[];
  teamName: string;
  tokens: number;
  testId: string;
}

function TimelineColumn({ timeline, teamName, tokens, testId }: TimelineColumnProps) {
  return (
    <div data-testid={testId} className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-2xl font-bold text-white mb-2 text-center">
        {teamName}
      </h3>
      <div className="flex items-center justify-center gap-1 mb-4">
        {Array.from({ length: tokens }).map((_, i) => (
          <span key={i} className="text-yellow-400 text-xl">&#9733;</span>
        ))}
        {tokens === 0 && <span className="text-gray-500 text-sm">No tokens</span>}
      </div>

      {timeline.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No songs yet</p>
      ) : (
        <div className="space-y-3">
          {timeline.map((entry) => (
            <div
              key={entry.id}
              data-testid="timeline-song"
              className="bg-gray-700 rounded-lg p-3 flex items-center gap-4"
            >
              <span className="text-yellow-400 font-bold text-xl min-w-[60px]">
                {entry.year}
              </span>
              <div className="flex-1">
                <div className="text-white font-medium">
                  {entry.title}
                </div>
                <div className="text-gray-400 text-sm">
                  {entry.artist}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
