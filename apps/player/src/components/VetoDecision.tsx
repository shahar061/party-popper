interface VetoDecisionProps {
  tokensAvailable: number;
  opponentPlacement: string; // e.g., "between 1975 and 1982"
  onUseVeto: () => void;
  onPass: () => void;
  disabled?: boolean;
  timeRemaining?: number;
}

export function VetoDecision({
  tokensAvailable,
  opponentPlacement,
  onUseVeto,
  onPass,
  disabled = false,
  timeRemaining,
}: VetoDecisionProps) {
  const canUseVeto = tokensAvailable > 0 && !disabled;

  return (
    <div className="w-full max-w-md space-y-6 text-center">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center">
          <span className="text-4xl font-mono font-bold text-red-400">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
      )}

      <div className="bg-red-900/30 border border-red-500 rounded-xl p-6 space-y-4">
        <h2 className="text-2xl font-bold text-red-400">VETO OPPORTUNITY!</h2>

        <p className="text-white text-lg">
          The other team placed the song {opponentPlacement}
        </p>

        <p className="text-yellow-400 font-medium">
          You have {tokensAvailable} token{tokensAvailable !== 1 ? 's' : ''}
        </p>

        <div className="space-y-3 pt-4">
          <button
            onClick={onUseVeto}
            disabled={!canUseVeto}
            className={`w-full py-4 text-xl font-bold rounded-lg transition-colors ${
              canUseVeto
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Use Veto Token
          </button>

          <button
            onClick={onPass}
            disabled={disabled}
            className="w-full py-4 text-xl font-bold rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          >
            Pass
          </button>
        </div>

        {tokensAvailable === 0 && (
          <p className="text-gray-400 text-sm">
            No tokens available - you must pass
          </p>
        )}
      </div>
    </div>
  );
}
