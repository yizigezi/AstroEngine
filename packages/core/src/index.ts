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
    const component: Component<T> = { type, data };
    this.components.set(type, component);
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
}

export class Scene {
  readonly objects = new Map<string, GameObject>();

  add(object: GameObject): void {
    if (this.objects.has(object.id)) {
      throw new Error(`Object with id "${object.id}" already exists`);
    }
    this.objects.set(object.id, object);
  }

  get(id: string): GameObject | undefined {
    return this.objects.get(id);
  }

  remove(id: string): boolean {
    return this.objects.delete(id);
  }

  clear(): void {
    this.objects.clear();
  }
}

export * from './event.js';
export * from './system.js';
export * from './world.js';
export * from './engine.js';

export * from './serialization.js';
