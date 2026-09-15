/**
 * Engine kernel — simulation time controller.
 * Owns pause state and time-warp scaling (1x .. 1,000,000x). Pure logic, no DOM.
 */

export const MIN_TIME_SCALE = 1;
export const MAX_TIME_SCALE = 1_000_000;

export interface TimeSnapshot {
  readonly paused: boolean;
  readonly timeScale: number;
  readonly simulationSeconds: number;
  readonly realSeconds: number;
}

export class TimeController {
  private paused = false;
  private timeScale = 1;
  private simulationSeconds = 0;
  private realSeconds = 0;

  constructor(private readonly onChange?: (snapshot: TimeSnapshot) => void) {}

  /** Advance both clocks by real elapsed seconds; returns scaled sim delta (0 when paused). */
  advance(dtRealSeconds: number): number {
    this.realSeconds += dtRealSeconds;
    const dtSim = this.paused ? 0 : dtRealSeconds * this.timeScale;
    this.simulationSeconds += dtSim;
    return dtSim;
  }

  setPaused(paused: boolean): void {
    if (this.paused !== paused) {
      this.paused = paused;
      this.notify();
    }
  }

  togglePause(): void {
    this.setPaused(!this.paused);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Clamp into [MIN_TIME_SCALE, MAX_TIME_SCALE]. */
  setTimeScale(scale: number): void {
    const clamped = Math.min(MAX_TIME_SCALE, Math.max(MIN_TIME_SCALE, scale));
    if (this.timeScale !== clamped) {
      this.timeScale = clamped;
      this.notify();
    }
  }

  get currentScale(): number {
    return this.timeScale;
  }

  snapshot(): TimeSnapshot {
    return {
      paused: this.paused,
      timeScale: this.timeScale,
      simulationSeconds: this.simulationSeconds,
      realSeconds: this.realSeconds,
    };
  }

  private notify(): void {
    this.onChange?.(this.snapshot());
  }
}
