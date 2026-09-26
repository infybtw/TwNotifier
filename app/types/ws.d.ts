/**
 * Minimal ambient declaration for the `ws` module. Bun ships a compatible
 * built-in implementation, but it does not provide TypeScript types, so this
 * covers the subset used by the EventSub shard client.
 */
declare module "ws" {
  type WebSocketListener = (...args: unknown[]) => void;

  class WebSocket {
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;

    readonly readyState: number;

    constructor(address: string | URL, protocols?: string | string[]);

    on(event: "open", listener: () => void): this;
    on(event: "message", listener: (data: { toString(): string }) => void): this;
    on(event: "close", listener: (code: number, reason: unknown) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: string, listener: WebSocketListener): this;

    send(data: string | ArrayBufferLike | ArrayBufferView): void;
    close(code?: number, reason?: string): void;
  }

  export default WebSocket;
}
