import { describe, it, expect, vi } from 'vitest';
import { MessageRouter } from '../message-router';
import type { ClientMessage } from '@party-popper/shared';

describe('WebSocket Message Router', () => {
  it('should route messages to correct handlers', () => {
    const router = new MessageRouter();
    const joinHandler = vi.fn();

    router.on('join', joinHandler);

    const message: ClientMessage = {
      type: 'join',
      payload: { playerName: 'Alice', sessionId: 'session-123' },
    };

    router.handle(message, {} as WebSocket);

    expect(joinHandler).toHaveBeenCalledWith(
      { playerName: 'Alice', sessionId: 'session-123' },
      expect.any(Object)
    );
  });

  it('should return error for unknown message types', () => {
    const router = new MessageRouter();
    const errorHandler = vi.fn();

    router.onError(errorHandler);

    const message = { type: 'unknown_type', payload: {} } as any;
    router.handle(message, {} as WebSocket);

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNKNOWN_MESSAGE_TYPE' }),
      expect.any(Object)
    );
  });

  it('should parse string messages as JSON', () => {
    const router = new MessageRouter();
    const joinHandler = vi.fn();

    router.on('join', joinHandler);

    const messageStr = JSON.stringify({
      type: 'join',
      payload: { playerName: 'Bob', sessionId: 'session-456' },
    });

    router.handleRaw(messageStr, {} as WebSocket);

    expect(joinHandler).toHaveBeenCalled();
  });

  it('should handle JSON parse errors', () => {
    const router = new MessageRouter();
    const errorHandler = vi.fn();

    router.onError(errorHandler);
    router.handleRaw('not valid json', {} as WebSocket);

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_JSON' }),
      expect.any(Object)
    );
  });
});
