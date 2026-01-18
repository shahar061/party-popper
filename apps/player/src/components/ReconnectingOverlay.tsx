import { ConnectionState } from '@party-popper/shared';

interface ReconnectingOverlayProps {
  state: ConnectionState;
  reconnectAttempt: number;
  maxAttempts?: number;
  onCancel?: () => void;
}

export function ReconnectingOverlay({
  state,
  reconnectAttempt,
  maxAttempts = 5,
  onCancel,
}: ReconnectingOverlayProps) {
  if (state !== ConnectionState.Reconnecting && state !== ConnectionState.Connecting) {
    return null;
  }

  const isConnecting = state === ConnectionState.Connecting;
  const progress = isConnecting ? 0 : (reconnectAttempt / maxAttempts) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-game-bg/90 backdrop-blur-sm">
      <div className="bg-game-surface border border-game-border rounded-2xl p-6 max-w-sm w-full mx-4 text-center">
        {/* Spinner */}
        <div className="flex justify-center mb-4">
          <svg
            className="w-12 h-12 text-team-a-500 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>

        {/* Status text */}
        <h2 className="text-lg font-semibold text-white mb-2">
          {isConnecting ? 'Connecting...' : 'Reconnecting...'}
        </h2>

        <p className="text-game-muted text-sm mb-4">
          {isConnecting
            ? 'Establishing connection to the game server'
            : `Attempt ${reconnectAttempt} of ${maxAttempts}`
          }
        </p>

        {/* Progress bar for reconnection */}
        {!isConnecting && (
          <div className="w-full bg-game-border rounded-full h-2 mb-4">
            <div
              className="bg-team-a-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-game-muted hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
