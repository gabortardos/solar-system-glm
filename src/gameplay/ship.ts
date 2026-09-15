/**
 * Gameplay layer — spaceship controller (Step 6 scope).
 * Talks to rendering ONLY through core-engine services, never directly.
 */

export type ThrottleRegime = 'orbital' | 'cruise' | 'warp';

export interface ShipState {
  readonly regime: ThrottleRegime;
  readonly speedMetersPerSecond: number;
}
