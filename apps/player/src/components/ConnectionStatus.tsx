import { ConnectionState } from '@party-popper/shared';

interface ConnectionStatusProps {
  state: ConnectionState;
  reconnectAttempt?: number;
  compact?: boolean;
}

const statusConfig = {
  [ConnectionState.Connected]: {
    color: 'bg-green-500',
    text: 'Connected',
    animate: false,
  },
  [ConnectionState.Connecting]: {
    color: 'bg-yellow-500',
    text: 'Connecting...',
    animate: true,
  },
  [ConnectionState.Reconnecting]: {
    color: 'bg-yellow-500',
    text: 'Reconnecting',
    animate: true,
  },
  [ConnectionState.Disconnected]: {
    color: 'bg-red-500',
    text: 'Disconnected',
    animate: false,
  },
};

export function ConnectionStatus({
  state,
  reconnectAttempt = 0,
  compact = false
}: ConnectionStatusProps) {
  const config = statusConfig[state];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          w-2.5 h-2.5 rounded-full
          ${config.color}
          ${config.animate ? 'animate-pulse' : ''}
        `}
        role="status"
        aria-label={config.text}
      />

      {!compact && (
        <span className="text-sm text-game-muted">
          {config.text}
          {state === ConnectionState.Reconnecting && reconnectAttempt > 0 && (
            <span className="text-game-muted/70"> (attempt {reconnectAttempt})</span>
          )}
        </span>
      )}
    </div>
  );
}
