/**
 * Engine kernel — fixed-timestep game loop with render interpolation.
 * The scheduler is injectable so the kernel is testable headless (no browser needed).
 */

import type { Updatable } from './engine';

export interface Renderable {
  /** @param alpha interpolation factor in [0,1) between the last two fixed steps. */
  render(alpha: number): void;
}

export interface FrameScheduler {
  requestFrame(callback: (timestampMs: number) => void): void;
  cancelFrame(): void;
}

/** Default browser scheduler. */
export class RafScheduler implements FrameScheduler {
  private handle: number | null = null;

  requestFrame(callback: (timestampMs: number) => void): void {
    this.handle = requestAnimationFrame(callback);
  }

  cancelFrame(): void {
    if (this.handle !== null) cancelAnimationFrame(this.handle);
    this.handle = null;
  }
}

export interface GameLoopOptions {
  /** Fixed simulation step in milliseconds. Default 1000/60 (60 Hz). */
  readonly fixedStepMs?: number;
  /** Hard cap on catch-up steps per frame — prevents spiral of death. Default 10. */
  readonly maxCatchUpSteps?: number;
  /** Frame source; defaults to requestAnimationFrame. */
  readonly scheduler?: FrameScheduler;
}

export class GameLoop {
  private readonly stepMs: number;
  private readonly maxCatchUp: number;
  private readonly scheduler: FrameScheduler;
  private readonly updatables: Updatable[] = [];
  private readonly renderers: Renderable[] = [];
  private running = false;
  private lastTimestampMs: number | null = null;
  private accumulatorMs = 0;

  constructor(options: GameLoopOptions = {}) {
    this.stepMs = options.fixedStepMs ?? 1000 / 60;
    this.maxCatchUp = options.maxCatchUpSteps ?? 10;
    this.scheduler = options.scheduler ?? new RafScheduler();
  }

  register(updatable: Updatable): void {
    this.updatables.push(updatable);
  }

  registerRenderer(renderable: Renderable): void {
    this.renderers.push(renderable);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestampMs = null;
    this.accumulatorMs = 0;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.scheduler.cancelFrame();
  }

  get isRunning(): boolean {
    return this.running;
  }

  private schedule(): void {
    if (!this.running) return;
    this.scheduler.requestFrame((ts) => this.frame(ts));
  }

  private frame(timestampMs: number): void {
    if (!this.running) return;

    if (this.lastTimestampMs === null) {
      // Warm-up frame: establishes the time origin; no work this frame.
      this.lastTimestampMs = timestampMs;
      this.schedule();
      return;
    }

    let frameDtMs = timestampMs - this.lastTimestampMs;
    this.lastTimestampMs = timestampMs;
    if (frameDtMs < 0) frameDtMs = 0;
    if (frameDtMs > 250) frameDtMs = 250; // clamp huge hitches

    this.accumulatorMs += frameDtMs;

    const dtSeconds = this.stepMs / 1000;
    let steps = 0;
    while (this.accumulatorMs >= this.stepMs && steps < this.maxCatchUp) {
      this.accumulatorMs -= this.stepMs;
      steps += 1;
      for (const u of this.updatables) u.update(dtSeconds);
    }
    if (steps === this.maxCatchUp) {
      // Backlog exceeded the catch-up budget: drop remainder, keep cadence healthy.
      this.accumulatorMs = 0;
    }

    const alpha = this.accumulatorMs / this.stepMs;
    for (const r of this.renderers) r.render(alpha);
    this.schedule();
  }
}
