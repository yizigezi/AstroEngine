export type EventType = string;

export interface EngineEvent<T = unknown> {
  readonly type: EventType;
  readonly target?: unknown;
  readonly data: T;
  readonly timestamp: number;
  readonly bubbles: boolean;
  readonly defaultPrevented: boolean;
}

export type EventHandler<T = unknown> = (event: EngineEvent<T>) => void;

interface MutableEngineEvent<T> extends EngineEvent<T> {
  defaultPrevented: boolean;
}

export interface EmitOptions {
  target?: unknown;
  bubbles?: boolean;
  timestamp?: number;
}

/**
 * Lightweight event bus used by the engine runtime.
 *
 * It deliberately has no dependency on DOM/EventTarget so it can run in
 * browsers, workers, Node.js and other JavaScript runtimes.
 */
export class EventBus {
  private readonly handlers = new Map<EventType, Set<EventHandler>>();

  on<T = unknown>(type: EventType, handler: EventHandler<T>): () => void {
    let handlers = this.handlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(type, handlers);
    }

    handlers.add(handler as EventHandler);
    return () => this.off(type, handler);
  }

  once<T = unknown>(type: EventType, handler: EventHandler<T>): () => void {
    const unsubscribe = this.on<T>(type, (event) => {
      unsubscribe();
      handler(event);
    });

    return unsubscribe;
  }

  off<T = unknown>(type: EventType, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(type);
    if (!handlers) return;

    handlers.delete(handler as EventHandler);
    if (handlers.size === 0) {
      this.handlers.delete(type);
    }
  }

  emit<T = unknown>(type: EventType, data: T, options: EmitOptions = {}): EngineEvent<T> {
    const event: MutableEngineEvent<T> = {
      type,
      target: options.target,
      data,
      timestamp: options.timestamp ?? Date.now(),
      bubbles: options.bubbles ?? false,
      defaultPrevented: false,
    };

    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of [...handlers]) {
        handler(event);
      }
    }

    return event;
  }

  clear(type?: EventType): void {
    if (type === undefined) {
      this.handlers.clear();
    } else {
      this.handlers.delete(type);
    }
  }
}
