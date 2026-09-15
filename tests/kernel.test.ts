import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/events';
import { GameLoop } from '../src/core/loop';
import { MAX_TIME_SCALE, MIN_TIME_SCALE, TimeController } from '../src/core/time';
import { createServiceKey, ServiceRegistry } from '../src/core/services';
import { Engine } from '../src/core/engine';

/** Deterministic headless frame source — lets the kernel run inside CI with no browser. */
class FakeScheduler {
  private cb: ((ts: number) => void) | null = null;
  private time = 0;

  requestFrame(cb: (ts: number) => void): void {
    this.cb = cb;
  }

  cancelFrame(): void {
    this.cb = null;
  }

  advance(dtMs: number): void {
    this.time += dtMs;
    this.cb?.(this.time);
  }

  get hasPending(): boolean {
    return this.cb !== null;
  }
}

describe('Step 2 — kernel: event bus', () => {
  it('delivers events in subscription order', () => {
    const bus = new EventBus<{ ping: number }>();
    const order: string[] = [];
    bus.on('ping', () => {
      order.push('a');
    });
    bus.on('ping', () => {
      order.push('b');
    });
    bus.emit('ping', 1);
    expect(order).toEqual(['a', 'b']);
  });

  it('once() fires a single time; unsubscribe works', () => {
    const bus = new EventBus<{ ping: number }>();
    const once = vi.fn();
    const steady = vi.fn();
    bus.once('ping', once);
    const off = bus.on('ping', steady);
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(once).toHaveBeenCalledTimes(1);
    expect(steady).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('handlers may unsubscribe during dispatch without breaking delivery', () => {
    const bus = new EventBus<{ ping: number }>();
    const seen: number[] = [];
    bus.on('ping', (p) => {
      seen.push(p);
    });
    const offSelf = bus.on('ping', () => {
      offSelf();
    });
    bus.emit('ping', 7);
    bus.emit('ping', 8);
    expect(seen).toEqual([7, 8]);
  });

  it('emitting an event with no listeners is a no-op', () => {
    const bus = new EventBus<{ ghost: string }>();
    expect(() => bus.emit('ghost', 'boo')).not.toThrow();
  });
});

describe('Step 2 — kernel: time controller', () => {
  it('advances real and simulation time at 1x', () => {
    const t = new TimeController();
    expect(t.advance(2)).toBe(2);
    const snap = t.snapshot();
    expect(snap.simulationSeconds).toBe(2);
    expect(snap.realSeconds).toBe(2);
    expect(snap.timeScale).toBe(1);
    expect(snap.paused).toBe(false);
  });

  it('scales simulation deltas and clamps to the warp envelope', () => {
    const t = new TimeController();
    t.setTimeScale(1_000);
    expect(t.advance(1)).toBe(1_000);
    t.setTimeScale(Number.MAX_SAFE_INTEGER);
    expect(t.currentScale).toBe(MAX_TIME_SCALE);
    t.setTimeScale(0);
    expect(t.currentScale).toBe(MIN_TIME_SCALE);
  });

  it('pause freezes simulation while real time continues', () => {
    const t = new TimeController();
    t.advance(5);
    t.setPaused(true);
    expect(t.advance(10)).toBe(0);
    expect(t.snapshot().simulationSeconds).toBe(5);
    expect(t.snapshot().realSeconds).toBe(15);
    t.togglePause();
    expect(t.isPaused).toBe(false);
  });

  it('notifies on control changes but not on plain advance', () => {
    const onChange = vi.fn();
    const t = new TimeController(onChange);
    t.advance(1);
    expect(onChange).not.toHaveBeenCalled();
    t.setPaused(true);
    t.setTimeScale(60);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe('Step 2 — kernel: game loop', () => {
  it('runs one fixed update per 60 Hz frame and provides alpha', () => {
    const scheduler = new FakeScheduler();
    const loop = new GameLoop({ fixedStepMs: 16, scheduler });
    const updates = vi.fn();
    let lastAlpha = -1;
    loop.register({ update: updates });
    loop.registerRenderer({
      render: (a: number): void => {
        lastAlpha = a;
      },
    });

    loop.start();
    scheduler.advance(0); // warm-up frame establishes t0
    scheduler.advance(16); // exactly one step
    expect(updates).toHaveBeenCalledTimes(1);
    expect(lastAlpha).toBe(0);
    scheduler.advance(16);
    expect(updates).toHaveBeenCalledTimes(2);
    expect(loop.isRunning).toBe(true);
  });

  it('interpolates alpha on fractional frames', () => {
    const scheduler = new FakeScheduler();
    const loop = new GameLoop({ fixedStepMs: 16, scheduler });
    let lastAlpha = -1;
    loop.registerRenderer({
      render: (a: number): void => {
        lastAlpha = a;
      },
    });
    loop.start();
    scheduler.advance(0);
    scheduler.advance(20); // 1 step consumed (16 ms), 4 ms carry -> alpha 0.25
    expect(lastAlpha).toBeCloseTo(0.25, 10);
  });

  it('catches up multiple steps after a hitch, capped by maxCatchUpSteps', () => {
    const scheduler = new FakeScheduler();
    const loop = new GameLoop({ fixedStepMs: 16, maxCatchUpSteps: 10, scheduler });
    const updates = vi.fn();
    loop.register({ update: updates });
    loop.start();
    scheduler.advance(0);
    scheduler.advance(100); // floor(100/16) = 6 steps
    expect(updates).toHaveBeenCalledTimes(6);
    scheduler.advance(1_000); // clamped hitch -> capped at 10 more steps
    expect(updates).toHaveBeenCalledTimes(16);
  });

  it('ignores the warm-up frame and stops cleanly', () => {
    const scheduler = new FakeScheduler();
    const loop = new GameLoop({ fixedStepMs: 16, scheduler });
    const updates = vi.fn();
    loop.register({ update: updates });
    loop.start();
    scheduler.advance(5_000); // warm-up only — no update, no panic
    expect(updates).not.toHaveBeenCalled();
    loop.stop();
    scheduler.advance(32);
    expect(updates).not.toHaveBeenCalled();
    expect(scheduler.hasPending).toBe(false);
    expect(loop.isRunning).toBe(false);
  });
});

describe('Step 2 — kernel: service registry', () => {
  it('stores and retrieves typed services', () => {
    const registry = new ServiceRegistry();
    const key = createServiceKey<{ answer: number }>('oracle');
    expect(registry.has(key)).toBe(false);
    expect(() => registry.get(key)).toThrow(/not registered/);
    registry.set(key, { answer: 42 });
    expect(registry.get(key).answer).toBe(42);
    expect(registry.has(key)).toBe(true);
  });
});

describe('Step 2 — kernel: engine wiring', () => {
  it('drives updatables with time-warp-scaled deltas and emits lifecycle events', () => {
    const scheduler = new FakeScheduler();
    const engine = new Engine({ fixedStepMs: 16, scheduler });
    const upd = { update: vi.fn() };
    const started = vi.fn();
    engine.events.on('engine:start', started);
    engine.register(upd);

    engine.start();
    expect(started).toHaveBeenCalledTimes(1);
    scheduler.advance(0);
    scheduler.advance(16);
    expect(upd.update).toHaveBeenCalledTimes(1);
    expect(engine.time.snapshot().simulationSeconds).toBeCloseTo(0.016, 12);

    engine.time.setTimeScale(2);
    scheduler.advance(16);
    expect(upd.update).toHaveBeenCalledTimes(2);
    const lastDt = upd.update.mock.calls.at(-1)?.[0] ?? Number.NaN;
    expect(lastDt).toBeCloseTo(0.032, 10);

    engine.time.setPaused(true);
    scheduler.advance(16);
    expect(upd.update).toHaveBeenCalledTimes(3); // updater still ticks...
    const pausedDt = upd.update.mock.calls.at(-1)?.[0] ?? Number.NaN;
    expect(pausedDt).toBe(0); // ...but with a zero simulation delta
  });
});

