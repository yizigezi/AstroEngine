import { EventBus } from './event.js';
import { World } from './world.js';

export interface EngineOptions {
  /** Fixed simulation step in seconds. Defaults to 1/60. */
  fixedDeltaTime?: number;
  /** Maximum fixed updates performed by one update call. Defaults to 5. */
  maxFixedSteps?: number;
}

/**
 * The engine coordinates world lifecycle and deterministic time stepping.
 * It does not own a browser render loop; hosts decide when to call update().
 */
export class Engine {
  readonly events = new EventBus();
  readonly world: World;
  readonly fixedDeltaTime: number;
  readonly maxFixedSteps: number;

  private running = false;
  private accumulator = 0;

  constructor(world = new World(), options: EngineOptions = {}) {
    this.world = world;
    this.fixedDeltaTime = options.fixedDeltaTime ?? 1 / 60;
    this.maxFixedSteps = options.maxFixedSteps ?? 5;

    if (!Number.isFinite(this.fixedDeltaTime) || this.fixedDeltaTime <= 0) {
      throw new RangeError('fixedDeltaTime must be a finite, positive number');
    }
    if (!Number.isInteger(this.maxFixedSteps) || this.maxFixedSteps < 1) {
      throw new RangeError('maxFixedSteps must be a positive integer');
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.world.start();
    this.events.emit('engine:start', { engine: this }, { target: this });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.world.stop();
    this.events.emit('engine:stop', { engine: this }, { target: this });
  }

  /** Advance the engine by elapsed wall-clock seconds. */
  update(deltaTime: number): void {
    if (!this.running) {
      throw new Error('Cannot update an Engine before it has started');
    }
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError('deltaTime must be a finite, non-negative number');
    }

    this.world.update(deltaTime);
    this.accumulator += deltaTime;

    let steps = 0;
    while (
      this.accumulator >= this.fixedDeltaTime &&
      steps < this.maxFixedSteps
    ) {
      this.world.fixedUpdate(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
      steps += 1;
    }

    // Avoid an unbounded catch-up spiral after a long suspension or frame stall.
    if (steps === this.maxFixedSteps && this.accumulator >= this.fixedDeltaTime) {
      this.accumulator %= this.fixedDeltaTime;
    }

    this.events.emit('engine:update', { deltaTime, fixedSteps: steps }, { target: this });
  }

  dispose(): void {
    this.stop();
    this.world.dispose();
    this.events.emit('engine:dispose', { engine: this }, { target: this });
    this.events.clear();
  }
}
