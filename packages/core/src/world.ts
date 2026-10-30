import { EventBus } from './event.js';
import type { FixedSystemContext, System, SystemContext } from './system.js';

export class World {
  readonly events = new EventBus();
  private readonly systems = new Map<string, System>();
  private orderedSystems: System[] = [];
  private started = false;
  private elapsedTime = 0;

  get isStarted(): boolean {
    return this.started;
  }

  get time(): number {
    return this.elapsedTime;
  }

  getSystems(): readonly System[] {
    return this.orderedSystems;
  }

  addSystem(system: System): void {
    if (this.systems.has(system.id)) {
      throw new Error(`System "${system.id}" is already registered`);
    }

    this.systems.set(system.id, system);
    this.rebuildSystemOrder();
    system.onInit?.(this);
    this.events.emit('system:added', { systemId: system.id }, { target: this });

    if (this.started) {
      system.onStart?.(this);
    }
  }

  removeSystem(id: string): boolean {
    const system = this.systems.get(id);
    if (!system) return false;

    if (this.started) {
      system.onStop?.(this);
    }
    system.onDestroy?.(this);
    this.systems.delete(id);
    this.rebuildSystemOrder();
    this.events.emit('system:removed', { systemId: id }, { target: this });
    return true;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    for (const system of this.orderedSystems) {
      system.onStart?.(this);
    }

    this.events.emit('world:start', { world: this }, { target: this });
  }

  stop(): void {
    if (!this.started) return;

    for (const system of [...this.orderedSystems].reverse()) {
      system.onStop?.(this);
    }

    this.started = false;
    this.events.emit('world:stop', { world: this }, { target: this });
  }

  update(deltaTime: number): void {
    if (!this.started) {
      throw new Error('Cannot update a World before it has started');
    }
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError('deltaTime must be a finite, non-negative number');
    }

    this.elapsedTime += deltaTime;
    const context: SystemContext = {
      world: this,
      deltaTime,
      elapsedTime: this.elapsedTime,
    };

    for (const system of this.orderedSystems) {
      system.onUpdate?.(context);
    }

    this.events.emit('world:update', context, { target: this });
  }

  fixedUpdate(fixedDeltaTime: number): void {
    if (!this.started) {
      throw new Error('Cannot fixed-update a World before it has started');
    }
    if (!Number.isFinite(fixedDeltaTime) || fixedDeltaTime <= 0) {
      throw new RangeError('fixedDeltaTime must be a finite, positive number');
    }

    const context: FixedSystemContext = {
      world: this,
      deltaTime: fixedDeltaTime,
      fixedDeltaTime,
      elapsedTime: this.elapsedTime,
    };

    for (const system of this.orderedSystems) {
      system.onFixedUpdate?.(context);
    }

    this.events.emit('world:fixed-update', context, { target: this });
  }

  dispose(): void {
    this.stop();
    for (const system of [...this.orderedSystems].reverse()) {
      system.onDestroy?.(this);
    }
    this.systems.clear();
    this.orderedSystems = [];
    this.events.emit('world:dispose', { world: this }, { target: this });
    this.events.clear();
  }

  private rebuildSystemOrder(): void {
    this.orderedSystems = [...this.systems.values()].sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
    );
  }
}
