export type ComponentData = Record<string, unknown>;

export interface Component<T extends ComponentData = ComponentData> {
  readonly type: string;
  readonly data: T;
}

export interface ObjectDefinition {
  id: string;
  type: string;
  name?: string;
  components?: Record<string, ComponentData>;
  children?: ObjectDefinition[];
}

export class GameObject {
  readonly id: string;
  readonly type: string;
  name?: string;
  private readonly components = new Map<string, Component>();
  readonly children: GameObject[] = [];
  private parent?: GameObject;
  private scene?: Scene;

  constructor(definition: ObjectDefinition) {
    this.id = definition.id;
    this.type = definition.type;
    this.name = definition.name;

    for (const [type, data] of Object.entries(definition.components ?? {})) {
      this.addComponent(type, data);
    }

    for (const child of definition.children ?? []) {
      this.addChild(new GameObject(child));
    }
  }

  addComponent<T extends ComponentData>(type: string, data: T): Component<T> {
    return this.addComponentInstance({ type, data });
  }

  /** Attach a component instance created by a registered factory or plugin. */
  addComponentInstance<T extends ComponentData>(component: Component<T>): Component<T> {
    if (typeof component !== 'object' || component === null) {
      throw new TypeError('Component must be an object');
    }
    if (typeof component.type !== 'string' || component.type.trim().length === 0) {
      throw new TypeError('Component type must be a non-empty string');
    }
    if (typeof component.data !== 'object' || component.data === null || Array.isArray(component.data)) {
      throw new TypeError(`Component "${component.type}" data must be an object`);
    }
    this.components.set(component.type, component);
    return component;
  }

  getComponent<T extends ComponentData = ComponentData>(type: string): Component<T> | undefined {
    return this.components.get(type) as Component<T> | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  removeComponent(type: string): boolean {
    return this.components.delete(type);
  }

  addChild(child: GameObject): void {
    if (child === this) {
      throw new Error(`Cannot add object "${this.id}" as its own child`);
    }
    if (this.isDescendantOf(child)) {
      throw new Error(`Cannot add object "${child.id}" because it would create a cycle`);
    }
    if (child.parent && child.parent !== this) {
      throw new Error(`Object "${child.id}" already has a parent`);
    }
    if (child.parent === this) {
      return;
    }

    if (this.scene) {
      this.scene.registerSubtree(child);
    }

    child.parent = this;
    this.children.push(child);
  }

  toJSON(): ObjectDefinition {
    return {
      id: this.id,
      type: this.type,
      ...(this.name === undefined ? {} : { name: this.name }),
      components: Object.fromEntries(
        [...this.components.entries()].map(([type, component]) => [type, component.data]),
      ),
      ...(this.children.length === 0 ? {} : { children: this.children.map((child) => child.toJSON()) }),
    };
  }

  private isDescendantOf(object: GameObject): boolean {
    let current: GameObject | undefined = this;
    while (current) {
      if (current === object) return true;
      current = current.parent;
    }
    return false;
  }

  /** Internal scene ownership propagation. */
  _setScene(scene: Scene | undefined): void {
    this.scene = scene;
    for (const child of this.children) {
      child._setScene(scene);
    }
  }
}

export class Scene {
  readonly objects = new Map<string, GameObject>();
  private readonly objectIndex = new Map<string, GameObject>();

  add(object: GameObject): void {
    if (this.objects.has(object.id) || this.objectIndex.has(object.id)) {
      throw new Error(`Object with id "${object.id}" already exists`);
    }

    this.registerSubtree(object);
    this.objects.set(object.id, object);
  }

  get(id: string): GameObject | undefined {
    return this.objectIndex.get(id);
  }

  remove(id: string): boolean {
    const object = this.objects.get(id);
    if (!object) return false;

    this.unregisterSubtree(object);
    this.objects.delete(id);
    return true;
  }

  clear(): void {
    for (const object of this.objects.values()) {
      object._setScene(undefined);
    }
    this.objects.clear();
    this.objectIndex.clear();
  }

  /** Register a subtree and reject any duplicate IDs before mutating the scene. */
  registerSubtree(object: GameObject): void {
    const pending = new Map<string, GameObject>();
    const visit = (current: GameObject): void => {
      if (pending.has(current.id) || this.objectIndex.has(current.id)) {
        throw new Error(`Object with id "${current.id}" already exists`);
      }
      pending.set(current.id, current);
      for (const child of current.children) {
        visit(child);
      }
    };

    visit(object);
    for (const [id, current] of pending) {
      this.objectIndex.set(id, current);
    }
    object._setScene(this);
  }

  private unregisterSubtree(object: GameObject): void {
    const visit = (current: GameObject): void => {
      this.objectIndex.delete(current.id);
      for (const child of current.children) {
        visit(child);
      }
    };

    visit(object);
    object._setScene(undefined);
  }
}

export * from './event.js';
export * from './system.js';
export * from './world.js';
export * from './engine.js';

export * from './serialization.js';
export * from './registry.js';
