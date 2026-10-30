import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from './registry.js';

describe('ComponentRegistry', () => {
  it('registers and creates components from data', () => {
    const registry = new ComponentRegistry();
    registry.register('Transform', {
      create: (data: { x: number; y: number; z: number }) => ({
        type: 'Transform',
        data,
      }),
    });

    const component = registry.create('Transform', { x: 1, y: 2, z: 3 });
    expect(component).toEqual({
      type: 'Transform',
      data: { x: 1, y: 2, z: 3 },
    });
    expect(registry.has('Transform')).toBe(true);
  });

  it('returns a registered factory', () => {
    const registry = new ComponentRegistry();
    const factory = { create: (data: Record<string, unknown>) => ({ type: 'Tag', data }) };
    registry.register('Tag', factory);
    expect(registry.get('Tag')).toBe(factory);
  });

  it('rejects duplicate and empty registrations', () => {
    const registry = new ComponentRegistry();
    const factory = { create: (data: Record<string, unknown>) => ({ type: 'Tag', data }) };
    registry.register('Tag', factory);
    expect(() => registry.register('Tag', factory)).toThrow(/already registered/);
    expect(() => registry.register(' ', factory)).toThrow(/non-empty string/);
  });

  it('throws a clear error for unknown component types', () => {
    const registry = new ComponentRegistry();
    expect(() => registry.create('Missing', {})).toThrow(
      /No component factory registered for "Missing"/,
    );
  });

  it('supports unregister and clear', () => {
    const registry = new ComponentRegistry();
    const factory = { create: (data: Record<string, unknown>) => ({ type: 'Tag', data }) };
    registry.register('Tag', factory);
    expect(registry.unregister('Tag')).toBe(true);
    expect(registry.unregister('Tag')).toBe(false);
    registry.register('Tag', factory);
    registry.clear();
    expect(registry.has('Tag')).toBe(false);
  });
});
