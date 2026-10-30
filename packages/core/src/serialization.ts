import { GameObject, Scene } from './index.js';
import type { ObjectDefinition } from './index.js';

/** The serialized scene format. Increment version when making breaking format changes. */
export interface SceneDocument {
  version: 1;
  objects: ObjectDefinition[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateObjectDefinition(
  value: unknown,
  path: string,
  ids: Set<string>,
): asserts value is ObjectDefinition {
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new TypeError(`${path}.id must be a non-empty string`);
  }
  if (ids.has(value.id)) {
    throw new Error(`Duplicate object id "${value.id}" at ${path}`);
  }
  ids.add(value.id);

  if (typeof value.type !== 'string' || value.type.trim().length === 0) {
    throw new TypeError(`${path}.type must be a non-empty string`);
  }
  if (value.name !== undefined && typeof value.name !== 'string') {
    throw new TypeError(`${path}.name must be a string`);
  }

  if (value.components !== undefined) {
    if (!isRecord(value.components)) {
      throw new TypeError(`${path}.components must be an object`);
    }
    for (const [type, data] of Object.entries(value.components)) {
      if (type.trim().length === 0 || !isRecord(data)) {
        throw new TypeError(`${path}.components.${type} must be an object`);
      }
    }
  }

  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) {
      throw new TypeError(`${path}.children must be an array`);
    }
    value.children.forEach((child, index) =>
      validateObjectDefinition(child, `${path}.children[${index}]`, ids),
    );
  }
}

/** Validate unknown input and return it as a versioned scene document. */
export function validateSceneDocument(value: unknown): SceneDocument {
  if (!isRecord(value)) {
    throw new TypeError('Scene document must be an object');
  }
  if (value.version !== 1) {
    throw new Error(`Unsupported scene format version: ${String(value.version)}`);
  }
  if (!Array.isArray(value.objects)) {
    throw new TypeError('Scene document objects must be an array');
  }

  const ids = new Set<string>();
  value.objects.forEach((object, index) =>
    validateObjectDefinition(object, `objects[${index}]`, ids),
  );

  return value as unknown as SceneDocument;
}

/** Convert a Scene into its portable JSON-compatible representation. */
export function serializeScene(scene: Scene): SceneDocument {
  return {
    version: 1,
    objects: [...scene.objects.values()].map((object) => object.toJSON()),
  };
}

/** Restore a Scene from a previously serialized document or parsed JSON value. */
export function deserializeScene(value: unknown): Scene {
  const document = validateSceneDocument(value);
  const scene = new Scene();

  for (const definition of document.objects) {
    scene.add(new GameObject(definition));
  }

  return scene;
}

/** Serialize a Scene as formatted JSON text. */
export function stringifyScene(scene: Scene, space = 2): string {
  return JSON.stringify(serializeScene(scene), null, space);
}

/** Parse JSON text and restore a Scene. */
export function parseScene(json: string): Scene {
  return deserializeScene(JSON.parse(json) as unknown);
}
