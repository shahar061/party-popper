// apps/host/src/components/SessionControls.tsx
import { useState } from 'react';

interface SessionControlsProps {
  onPlayAgain: () => void;
  onEndSession: () => void;
}

export function SessionControls({ onPlayAgain, onEndSession }: SessionControlsProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleEndSessionClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    onEndSession();
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        <button
          onClick={onPlayAgain}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-xl transition-colors"
        >
          Play Again
        </button>
        <button
          onClick={handleEndSessionClick}
          className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-xl font-bold rounded-xl transition-colors"
        >
          End Session
        </button>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md text-center">
            <div className="text-2xl font-bold text-white mb-4">
              Are you sure?
            </div>
            <p className="text-gray-400 mb-6">
              This will end the game session and disconnect all players.
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
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
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
