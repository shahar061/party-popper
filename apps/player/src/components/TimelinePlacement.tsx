import type { TimelineSong } from '@party-popper/shared';

interface TimelinePlacementProps {
  timeline: TimelineSong[];
  onSelectPosition: (position: number) => void;
  selectedPosition: number | null;
  disabled?: boolean;
  timeRemaining?: number;
}

export function TimelinePlacement({
  timeline,
  onSelectPosition,
  selectedPosition,
  disabled = false,
  timeRemaining,
}: TimelinePlacementProps) {
  // Create slots: one before each song and one after the last
  const slots = timeline.length + 1;

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center">
          <span className="text-4xl font-mono font-bold text-yellow-400">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
      )}

      <h3 className="text-xl font-bold text-white text-center">
        Place the song on your timeline
      </h3>

      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        {timeline.length === 0 ? (
          /* Empty timeline - single tap area */
          <button
            onClick={() => onSelectPosition(0)}
            disabled={disabled}
            className={`w-full py-8 rounded-lg border-2 border-dashed transition-all ${
              selectedPosition === 0
                ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                : 'border-gray-600 text-gray-400 hover:border-gray-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Tap to place here
          </button>
        ) : (
          /* Timeline with songs */
          <>
            {/* Slot before first song */}
            <PlacementSlot
              position={0}
              isSelected={selectedPosition === 0}
              onSelect={() => onSelectPosition(0)}
              disabled={disabled}
              label="Before all songs"
            />

            {timeline.map((song, index) => (
              <div key={song.id}>
                {/* Song card */}
                <div className="bg-gray-700 rounded-lg p-3 flex items-center gap-4">
                  <span className="text-yellow-400 font-bold text-xl min-w-[60px]">
                    {song.year}
                  </span>
                  <div className="flex-1">
                    <div className="text-white font-medium">{song.title}</div>
                    <div className="text-gray-400 text-sm">{song.artist}</div>
                  </div>
                </div>

                {/* Slot after this song */}
                <PlacementSlot
                  position={index + 1}
                  isSelected={selectedPosition === index + 1}
                  onSelect={() => onSelectPosition(index + 1)}
                  disabled={disabled}
                  label={index === timeline.length - 1 ? 'After all songs' : undefined}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {selectedPosition !== null && (
        <div className="text-center text-green-400 font-medium">
          Position selected - waiting for confirmation...
        </div>
      )}
    </div>
  );
}

interface PlacementSlotProps {
  position: number;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
  label?: string;
}

function PlacementSlot({ position, isSelected, onSelect, disabled, label }: PlacementSlotProps) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`w-full py-3 my-2 rounded-lg border-2 border-dashed transition-all text-sm ${
        isSelected
          ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400 font-medium'
          : 'border-gray-600 text-gray-500 hover:border-gray-500 hover:text-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isSelected ? '✓ Selected' : label || 'Tap to place here'}
    </button>
  );
}
