/**
 * Engine kernel — Step 2 scope (renderer-agnostic).
 * Will host: fixed-timestep game loop, event bus, service registry, time controller.
 * RULE: this layer imports NOTHING from other project layers and never imports `three`.
 */

export interface Updatable {
  /** @param dtSeconds fixed simulation timestep in seconds. */
  update(dtSeconds: number): void;
}

export class Engine {
  readonly version = '0.1.0-step1';

  /** Systems registered with the kernel; driven by the fixed-step loop from Step 2. */
  readonly updatables: readonly Updatable[] = [];
}
