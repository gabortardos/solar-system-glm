import { describe, expect, it } from 'vitest';
import type { CelestialBodyRecord } from '../src/data/schema';
import { validateCatalog } from '../src/data/validation';
import {
  CELESTIAL_BY_ID,
  CELESTIAL_CATALOG,
  EARTH_ID,
  PLANET_IDS,
  SUN_ID,
  bodiesOfKind,
  childrenOf,
  getCelestial,
} from '../src/data/catalog';

describe('Step 3 — celestial data registry', () => {
  it('passes full integrity validation with zero issues', () => {
    expect(validateCatalog(CELESTIAL_CATALOG)).toEqual([]);
  });

  it('contains the expected taxonomy (48 bodies)', () => {
    expect(bodiesOfKind('star')).toHaveLength(1);
    expect(bodiesOfKind('planet')).toHaveLength(8);
    expect(bodiesOfKind('dwarf-planet')).toHaveLength(5);
    expect(bodiesOfKind('moon').length).toBeGreaterThanOrEqual(20);
    expect(bodiesOfKind('belt')).toHaveLength(2);
    expect(bodiesOfKind('asteroid').length).toBeGreaterThanOrEqual(1);
    expect(bodiesOfKind('comet').length).toBeGreaterThanOrEqual(2);
    expect(CELESTIAL_CATALOG.length).toBeGreaterThanOrEqual(40);
  });

  it('has unique ids and a complete lookup map', () => {
    const ids = CELESTIAL_CATALOG.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const body of CELESTIAL_CATALOG) {
      expect(CELESTIAL_BY_ID.get(body.id)).toBe(body);
    }
  });

  it('all eight planets orbit the Sun with full orbital elements', () => {
    for (const pid of PLANET_IDS) {
      const planet = getCelestial(pid);
      expect(planet, `planet ${pid} must exist`).toBeDefined();
      expect(planet?.parentId).toBe(SUN_ID);
      expect(planet?.orbit).toBeDefined();
    }
  });

  it('Earth–Moon linkage is correct', () => {
    const earth = getCelestial(EARTH_ID);
    expect(earth?.radiusKm).toBeCloseTo(6371, -1);
    expect(getCelestial('moon')?.parentId).toBe(EARTH_ID);
    expect(childrenOf(EARTH_ID).map((c) => c.id)).toContain('moon');
  });

  it('orbital elements are physically sane for every orbiting body', () => {
    for (const body of CELESTIAL_CATALOG) {
      if (body.orbit === undefined) continue;
      expect(body.orbit.eccentricity, `${body.id} e >= 0`).toBeGreaterThanOrEqual(0);
      expect(body.orbit.eccentricity, `${body.id} e < 1`).toBeLessThan(1);
      expect(body.orbit.semiMajorAxisAu, `${body.id} a > 0`).toBeGreaterThan(0);
      expect(body.orbit.periodDays, `${body.id} P > 0`).toBeGreaterThan(0);
      expect(Math.abs(body.orbit.inclinationDeg), `${body.id} |i| <= 180`).toBeLessThanOrEqual(180);
    }
  });

  it('known anchor values match published astronomy', () => {
    expect(getCelestial('mercury')?.orbit?.periodDays).toBeCloseTo(87.97, 1);
    expect(getCelestial('earth')?.orbit?.periodDays).toBeCloseTo(365.256, 2);
    expect(getCelestial('earth')?.orbit?.semiMajorAxisAu).toBeCloseTo(1.0, 5);
    expect(getCelestial('jupiter')?.orbit?.periodDays).toBeCloseTo(4332.59, -1);
    expect(getCelestial('neptune')?.orbit?.periodDays).toBeCloseTo(60189, -2);
    expect(getCelestial('pluto')?.orbit?.semiMajorAxisAu).toBeCloseTo(39.482, 2);
    expect(getCelestial('sun')?.radiusKm).toBeCloseTo(696340, -3);
  });

  it('retrograde markers appear where astronomy expects them', () => {
    expect(getCelestial('venus')?.rotationPeriodHours).toBeLessThan(0);
    expect(getCelestial('uranus')?.rotationPeriodHours).toBeLessThan(0);
    expect(getCelestial('pluto')?.rotationPeriodHours).toBeLessThan(0);
    expect(getCelestial('triton')?.orbit?.inclinationDeg).toBeGreaterThan(90);
    expect(getCelestial('halley')?.orbit?.inclinationDeg).toBeGreaterThan(90);
  });

  it('belt dimensions are positive and ordered', () => {
    const belt = getCelestial('asteroid-belt')?.belt;
    expect(belt?.innerRadiusAu).toBeGreaterThan(0);
    expect(belt?.outerRadiusAu).toBeGreaterThan(belt?.innerRadiusAu ?? Number.POSITIVE_INFINITY);
    const kuiper = getCelestial('kuiper-belt')?.belt;
    expect(kuiper?.innerRadiusAu).toBeCloseTo(30, 0);
    expect(kuiper?.outerRadiusAu).toBeCloseTo(50, 0);
  });

  it('Jupiter and Saturn moon systems are well-formed', () => {
    const jovian = childrenOf('jupiter').map((c) => c.id);
    for (const moon of ['io', 'europa', 'ganymede', 'callisto']) {
      expect(jovian).toContain(moon);
    }
    expect(childrenOf('saturn').length).toBeGreaterThanOrEqual(7);
    expect(getCelestial('titan')?.radiusKm).toBeGreaterThan(2500);
    expect(getCelestial('ganymede')?.radiusKm).toBeGreaterThan(
      getCelestial('mercury')?.radiusKm ?? 0,
    );
  });

  it('validator catches injected corruption (guard self-test)', () => {
    const bad = [
      {
        id: 'x', name: 'X', kind: 'moon', parentId: 'earth', radiusKm: -1,
        summary: 's', facts: ['f'], colorHex: 'red',
        orbit: { semiMajorAxisAu: 1, eccentricity: 1.5, inclinationDeg: 5, periodDays: 1 },
      },
      {
        id: 'y', name: 'Y', kind: 'belt', parentId: 'nowhere',
        summary: 's', facts: ['f'], colorHex: '#AABBCC',
        belt: { innerRadiusAu: 3, outerRadiusAu: 2, estimatedObjects: 10 },
      },
      {
        id: 'x', name: '', kind: 'comet', parentId: 'sun', radiusKm: 1,
        summary: '', facts: [], colorHex: '#123456',
        orbit: { semiMajorAxisAu: -2, eccentricity: -0.1, inclinationDeg: 5, periodDays: -1 },
      },
    ] as unknown as readonly CelestialBodyRecord[];
    const issues = validateCatalog(bad);
    expect(issues.length).toBeGreaterThanOrEqual(12);
    expect(issues.some((i) => i.problem.includes('duplicate id'))).toBe(true);
    expect(issues.some((i) => i.problem.includes('unknown parentId'))).toBe(true);
    expect(issues.some((i) => i.problem.includes('eccentricity'))).toBe(true);
  });
});
