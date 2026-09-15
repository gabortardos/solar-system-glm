import { describe, expect, it } from 'vitest';
import {
  J2000_UTC_MS,
  type OrbitalElements,
  daysSinceJ2000,
  meanAnomalyRad,
  meanMotionRadPerDay,
  orbitalPositionAu,
  orbitalRadiusAu,
} from '../src/sim/orbit';
import { solveKeplerE, trueAnomalyRad, wrapToPi, wrapToTwoPi } from '../src/sim/kepler';

const EARTH_ELEMENTS: OrbitalElements = {
  semiMajorAxisAu: 1.0,
  eccentricity: 0.0167,
  inclinationDeg: 0.0,
  periodDays: 365.256,
  meanAnomalyDegAtEpoch: 0,
};

const CIRCULAR: OrbitalElements = {
  semiMajorAxisAu: 5.0,
  eccentricity: 0.0,
  inclinationDeg: 0.0,
  periodDays: 100,
};

describe('Step 4 — Kepler solver', () => {
  it('solves circular orbits exactly (E = M)', () => {
    for (const m of [0, 0.7, 1.9, Math.PI, 4.4, 6.2]) {
      expect(solveKeplerE(m, 0)).toBeCloseTo(wrapToPi(m), 12);
    }
  });

  it('residuals stay tiny across the e/M grid, including cometary e', () => {
    for (const e of [0.1, 0.3, 0.6, 0.9, 0.99, 0.995]) {
      for (let k = 0; k < 24; k++) {
        const m = (k / 24) * 2 * Math.PI;
        const anomalyE = solveKeplerE(m, e);
        const residual = anomalyE - e * Math.sin(anomalyE) - wrapToPi(m);
        expect(Math.abs(residual), `e=${e} m=${m}`).toBeLessThan(1e-10);
      }
    }
  });

  it('is invariant under 2*pi wrapping of the mean anomaly', () => {
    const m = 2.3;
    // Precision 8, not higher: adding 2*pi*1e6 to 2.3 itself costs ~3e-10 of
    // IEEE-754 mantissa; the solver is exact given the wrapped input it receives.
    expect(solveKeplerE(m + 2 * Math.PI * 1_000_000, 0.7)).toBeCloseTo(solveKeplerE(m, 0.7), 8);
  });

  it('rejects non-physical eccentricity', () => {
    expect(() => solveKeplerE(1, 1)).toThrow(RangeError);
    expect(() => solveKeplerE(1, -0.1)).toThrow(RangeError);
  });

  it('angle wrappers behave', () => {
    expect(wrapToPi(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapToPi(-3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapToTwoPi(-0.5)).toBeCloseTo(2 * Math.PI - 0.5, 12);
    expect(wrapToTwoPi(7)).toBeCloseTo(7 - 2 * Math.PI, 12);
  });
});

describe('Step 4 — propagation anchors', () => {
  it('Earth radius oscillates between perihelion 0.983 AU and aphelion 1.017 AU', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let d = 0; d < 365; d += 5) {
      const r = orbitalRadiusAu(EARTH_ELEMENTS, d);
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(min).toBeCloseTo(1 - 0.0167, 2);
    expect(max).toBeCloseTo(1 + 0.0167, 2);
  });

  it('Earth returns to its exact position after one sidereal period', () => {
    const start = orbitalPositionAu(EARTH_ELEMENTS, 0);
    const after = orbitalPositionAu(EARTH_ELEMENTS, 365.256);
    const mid = orbitalPositionAu(EARTH_ELEMENTS, 123.45);
    const midAfter = orbitalPositionAu(EARTH_ELEMENTS, 123.45 + 365.256);
    expect(after.x).toBeCloseTo(start.x, 9);
    expect(after.y).toBeCloseTo(start.y, 9);
    expect(after.z).toBeCloseTo(start.z, 9);
    expect(midAfter.x).toBeCloseTo(mid.x, 9);
    expect(midAfter.y).toBeCloseTo(mid.y, 9);
  });

  it('mean anomaly advances exactly 2*pi per period (warp-safe at 1e6 days)', () => {
    expect(meanAnomalyRad(EARTH_ELEMENTS, 365.256)).toBeCloseTo(0, 9);
    const huge = meanAnomalyRad(EARTH_ELEMENTS, 1_000_000);
    expect(Number.isFinite(huge)).toBe(true);
    expect(meanMotionRadPerDay(365.256)).toBeCloseTo((2 * Math.PI) / 365.256, 12);
    const pos = orbitalPositionAu(EARTH_ELEMENTS, 1_000_000);
    expect(Number.isFinite(pos.x + pos.y + pos.z)).toBe(true);
    expect(orbitalRadiusAu(EARTH_ELEMENTS, 1_000_000)).toBeLessThanOrEqual(1 + 0.0167 + 1e-9);
  });

  it('prograde motion sweeps monotonically counter-clockwise in the plane', () => {
    let previous = -Infinity;
    for (let k = 0; k <= 72; k++) {
      const t = (k / 72) * 100;
      const p = orbitalPositionAu(CIRCULAR, t);
      const angle = Math.atan2(p.y, p.x);
      const unwrapped =
        k === 0 ? angle : angle + 2 * Math.PI * Math.round((previous - angle) / (2 * Math.PI));
      expect(unwrapped).toBeGreaterThan(previous);
      previous = unwrapped;
    }
  });

  it('inclination tilts motion out of the ecliptic exactly as specified', () => {
    const polar: OrbitalElements = { ...CIRCULAR, inclinationDeg: 90, periodDays: 400 };
    const p = orbitalPositionAu(polar, 100); // a quarter of the period: nu = 90 deg
    expect(Math.hypot(p.x, p.y)).toBeLessThan(1e-9);
    expect(p.z).toBeCloseTo(5, 6);
    expect(orbitalPositionAu(CIRCULAR, 100).z).toBe(0);
  });

  it('true anomaly formula round-trips through the solver', () => {
    const e = 0.6;
    const anomalyE = solveKeplerE(1.1, e);
    expect(trueAnomalyRad(anomalyE, e)).toBeGreaterThan(0);
    expect(trueAnomalyRad(-anomalyE, e)).toBeCloseTo(-trueAnomalyRad(anomalyE, e), 12);
  });

  it('J2000 epoch conversion is exact', () => {
    expect(daysSinceJ2000(new Date(J2000_UTC_MS))).toBe(0);
    expect(daysSinceJ2000(new Date(J2000_UTC_MS + 86_400_000))).toBe(1);
  });
});
