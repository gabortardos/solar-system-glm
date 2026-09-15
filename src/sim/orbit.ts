/**
 * Simulation layer — orbital mechanics (Step 4 scope).
 * Pure math (Keplerian propagation). May consume core + data contracts only.
 */

/** Keplerian orbital elements for one body around its parent. */
export interface OrbitalElements {
  readonly semiMajorAxisAu: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly periodDays: number;
}
