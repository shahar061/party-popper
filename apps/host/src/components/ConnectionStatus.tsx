import { useEffect, useState } from 'react';
import type { ConnectionState } from '../hooks/useGameConnection';

interface ConnectionStatusProps {
  state: ConnectionState;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
}

export function ConnectionStatus({
  state,
  reconnectAttempt = 0,
  maxReconnectAttempts = 5,
}: ConnectionStatusProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (state === 'disconnected') {
      setToastMessage('Connection lost. Reconnecting...');
      setShowToast(true);
    } else if (state === 'connected') {
      if (showToast) {
        setToastMessage('Connected!');
        setTimeout(() => setShowToast(false), 3000);
      }
    }
  }, [state, showToast]);

  const statusColor =
    state === 'connected'
      ? 'bg-green-500'
      : state === 'connecting'
      ? 'bg-yellow-500 animate-pulse'
      : 'bg-red-500';

  const statusLabel =
    state === 'connected'
      ? 'Connected'
      : state === 'connecting'
      ? 'Connecting...'
      : 'Disconnected';

  return (
    <>
      {/* Status Indicator */}
      <div className="fixed top-4 right-4 flex items-center gap-2 bg-game-surface px-4 py-2 rounded-full border border-game-border">
        <span className={`w-3 h-3 rounded-full ${statusColor}`} />
        <span className="text-sm text-game-text">{statusLabel}</span>
      </div>

      {/* Reconnection Toast */}
      {showToast && (
        <div
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2
            bg-game-surface px-6 py-4 rounded-lg
            border border-game-border shadow-lg
            animate-slideUp
          `}
        >
          <p className="text-tv-sm text-game-text">{toastMessage}</p>
          {state === 'disconnected' && reconnectAttempt > 0 && (
            <p className="text-sm text-game-muted mt-1">
              Attempt {reconnectAttempt} of {maxReconnectAttempts}
            </p>
          )}
          {state === 'disconnected' && (
            <div className="mt-2 h-1 bg-game-border rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all duration-1000"
                style={{
                  width: `${((reconnectAttempt + 1) / maxReconnectAttempts) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
