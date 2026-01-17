// apps/player/src/components/VetoButton.tsx
import { useState } from 'react';

type ChallengedField = 'artist' | 'title' | 'year';

interface VetoButtonProps {
  tokensRemaining: number;
  onVeto: (field: ChallengedField) => void;
  isVetoWindowActive: boolean;
}

export function VetoButton({ tokensRemaining, onVeto, isVetoWindowActive }: VetoButtonProps) {
  const [showFieldSelection, setShowFieldSelection] = useState(false);
  const [selectedField, setSelectedField] = useState<ChallengedField | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!isVetoWindowActive) {
    return null;
  }

  const handleChallengeClick = () => {
    setShowFieldSelection(true);
  };

  const handleFieldSelect = (field: ChallengedField) => {
    setSelectedField(field);
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (selectedField) {
      onVeto(selectedField);
      setShowFieldSelection(false);
      setShowConfirmation(false);
      setSelectedField(null);
    }
  };

  const handleCancel = () => {
    setShowFieldSelection(false);
    setShowConfirmation(false);
    setSelectedField(null);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleChallengeClick}
        disabled={tokensRemaining === 0}
        className={`px-6 py-4 text-lg font-bold rounded-xl transition-colors ${
          tokensRemaining === 0
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-yellow-600 hover:bg-yellow-700 text-white'
        }`}
      >
        Challenge Answer
      </button>

      <div className="text-sm text-gray-400">
        {tokensRemaining} tokens remaining
      </div>

      {showFieldSelection && !showConfirmation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-4 text-center">
              Which field is wrong?
            </h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleFieldSelect('artist')}
                className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
              >
                Artist
              </button>
              <button
                onClick={() => handleFieldSelect('title')}
                className="px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
              >
                Title
              </button>
              <button
                onClick={() => handleFieldSelect('year')}
                className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors"
              >
                Year
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold text-white mb-4">
              Are you sure?
            </h3>
            <p className="text-gray-400 mb-6">
              You will use 1 veto token to challenge the <span className="font-bold text-yellow-400">{selectedField}</span>.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
