import type { GameSettings, GameMode } from '@party-popper/shared';

interface GameSettingsPanelProps {
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
}

const TARGET_SCORE_OPTIONS = [5, 10, 15, 20];

export function GameSettingsPanel({
  settings,
  onUpdateSettings,
}: GameSettingsPanelProps) {
  return (
    <div className="bg-game-surface rounded-xl p-6 border border-game-border">
      <h3 className="text-tv-base font-bold text-game-text mb-6">Game Settings</h3>

      {/* Target Score */}
      <div className="mb-6">
        <label className="block text-tv-sm text-game-muted mb-3">
          Target Score
        </label>
        <div className="grid grid-cols-4 gap-2">
          {TARGET_SCORE_OPTIONS.map((score) => (
            <button
              key={score}
              onClick={() => onUpdateSettings({ targetScore: score })}
              className={`
                py-3 rounded-lg text-tv-sm font-semibold
                transition-colors duration-150
                ${
                  settings.targetScore === score
                    ? 'bg-team-a-600 text-white'
                    : 'bg-game-bg text-game-text hover:bg-game-border'
                }
              `}
            >
              {score}
            </button>
          ))}
        </div>
      </div>

      {/* Game Mode - placeholder for future Custom mode */}
      <div>
        <label className="block text-tv-sm text-game-muted mb-3">
          Game Mode
        </label>
        <div className="flex gap-2">
          <ModeButton
            mode="classic"
            label="Classic"
            description="100 curated songs"
            isActive={true}
            onClick={() => {}}
          />
          <ModeButton
            mode="custom"
            label="Custom"
            description="Coming soon"
            isActive={false}
            onClick={() => {}}
            disabled
          />
        </div>
      </div>
    </div>
  );
}

interface ModeButtonProps {
  mode: GameMode;
  label: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ModeButton({
  label,
  description,
  isActive,
  onClick,
  disabled,
}: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 py-3 px-4 rounded-lg text-left
        transition-colors duration-150
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${
          isActive
            ? 'bg-team-a-600 text-white'
            : 'bg-game-bg text-game-text hover:bg-game-border'
        }
      `}
    >
      <div className="text-tv-sm font-semibold">{label}</div>
      <div className={`text-sm ${isActive ? 'text-white/70' : 'text-game-muted'}`}>
        {description}
      </div>
    </button>
  );
}
