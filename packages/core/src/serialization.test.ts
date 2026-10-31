import { describe, expect, it } from 'vitest';
import { GameObject, Scene } from './index.js';
import { ComponentRegistry } from './registry.js';
import {
  deserializeScene,
  parseScene,
  serializeScene,
  stringifyScene,
  validateSceneDocument,
} from './serialization.js';

const documentWithComponents = {
  version: 1 as const,
  objects: [{
    id: 'planet',
    type: 'CelestialBody',
    components: { Transform: { x: 1 }, Tag: { value: 'planet' } },
    children: [{
      id: 'moon',
      type: 'CelestialBody',
      components: { Transform: { x: 2 } },
    }],
  }],
};

describe('scene serialization', () => {
  it('round-trips objects, component data, and nested children', () => {
    const scene = new Scene();
    const root = new GameObject({
      id: 'planet',
      type: 'CelestialBody',
      name: 'Earth',
      components: {
        Transform: { position: [1, 2, 3] },
        Orbit: { radius: 10 },
      },
      children: [{ id: 'moon', type: 'CelestialBody', name: 'Moon' }],
    });
    scene.add(root);

    const restored = parseScene(stringifyScene(scene));
    expect(serializeScene(restored)).toEqual(serializeScene(scene));
    expect(restored.get('planet')?.children[0]?.id).toBe('moon');
  });

  it('supports empty scenes', () => {
    expect(serializeScene(new Scene())).toEqual({ version: 1, objects: [] });
  });

  it('rejects unsupported versions and malformed object definitions', () => {
    expect(() => validateSceneDocument({ version: 2, objects: [] })).toThrow(
      /Unsupported scene format version/,
    );
    expect(() => deserializeScene({ version: 1, objects: [{ id: '', type: 'Thing' }] })).toThrow(
      /id must be a non-empty string/,
    );
    expect(() => deserializeScene({ version: 1, objects: [{ id: 'x', type: 'Thing', components: [] }] })).toThrow(
      /components must be an object/,
    );
  });

  it('rejects duplicate IDs across root objects and nested children', () => {
    expect(() =>
      deserializeScene({
        version: 1,
        objects: [
          { id: 'same', type: 'Root', children: [{ id: 'child', type: 'Child' }] },
          { id: 'child', type: 'Other' },
        ],
      }),
    ).toThrow(/Duplicate object id "child"/);
  });

  it('rejects duplicate IDs in a runtime scene, including nested children', () => {
    const scene = new Scene();
    scene.add(new GameObject({
      id: 'root',
      type: 'Root',
      children: [{ id: 'nested', type: 'Child' }],
    }));

    expect(() => scene.add(new GameObject({ id: 'nested', type: 'Other' }))).toThrow(
      /Object with id "nested" already exists/,
    );
  });

  it('indexes nested objects for direct scene lookup', () => {
    const scene = new Scene();
    const root = new GameObject({
      id: 'root',
      type: 'Root',
      children: [{ id: 'nested', type: 'Child' }],
    });
    scene.add(root);

    expect(scene.get('root')).toBe(root);
    expect(scene.get('nested')).toBe(root.children[0]);
  });

  it('updates the scene index when a child is added after the root', () => {
    const scene = new Scene();
    const root = new GameObject({ id: 'root', type: 'Root' });
    scene.add(root);
    const child = new GameObject({ id: 'child', type: 'Child' });

    root.addChild(child);
    expect(scene.get('child')).toBe(child);
  });

  it('rejects self and ancestor cycles in the runtime object tree', () => {
    const root = new GameObject({ id: 'root', type: 'Root' });
    const child = new GameObject({ id: 'child', type: 'Child' });
    root.addChild(child);

    expect(() => root.addChild(root)).toThrow(/as its own child/);
    expect(() => child.addChild(root)).toThrow(/would create a cycle/);
  });

  it('keeps legacy plain-data restoration when no registry is supplied', () => {
    const restored = deserializeScene(documentWithComponents);
    expect(restored.get('planet')?.getComponent('Transform')).toEqual({
      type: 'Transform',
      data: { x: 1 },
    });
    expect(restored.get('planet')?.children[0]?.getComponent('Transform')?.data).toEqual({ x: 2 });
  });

  it('uses registered factories for root and nested object components', () => {
    const registry = new ComponentRegistry();
    const created: string[] = [];
    registry.register('Transform', {
      create: (data) => {
        created.push(String(data.x));
        return { type: 'Transform', data, runtime: true } as { type: string; data: typeof data; runtime: boolean };
      },
    });
    registry.register('Tag', {
      create: (data) => ({ type: 'Tag', data }),
    });

    const restored = deserializeScene(documentWithComponents, registry);
    expect(created).toEqual(['1', '2']);
    expect((restored.get('planet')?.getComponent('Transform') as unknown as { runtime: boolean }).runtime).toBe(true);
    expect(restored.get('planet')?.children[0]?.getComponent('Transform')?.data).toEqual({ x: 2 });
  });

  it('fails clearly when a component type is not registered', () => {
    const registry = new ComponentRegistry();
    registry.register('Transform', { create: (data) => ({ type: 'Transform', data }) });
    expect(() => deserializeScene(documentWithComponents, registry)).toThrow(
      /No component factory registered for "Tag"/,
    );
  });

  it('rejects invalid factory return values and mismatched component types', () => {
    const registry = new ComponentRegistry();
    registry.register('Transform', { create: () => ({ type: 'Other', data: {} }) });
    expect(() => deserializeScene(documentWithComponents, registry)).toThrow(
      /Factory for "Transform" returned component type "Other"/,
    );

    const invalid = new ComponentRegistry();
    invalid.register('Transform', { create: () => null as never });
    expect(() => deserializeScene(documentWithComponents, invalid)).toThrow(
      /must return a component object/,
    );
  });

  it('propagates factory errors unchanged', () => {
    const registry = new ComponentRegistry();
    const failure = new Error('factory failed');
    registry.register('Transform', { create: () => { throw failure; } });
    expect(() => deserializeScene(documentWithComponents, registry)).toThrow(failure);
  });

  it('rejects invalid JSON text', () => {
    expect(() => parseScene('{invalid')).toThrow();
  });
});
