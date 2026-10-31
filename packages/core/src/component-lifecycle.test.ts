import { describe, expect, it, vi } from 'vitest';
import { GameObject } from './index.js';

describe('GameObject component lifecycle', () => {
  it('runs attach, enable, update, disable, and detach hooks in order', () => {
    const calls: string[] = [];
    const object = new GameObject({ id: 'ship', type: 'Entity' });

    object.addComponentInstance({
      type: 'Motion',
      data: {},
      onAttach: (owner) => calls.push(`attach:${owner.id}`),
      onEnable: () => calls.push('enable'),
      onUpdate: (deltaTime) => calls.push(`update:${deltaTime}`),
      onDisable: () => calls.push('disable'),
      onDetach: () => calls.push('detach'),
    });

    object.update(0.25);
    expect(object.setComponentEnabled('Motion', false)).toBe(true);
    object.update(0.5);
    expect(object.removeComponent('Motion')).toBe(true);

    expect(calls).toEqual([
      'attach:ship',
      'enable',
      'update:0.25',
      'disable',
      'detach',
    ]);
  });

  it('does not enable initially disabled components', () => {
    const onEnable = vi.fn();
    const onUpdate = vi.fn();
    const object = new GameObject({ id: 'ship', type: 'Entity' });

    object.addComponentInstance({
      type: 'Hidden',
      data: {},
      enabled: false,
      onEnable,
      onUpdate,
    });

    object.update(1);
    expect(onEnable).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(object.isComponentEnabled('Hidden')).toBe(false);
    expect(object.setComponentEnabled('Hidden', true)).toBe(true);
    expect(onEnable).toHaveBeenCalledOnce();
    object.update(1);
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('does not call lifecycle hooks for redundant state changes', () => {
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    const object = new GameObject({ id: 'ship', type: 'Entity' });
    object.addComponentInstance({ type: 'Tag', data: {}, onEnable, onDisable });

    expect(object.setComponentEnabled('Tag', true)).toBe(false);
    expect(object.setComponentEnabled('Missing', false)).toBe(false);
    expect(object.setComponentEnabled('Tag', false)).toBe(true);
    expect(object.setComponentEnabled('Tag', false)).toBe(false);
    expect(onEnable).not.toHaveBeenCalled();
    expect(onDisable).toHaveBeenCalledOnce();
  });

  it('rejects duplicate component types instead of silently replacing instances', () => {
    const object = new GameObject({ id: 'ship', type: 'Entity' });
    object.addComponent('Tag', { value: 'ship' });
    expect(() => object.addComponent('Tag', { value: 'planet' })).toThrow(
      /already attached to GameObject/,
    );
  });

  it('rolls back attachment when a lifecycle hook throws', () => {
    const failure = new Error('initialization failed');
    const onDetach = vi.fn();
    const object = new GameObject({ id: 'ship', type: 'Entity' });

    expect(() => object.addComponentInstance({
      type: 'Broken',
      data: {},
      onEnable: () => { throw failure; },
      onDetach,
    })).toThrow(failure);

    expect(object.hasComponent('Broken')).toBe(false);
    expect(onDetach).toHaveBeenCalledOnce();
  });

  it('continues detaching after onDisable throws', () => {
    const failure = new Error('disable failed');
    const onDetach = vi.fn();
    const object = new GameObject({ id: 'ship', type: 'Entity' });
    object.addComponentInstance({
      type: 'Broken',
      data: {},
      onDisable: () => { throw failure; },
      onDetach,
    });

    expect(() => object.removeComponent('Broken')).toThrow(failure);
    expect(onDetach).toHaveBeenCalledOnce();
    expect(object.hasComponent('Broken')).toBe(false);
  });

  it('validates update delta time', () => {
    const object = new GameObject({ id: 'ship', type: 'Entity' });
    expect(() => object.update(-1)).toThrow(RangeError);
    expect(() => object.update(Number.NaN)).toThrow(RangeError);
  });
});
