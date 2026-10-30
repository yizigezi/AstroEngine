import type { Component, ComponentData } from './index.js';

/** Creates a runtime component from its serialized data. */
export interface ComponentFactory<T extends ComponentData = ComponentData> {
  create(data: T): Component<T>;
}

/**
 * Maps stable component type names to factories.
 *
 * The registry is renderer-agnostic: plugins can register their own component
 * implementations without adding dependencies to the core runtime.
 */
export class ComponentRegistry {
  private readonly factories = new Map<string, ComponentFactory>();

  register<T extends ComponentData>(type: string, factory: ComponentFactory<T>): void {
    this.assertType(type);
    if (this.factories.has(type)) {
      throw new Error(`Component factory "${type}" is already registered`);
    }
    if (typeof factory !== 'object' || factory === null || typeof factory.create !== 'function') {
      throw new TypeError('Component factory must provide a create(data) function');
    }
    this.factories.set(type, factory as ComponentFactory);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }

  get<T extends ComponentData = ComponentData>(type: string): ComponentFactory<T> | undefined {
    return this.factories.get(type) as ComponentFactory<T> | undefined;
  }

  create<T extends ComponentData = ComponentData>(type: string, data: T): Component<T> {
    this.assertType(type);
    const factory = this.get<T>(type);
    if (!factory) {
      throw new Error(`No component factory registered for "${type}"`);
    }

    // Do not catch factory errors: callers need the original failure.
    const component: unknown = factory.create(data);
    if (typeof component !== 'object' || component === null) {
      throw new TypeError(`Factory for "${type}" must return a component object`);
    }
    const candidate = component as Partial<Component>;
    if (candidate.type !== type) {
      throw new TypeError(`Factory for "${type}" returned component type "${String(candidate.type)}"`);
    }
    if (
      typeof candidate.data !== 'object' ||
      candidate.data === null ||
      Array.isArray(candidate.data)
    ) {
      throw new TypeError(`Factory for "${type}" must return component data as an object`);
    }
    return component as Component<T>;
  }

  unregister(type: string): boolean {
    return this.factories.delete(type);
  }

  clear(): void {
    this.factories.clear();
  }

  private assertType(type: string): void {
    if (typeof type !== 'string' || type.trim().length === 0) {
      throw new TypeError('Component type must be a non-empty string');
    }
  }
}
