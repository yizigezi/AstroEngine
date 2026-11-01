export type ComponentData = Record<string, unknown>;

export interface Component<T extends ComponentData = ComponentData> {
  readonly type: string;
  readonly data: T;

  /** Whether this component participates in lifecycle updates. Defaults to true. */
  enabled?: boolean;

  /** Called once after the component has been attached to a GameObject. */
  onAttach?(owner: GameObject): void;
  /** Called when an enabled component becomes enabled. */
  onEnable?(owner: GameObject): void;
  /** Called when an enabled component becomes disabled. */
  onDisable?(owner: GameObject): void;
  /** Called immediately before the component is removed from its GameObject. */
  onDetach?(owner: GameObject): void;
  /** Called during GameObject.update() while the component is enabled. */
  onUpdate?(deltaTime: number, owner: GameObject): void;
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
    if (this.components.has(component.type)) {
      throw new Error(`Component "${component.type}" is already attached to GameObject "${this.id}"`);
    }

    this.components.set(component.type, component);
    let attachAttempted = false;
    let enableAttempted = false;

    try {
      attachAttempted = true;
      component.onAttach?.(this);
      if (component.enabled !== false) {
        enableAttempted = true;
        component.onEnable?.(this);
      }
    } catch (error) {
      this.components.delete(component.type);
      // Best-effort rollback must not hide the original lifecycle error.
      if (enableAttempted) {
        try {
          component.onDisable?.(this);
        } catch {
          // Preserve the original error.
        }
      }
      if (attachAttempted) {
        try {
          component.onDetach?.(this);
        } catch {
          // Preserve the original error.
        }
      }
      throw error;
    }

    return component;
  }

  getComponent<T extends ComponentData = ComponentData>(type: string): Component<T> | undefined {
    return this.components.get(type) as Component<T> | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  isComponentEnabled(type: string): boolean {
    const component = this.components.get(type);
    return component !== undefined && component.enabled !== false;
  }

  /** Enable or disable an attached component. Returns false when no state change is needed. */
  setComponentEnabled(type: string, enabled: boolean): boolean {
    const component = this.components.get(type);
    if (!component || (component.enabled !== false) === enabled) {
      return false;
    }

    component.enabled = enabled;
    if (enabled) {
      component.onEnable?.(this);
    } else {
      component.onDisable?.(this);
    }
    return true;
  }

  removeComponent(type: string): boolean {
    const component = this.components.get(type);
    if (!component) return false;

    this.components.delete(type);
    let lifecycleError: unknown;

    if (component.enabled !== false) {
      try {
        component.onDisable?.(this);
      } catch (error) {
        lifecycleError = error;
      }
    }

    try {
      component.onDetach?.(this);
    } catch (error) {
      if (lifecycleError === undefined) lifecycleError = error;
    }

    if (lifecycleError !== undefined) throw lifecycleError;
    return true;
  }

  /** Update enabled components in insertion order. */
  update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError('deltaTime must be a finite, non-negative number');
    }

    for (const [type, component] of [...this.components.entries()]) {
      // A previous component may have removed or disabled this component.
      if (this.components.get(type) === component && component.enabled !== false) {
        component.onUpdate?.(deltaTime, this);
      }
    }
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
