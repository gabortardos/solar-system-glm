import { describe, expect, it } from 'vitest';
import {
  type OrbitalElements,
  daysSinceJ2000,
  orbitalPositionAu,
  orbitalRadiusAu,
} from '../src/sim/orbit';
import { CELESTIAL_CATALOG, getCelestial } from '../src/data/catalog';

describe('Step 4 — catalog cross-validation', () => {
  it('every orbiting body stays inside its osculating annulus for all sampled times', () => {
    const orbiting = CELESTIAL_CATALOG.filter((b) => b.orbit !== undefined);
    expect(orbiting.length).toBeGreaterThanOrEqual(45);
    for (const body of orbiting) {
      const el = body.orbit!;
      const inner = el.semiMajorAxisAu * (1 - el.eccentricity);
      const outer = el.semiMajorAxisAu * (1 + el.eccentricity);
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * el.periodDays + 13.7;
        const r = orbitalRadiusAu(el, t);
        expect(r, `${body.id} below pericentre`).toBeGreaterThanOrEqual(inner - 1e-9);
        expect(r, `${body.id} above apocentre`).toBeLessThanOrEqual(outer + 1e-9);
        const p = orbitalPositionAu(el, t);
        expect(Number.isFinite(p.x + p.y + p.z), `${body.id} finite`).toBe(true);
        expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(r, 9);
      }
    }
  });

  it("Kepler's third law holds for every Sun-orbiting body (~133,400 d^2/AU^3)", () => {
    for (const body of CELESTIAL_CATALOG) {
      if (body.parentId !== 'sun' || body.orbit === undefined) continue;
      const { semiMajorAxisAu: a, periodDays: p } = body.orbit;
      const ratio = (p * p) / (a * a * a);
      expect(ratio / 133_412 - 1, `${body.id} P^2/a^3`).toBeLessThan(0.03);
    }
  });

  it("Halley's perihelion distance reproduces the published 0.586 AU", () => {
    const halley = getCelestial('halley')!.orbit!;
    const perihelion = orbitalRadiusAu({ ...halley, meanAnomalyDegAtEpoch: 0 }, 0);
    expect(perihelion).toBeCloseTo(0.586, 1);
  });

  it('data.OrbitRecord is structurally propagatable as sim OrbitalElements', () => {
    const earth = getCelestial('earth')!.orbit!;
    const elements: OrbitalElements = earth;
    const r = orbitalRadiusAu(elements, daysSinceJ2000(new Date()));
    expect(r).toBeGreaterThan(0.98);
    expect(r).toBeLessThan(1.02);
  });

  it('retrograde Triton: inclination mirror flips in-plane motion, not height', () => {
    const triton = getCelestial('triton')!.orbit!;
    const retrograde = orbitalPositionAu(
      { ...triton, inclinationDeg: 156.885, meanAnomalyDegAtEpoch: 90 },
      0,
    );
    const mirrored = orbitalPositionAu(
      { ...triton, inclinationDeg: 180 - 156.885, meanAnomalyDegAtEpoch: 90 },
      0,
    );
    // sin(180-i) = sin(i): out-of-plane height is preserved; cos(180-i) = -cos(i):
    // the in-plane y component flips. That inversion *is* the retrograde marker.
    expect(retrograde.z).toBeCloseTo(mirrored.z, 6);
    expect(retrograde.y).toBeCloseTo(-mirrored.y, 6);
  });

  it('retrograde orbits sweep clockwise as seen from ecliptic north', () => {
    const triton = getCelestial('triton')!.orbit!;
    const sweep = (inclinationDeg: number): number[] => {
      const angles: number[] = [];
      for (let k = 0; k <= 6; k++) {
        const p = orbitalPositionAu(
          { ...triton, inclinationDeg, longitudeOfAscendingNodeDeg: 0, argumentOfPeriapsisDeg: 0 },
          (k / 24) * triton.periodDays,
        );
        angles.push(Math.atan2(p.y, p.x));
      }
      return angles;
    };
    // Steps are ~24 degrees, so atan2 never wraps across +/-pi here.
    const retro = sweep(156.885);
    const prograde = sweep(23.115);
    for (let k = 0; k < 6; k++) {
      expect(retro[k + 1]! - retro[k]!, 'retrograde step is clockwise').toBeLessThan(0);
      expect(prograde[k + 1]! - prograde[k]!, 'prograde step is counter-clockwise').toBeGreaterThan(0);
    }
  });

  it('moons propagate in their parent-centric frames', () => {
    const titan = getCelestial('titan')!.orbit!;
    const p = orbitalPositionAu(titan, titan.periodDays / 4);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(titan.semiMajorAxisAu, 3);
    expect(p.z / titan.semiMajorAxisAu).toBeLessThan(0.01); // nearly equatorial orbit
  });
});
