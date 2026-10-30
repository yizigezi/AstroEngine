import { describe, expect, it, vi } from 'vitest';
import { World } from './world.js';
import type { System } from './system.js';

describe('World', () => {
  it('initializes systems and starts them in priority order', () => {
    const calls: string[] = [];
    const world = new World();

    const makeSystem = (id: string, priority: number): System => ({
      id,
      priority,
      onInit: () => calls.push(`init:${id}`),
      onStart: () => calls.push(`start:${id}`),
    });

    world.addSystem(makeSystem('late', 10));
    world.addSystem(makeSystem('early', -1));
    world.start();

    expect(calls).toEqual([
      'init:late',
      'init:early',
      'start:early',
      'start:late',
    ]);
    expect(world.isStarted).toBe(true);
  });

  it('updates systems and advances elapsed time', () => {
    const world = new World();
    const onUpdate = vi.fn();
    world.addSystem({ id: 'movement', onUpdate });
    world.start();

    world.update(0.25);

    expect(world.time).toBeCloseTo(0.25);
    expect(onUpdate).toHaveBeenCalledWith({
      world,
      deltaTime: 0.25,
      elapsedTime: 0.25,
    });
  });

  it('rejects updates before start and invalid delta times', () => {
    const world = new World();

    expect(() => world.update(0.1)).toThrow(/before it has started/);
    world.start();
    expect(() => world.update(-1)).toThrow(RangeError);
    expect(() => world.fixedUpdate(0)).toThrow(RangeError);
  });

  it('stops and destroys systems when removed', () => {
    const world = new World();
    const onStop = vi.fn();
    const onDestroy = vi.fn();

    world.addSystem({ id: 'temporary', onStop, onDestroy });
    world.start();

    expect(world.removeSystem('temporary')).toBe(true);
    expect(world.removeSystem('missing')).toBe(false);
    expect(onStop).toHaveBeenCalledOnce();
    expect(onDestroy).toHaveBeenCalledOnce();
  });
});
