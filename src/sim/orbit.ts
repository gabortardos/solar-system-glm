/**
 * Simulation layer — orbital mechanics (Step 4).
 * Pure math (Keplerian propagation). May consume core + data contracts only;
 * data.OrbitRecord is structurally compatible with OrbitalElements, so catalog
 * records can be propagated with zero adapter code.
 */

import { solveKeplerE, trueAnomalyRad, wrapToTwoPi } from './kepler';
import type { Vec3 } from './vec';

/** Keplerian orbital elements for one body around its parent. */
export interface OrbitalElements {
  readonly semiMajorAxisAu: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly periodDays: number;
  /** Mean anomaly at epoch, degrees (approximate J2000). Defaults to 0. */
  readonly meanAnomalyDegAtEpoch?: number;
  readonly longitudeOfAscendingNodeDeg?: number;
  readonly argumentOfPeriapsisDeg?: number;
}

/** J2000.0 epoch: 2000-01-01 12:00 TT, the instant our element epochs refer to. */
export const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12);

/** Convert a wall-clock date to days elapsed since the J2000 epoch. */
export function daysSinceJ2000(date: Date): number {
  return (date.getTime() - J2000_UTC_MS) / 86_400_000;
}

const DEG2RAD = Math.PI / 180;

/** Mean motion n = 2*pi / P in radians per day. */
export function meanMotionRadPerDay(periodDays: number): number {
  return (2 * Math.PI) / periodDays;
}

/** Mean anomaly (rad, wrapped to [0, 2pi)) after `days` elapsed since epoch. */
export function meanAnomalyRad(elements: OrbitalElements, daysSinceEpoch: number): number {
  const m0 = (elements.meanAnomalyDegAtEpoch ?? 0) * DEG2RAD;
  return wrapToTwoPi(m0 + meanMotionRadPerDay(elements.periodDays) * daysSinceEpoch);
}

/**
 * Orbital radius (distance to parent) in AU after `daysSinceEpoch`.
 * Always within [a·(1-e), a·(1+e)] — Kepler's first law.
 */
export function orbitalRadiusAu(elements: OrbitalElements, daysSinceEpoch: number): number {
  const { semiMajorAxisAu: a, eccentricity: e } = elements;
  const anomalyE = solveKeplerE(meanAnomalyRad(elements, daysSinceEpoch), e);
  return a * (1 - e * Math.cos(anomalyE));
}

/**
 * Position of the orbiting body relative to its parent, in AU, ecliptic frame
 * (+z = north ecliptic pole). Rotation composite: Rz(Omega) * Rx(i) * Rz(omega).
 */
export function orbitalPositionAu(elements: OrbitalElements, daysSinceEpoch: number): Vec3 {
  const { semiMajorAxisAu: a, eccentricity: e } = elements;
  const anomalyE = solveKeplerE(meanAnomalyRad(elements, daysSinceEpoch), e);
  const nu = trueAnomalyRad(anomalyE, e);
  const radius = a * (1 - e * Math.cos(anomalyE));

  // Perifocal (orbital-plane) coordinates.
  const xp = radius * Math.cos(nu);
  const yp = radius * Math.sin(nu);

  const omega = (elements.argumentOfPeriapsisDeg ?? 0) * DEG2RAD;
  const inclination = elements.inclinationDeg * DEG2RAD;
  const node = (elements.longitudeOfAscendingNodeDeg ?? 0) * DEG2RAD;

  // Rz(omega)
  const x1 = xp * Math.cos(omega) - yp * Math.sin(omega);
  const y1 = xp * Math.sin(omega) + yp * Math.cos(omega);
  // Rx(i)
  const y2 = y1 * Math.cos(inclination);
  const z2 = y1 * Math.sin(inclination);
  // Rz(Omega)
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);

  return {
    x: x1 * cosNode - y2 * sinNode,
    y: x1 * sinNode + y2 * cosNode,
    z: z2,
  };
}

