import type { World } from './world.js';

export interface SystemContext {
  readonly world: World;
  readonly deltaTime: number;
  readonly elapsedTime: number;
}

export interface FixedSystemContext extends SystemContext {
  readonly fixedDeltaTime: number;
}

/**
 * Systems contain behavior that operates on a World.
 * Implement only the lifecycle hooks a system needs.
 */
export interface System {
  /** Stable identifier used to prevent duplicate system registration. */
  readonly id: string;
  /** Lower values run earlier. Defaults to 0. */
  readonly priority?: number;
  onInit?(world: World): void;
  onStart?(world: World): void;
  onUpdate?(context: SystemContext): void;
  onFixedUpdate?(context: FixedSystemContext): void;
  onStop?(world: World): void;
  onDestroy?(world: World): void;
}
