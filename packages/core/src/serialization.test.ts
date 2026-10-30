import { describe, expect, it } from 'vitest';
import { GameObject, Scene } from './index.js';
import {
  deserializeScene,
  parseScene,
  serializeScene,
  stringifyScene,
  validateSceneDocument,
} from './serialization.js';

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

  it('rejects invalid JSON text', () => {
    expect(() => parseScene('{invalid')).toThrow();
  });
});
