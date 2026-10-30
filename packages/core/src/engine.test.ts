import { describe, expect, it, vi } from 'vitest';
import { Engine } from './engine.js';
import { World } from './world.js';

describe('Engine', () => {
  it('runs variable updates and fixed steps', () => {
    const world = new World();
    const onUpdate = vi.fn();
    const onFixedUpdate = vi.fn();
    world.addSystem({ id: 'clock', onUpdate, onFixedUpdate });

    const engine = new Engine(world, {
      fixedDeltaTime: 0.1,
      maxFixedSteps: 5,
    });
    engine.start();
    engine.update(0.25);

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onFixedUpdate).toHaveBeenCalledTimes(2);
    expect(engine.isRunning).toBe(true);
  });

  it('limits fixed steps after a long frame', () => {
    const world = new World();
    const onFixedUpdate = vi.fn();
    world.addSystem({ id: 'clock', onFixedUpdate });

    const engine = new Engine(world, {
      fixedDeltaTime: 0.1,
      maxFixedSteps: 3,
    });
    engine.start();
    engine.update(1);

    expect(onFixedUpdate).toHaveBeenCalledTimes(3);
  });

  it('stops the world and rejects updates while stopped', () => {
    const engine = new Engine();
    engine.start();
    engine.stop();

    expect(engine.isRunning).toBe(false);
    expect(engine.world.isStarted).toBe(false);
    expect(() => engine.update(0.1)).toThrow(/before it has started/);
  });

  it('validates timing options', () => {
    expect(() => new Engine(undefined, { fixedDeltaTime: 0 })).toThrow(RangeError);
    expect(() => new Engine(undefined, { maxFixedSteps: 0 })).toThrow(RangeError);
  });
});
