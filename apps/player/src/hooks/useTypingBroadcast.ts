// apps/player/src/hooks/useTypingBroadcast.ts
import { useCallback, useRef } from 'react';

interface TypingMessage {
  type: 'typing';
  payload: {
    field: string;
    value: string;
  };
}

type SendMessageFn = (message: TypingMessage) => void;

export function useTypingBroadcast(
  sendMessage: SendMessageFn,
  isActiveTeam: boolean
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const broadcastTyping = useCallback((field: string, value: string) => {
    if (!isActiveTeam) {
      return;
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Trailing-edge debounce: wait 100ms before sending (10 messages/sec max)
    timeoutRef.current = setTimeout(() => {
      sendMessage({
        type: 'typing',
        payload: { field, value }
      });
    }, 100);
  }, [sendMessage, isActiveTeam]);

  return { broadcastTyping };
}
