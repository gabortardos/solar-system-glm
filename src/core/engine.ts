/**
 * Engine kernel — composition root of the renderer-agnostic runtime.
 * RULE: this layer imports nothing from other project layers and never imports `three`.
 * Everything here is reusable as a background engine for future 3D games.
 */

import { EventBus } from './events';
import { GameLoop, type GameLoopOptions, type Renderable } from './loop';
import { ServiceRegistry } from './services';
import { TimeController, type TimeSnapshot } from './time';

export interface Updatable {
  /** @param dtSeconds simulation-timestep delta (already time-warp scaled). */
  update(dtSeconds: number): void;
}

export interface EngineEvents {
  'engine:start': { readonly time: TimeSnapshot };
  'engine:stop': { readonly time: TimeSnapshot };
  'time:changed': TimeSnapshot;
}

export class Engine {
  readonly version = '0.2.0-step2';

  readonly events = new EventBus<EngineEvents>();
  readonly services = new ServiceRegistry();
  readonly time: TimeController;
  readonly loop: GameLoop;

  private readonly updatables: Updatable[] = [];

  constructor(options: GameLoopOptions = {}) {
    this.time = new TimeController((snapshot) => {
      this.events.emit('time:changed', snapshot);
    });
    this.loop = new GameLoop(options);
    // Kernel updater: advances sim time first, then propagates the SCALED delta.
    this.loop.register({
      update: (dtSeconds: number): void => {
        const dtSim = this.time.advance(dtSeconds);
        for (const u of this.updatables) u.update(dtSim);
      },
    });
  }

  register(updatable: Updatable): void {
    this.updatables.push(updatable);
  }

  registerRenderer(renderable: Renderable): void {
    this.loop.registerRenderer(renderable);
  }

  start(): void {
    this.loop.start();
    this.events.emit('engine:start', { time: this.time.snapshot() });
  }

  stop(): void {
    this.loop.stop();
    this.events.emit('engine:stop', { time: this.time.snapshot() });
  }
}

