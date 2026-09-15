/**
 * Simulation layer — Kepler's equation solver.
 * M = E - e·sin(E); solved with Newton-Raphson and a guaranteed bisection guard.
 */

/** Wrap any angle to (-pi, pi] for best convergence behaviour. */
export function wrapToPi(angleRad: number): number {
  const twoPi = 2 * Math.PI;
  const wrapped = ((angleRad + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Wrap any angle to [0, 2pi). */
export function wrapToTwoPi(angleRad: number): number {
  const twoPi = 2 * Math.PI;
  return ((angleRad % twoPi) + twoPi) % twoPi;
}

/**
 * Solve Kepler's equation for the eccentric anomaly E.
 *
 * Newton-Raphson converges quadratically near the root; for extreme cometary
 * eccentricities near perihelion we fall back to bisection, which is guaranteed
 * because f(E) = E - e·sinE - m is strictly monotonic for 0 <= e < 1.
 *
 * @throws RangeError when eccentricity is outside [0, 1).
 */
export function solveKeplerE(
  meanAnomalyRad: number,
  eccentricity: number,
  tolerance = 1e-12,
  maxNewtonIterations = 64,
): number {
  const e = eccentricity;
  if (!Number.isFinite(e) || e < 0 || e >= 1) {
    throw new RangeError(`eccentricity must satisfy 0 <= e < 1 (got ${e})`);
  }
  const m = wrapToPi(meanAnomalyRad);

  // Classic start: E0 = m for mild orbits, E0 = pi for cometary ones.
  let eccentricAnomaly = e < 0.8 ? m : Math.PI;
  for (let i = 0; i < maxNewtonIterations; i++) {
    const f = eccentricAnomaly - e * Math.sin(eccentricAnomaly) - m;
    const fPrime = 1 - e * Math.cos(eccentricAnomaly);
    const step = f / fPrime;
    eccentricAnomaly -= step;
    if (Math.abs(step) <= tolerance) return eccentricAnomaly;
  }

  // Bisection guard. For wrapped m in [-pi, pi]:
  //   f(m - e - 1) = -e - 1 - e·sin(...) < 0   and   f(m + e + 1) = e + 1 - e·sin(...) > 0
  let lo = m - e - 1;
  let hi = m + e + 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) - m <= 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** True anomaly (rad) from eccentric anomaly and eccentricity. */
export function trueAnomalyRad(eccentricAnomaly: number, eccentricity: number): number {
  const e = eccentricity;
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - e) * Math.cos(eccentricAnomaly / 2),
  );
}
