import type { ClientMessage, ClientMessageType, ErrorPayload } from '@party-popper/shared';

export type MessageHandler<T = unknown> = (payload: T, ws: WebSocket) => void | Promise<void>;
export type ErrorHandler = (error: ErrorPayload, ws: WebSocket) => void | Promise<void>;

export class MessageRouter {
  private handlers: Map<ClientMessageType, MessageHandler> = new Map();
  private errorHandler: ErrorHandler = () => {};

  on<K extends ClientMessageType>(
    type: K,
    handler: MessageHandler<Extract<ClientMessage, { type: K }>['payload']>
  ): void {
    this.handlers.set(type, handler as MessageHandler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  handleRaw(data: string | ArrayBuffer, ws: WebSocket): void {
    const messageStr = typeof data === 'string' ? data : new TextDecoder().decode(data);

    let message: ClientMessage;
    try {
      message = JSON.parse(messageStr);
    } catch {
      this.errorHandler({ code: 'INVALID_JSON', message: 'Failed to parse message as JSON' }, ws);
      return;
    }

    this.handle(message, ws);
  }

  handle(message: ClientMessage, ws: WebSocket): void {
    const handler = this.handlers.get(message.type);

    if (!handler) {
      this.errorHandler(
        { code: 'UNKNOWN_MESSAGE_TYPE', message: `Unknown message type: ${message.type}` },
        ws
      );
      return;
    }

    try {
      handler((message as any).payload, ws);
    } catch (error) {
      this.errorHandler(
        { code: 'HANDLER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
        ws
      );
    }
  }
}
