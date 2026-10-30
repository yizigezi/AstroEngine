import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './event.js';

describe('EventBus', () => {
  it('delivers event data and metadata to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('ready', handler);

    const event = bus.emit('ready', { value: 42 }, {
      target: 'engine',
      timestamp: 123,
      bubbles: true,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'ready',
      data: { value: 42 },
      target: 'engine',
      timestamp: 123,
      bubbles: true,
      defaultPrevented: false,
    });
    expect(event.type).toBe('ready');
  });

  it('supports once subscriptions and unsubscribe callbacks', () => {
    const bus = new EventBus();
    const onceHandler = vi.fn();
    const regularHandler = vi.fn();

    bus.once('tick', onceHandler);
    const unsubscribe = bus.on('tick', regularHandler);

    bus.emit('tick', 1);
    bus.emit('tick', 2);
    unsubscribe();
    bus.emit('tick', 3);

    expect(onceHandler).toHaveBeenCalledOnce();
    expect(regularHandler).toHaveBeenCalledTimes(2);
  });

  it('can remove listeners and clear events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('first', handler);
    bus.on('second', handler);
    bus.off('first', handler);
    bus.emit('first', null);
    bus.emit('second', null);
    bus.clear();
    bus.emit('second', null);

    expect(handler).toHaveBeenCalledOnce();
  });
});
