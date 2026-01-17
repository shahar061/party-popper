import { ChangeEvent } from 'react';

interface YearInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}

export function YearInput({
  value,
  onChange,
  min = 1950,
  max = 2030,
  disabled = false,
  label = 'Year',
}: YearInputProps) {
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      // Don't clamp during input - let user type freely
      // Only clamp when using buttons or on blur
      onChange(newValue);
    }
  };

  const canDecrement = value > min && !disabled;
  const canIncrement = value < max && !disabled;

  return (
    <div className="w-full">
      <label
        htmlFor="year-input"
        className="block text-sm font-medium text-game-muted mb-2"
      >
        {label}
      </label>

      <div className="flex items-center gap-2">
        {/* Decrement button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={!canDecrement}
          aria-label="Decrease year"
          className={`
            min-h-[44px] min-w-[44px] flex items-center justify-center
            rounded-xl text-2xl font-bold
            transition-colors
            ${canDecrement
              ? 'bg-game-surface hover:bg-game-border text-white active:bg-game-bg'
              : 'bg-game-bg text-game-muted cursor-not-allowed'
            }
          `}
        >
          -
        </button>

        {/* Year input */}
        <input
          id="year-input"
          type="number"
          role="spinbutton"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          disabled={disabled}
          className={`
            flex-1 min-w-0 px-4 py-3 text-xl text-center font-mono
            bg-game-surface border-2 border-game-border rounded-xl
            text-white
            focus:border-team-a-500 focus:outline-none focus:ring-2 focus:ring-team-a-500/50
            disabled:bg-game-bg disabled:text-game-muted disabled:cursor-not-allowed
            transition-colors
            [appearance:textfield]
            [&::-webkit-outer-spin-button]:appearance-none
            [&::-webkit-inner-spin-button]:appearance-none
          `}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />

        {/* Increment button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={!canIncrement}
          aria-label="Increase year"
          className={`
            min-h-[44px] min-w-[44px] flex items-center justify-center
            rounded-xl text-2xl font-bold
            transition-colors
            ${canIncrement
              ? 'bg-game-surface hover:bg-game-border text-white active:bg-game-bg'
              : 'bg-game-bg text-game-muted cursor-not-allowed'
            }
          `}
        >
          +
        </button>
      </div>
    </div>
  );
}
