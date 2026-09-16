/**
 * Navigation & discovery tests — focus cycling, travel arrival, framing,
 * teleport speed clamp, info formatters, and search matching (Steps 7/8).
 */

import { describe, expect, it } from 'vitest';
import { CELESTIAL_CATALOG, type CelestialBodyRecord } from '../src/data/catalog';
import { ShipController, SHIP_SPEED_PROFILES } from '../src/gameplay/ship';
import { cycleFocus, focusableBodies, travelArrival } from '../src/gameplay/targeting';
import { framingDistanceScene } from '../src/render/scale';
import {
  formatMassKg,
  formatPeriodDays,
  formatRadiusKm,
  formatRotationHours,
  kindLabel,
} from '../src/ui/format';
import { buildSearchEntries, matchBodies } from '../src/ui/search';

function rec(id: string, name: string, parentId: string | null): CelestialBodyRecord {
  return { id, name, kind: 'planet', parentId, summary: '', facts: [], colorHex: '#ffffff' };
}

describe('focus targeting', () => {
  it('lists the Sun first and only bodies with propagated orbits', () => {
    const focusable = focusableBodies(CELESTIAL_CATALOG);
    expect(focusable[0]!.id).toBe('sun');
    expect(focusable.every((b) => b.id === 'sun' || b.orbit !== undefined)).toBe(true);
    expect(focusable.length).toBeGreaterThan(40);
  });

  it('cycles forward from null to the Sun, then through catalog order', () => {
    const bodies = [rec('sun', 'Sun', null), rec('earth', 'Earth', 'sun'), rec('luna', 'Luna', 'earth')];
    expect(cycleFocus(null, bodies).id).toBe('sun');
    expect(cycleFocus('sun', bodies).id).toBe('earth');
    expect(cycleFocus('earth', bodies).id).toBe('luna');
  });

  it('wraps in both directions and starts at the tail when stepping back from null', () => {
    const bodies = [rec('sun', 'Sun', null), rec('earth', 'Earth', 'sun'), rec('luna', 'Luna', 'earth')];
    expect(cycleFocus('luna', bodies).id).toBe('sun');
    expect(cycleFocus('sun', bodies, -1).id).toBe('luna');
    expect(cycleFocus(null, bodies, -1).id).toBe('luna');
  });

  it('treats an unknown focus id as a fresh start', () => {
    const bodies = [rec('sun', 'Sun', null), rec('earth', 'Earth', 'sun')];
    expect(cycleFocus('alpha-centauri', bodies).id).toBe('sun');
  });
});

describe('travelArrival', () => {
  /** toEqual treats -0 ≠ 0; normalize signed zeros away (behaviour is identical). */
  const norm = (v: { x: number; y: number; z: number }): { x: number; y: number; z: number } => ({
    x: v.x + 0,
    y: v.y + 0,
    z: v.z + 0,
  });

  it('arrives on the ship side of the body at the standoff distance, nose at the body', () => {
    const plan = travelArrival({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 2);
    expect(norm(plan.position)).toEqual({ x: 8, y: 0, z: 0 });
    expect(norm(plan.lookDirection)).toEqual({ x: 2, y: 0, z: 0 });
  });

  it('falls back to the anti-sunward side when ship sits on the body', () => {
    const plan = travelArrival({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 2);
    expect(norm(plan.position)).toEqual({ x: 12, y: 0, z: 0 });
    expect(norm(plan.lookDirection)).toEqual({ x: -2, y: 0, z: 0 });
  });

  it('falls back to +X when body and ship are both at the origin', () => {
    const plan = travelArrival({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 3);
    expect(norm(plan.position)).toEqual({ x: 3, y: 0, z: 0 });
    expect(norm(plan.lookDirection)).toEqual({ x: -3, y: 0, z: 0 });
  });
});

describe('framingDistanceScene', () => {
  it('frames at six radii in true mode', () => {
    expect(framingDistanceScene(0.01, 'true')).toBeCloseTo(0.06);
  });

  it('floors at 2.5 units in compressed mode for small bodies', () => {
    expect(framingDistanceScene(0.05, 'compressed')).toBe(2.5);
    expect(framingDistanceScene(2, 'compressed')).toBe(12);
  });
});

describe('ShipController.teleport speed', () => {
  const envelope = { ...SHIP_SPEED_PROFILES.compressed, minSunDistance: 5 };

  it('clamps an absurd speed into the envelope', () => {
    const ship = new ShipController(envelope, {
      position: { x: 0, y: 0, z: 0 },
      lookDirection: { x: 1, y: 0, z: 0 },
    });
    ship.teleport({ x: 30, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 1e9);
    expect(ship.speed).toBe(envelope.maxSpeed);
  });

  it('clamps a near-zero speed up to the envelope minimum', () => {
    const ship = new ShipController(envelope, {
      position: { x: 0, y: 0, z: 0 },
      lookDirection: { x: 1, y: 0, z: 0 },
    });
    ship.teleport({ x: 30, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 1e-6);
    expect(ship.speed).toBe(envelope.minSpeed);
  });
});

describe('info formatters', () => {
  it('formats periods as days below a year and years at/above it', () => {
    expect(formatPeriodDays(88)).toBe('88.0 d');
    expect(formatPeriodDays(365.25)).toBe('1.00 yr');
    expect(formatPeriodDays(687)).toBe('1.88 yr');
  });

  it('formats rotation in hours, switching to days at 48h', () => {
    expect(formatRotationHours(23.9345)).toBe('23.9 h');
    expect(formatRotationHours(-5832.5)).toBe('-243.0 d');
  });

  it('formats mass in scientific notation and radii with separators', () => {
    expect(formatMassKg(5.972e24)).toBe('5.97 × 10^24 kg');
    expect(formatMassKg(0)).toBe('—');
    expect(formatRadiusKm(6371)).toBe('6,371 km');
    expect(formatRadiusKm(undefined)).toBe('—');
  });

  it('labels kinds, splitting dwarf-planet into two words', () => {
    expect(kindLabel('dwarf-planet')).toBe('Dwarf planet');
    expect(kindLabel('moon')).toBe('Moon');
  });
});

describe('body search', () => {
  const catalog = [
    rec('sun', 'Sun', null),
    rec('earth', 'Earth', 'sun'),
    rec('luna', 'Luna', 'earth'),
    rec('mars', 'Mars', 'sun'),
    rec('phobos', 'Phobos', 'mars'),
  ];
  const entries = buildSearchEntries(catalog);

  it('builds entries with kind labels and parent names', () => {
    expect(entries.find((e) => e.id === 'phobos')?.parentName).toBe('Mars');
  });

  it('ranks name prefix above substring and parent matches', () => {
    const hits = matchBodies('ma', entries);
    expect(hits[0]!.name).toBe('Mars');
    expect(hits.map((h) => h.id)).toContain('phobos'); // parent name contains "ma"
  });

  it('matches case-insensitively and by id', () => {
    expect(matchBodies('LUNA', entries).map((h) => h.id)).toEqual(['luna']);
    expect(matchBodies('phob', entries).map((h) => h.id)).toEqual(['phobos']);
  });

  it('returns catalog head for an empty query and nothing for gibberish', () => {
    expect(matchBodies('   ', entries)[0]!.id).toBe('sun');
    expect(matchBodies('zzz', entries)).toEqual([]);
  });

  it('caps results at the limit', () => {
    expect(matchBodies('', entries, 2)).toHaveLength(2);
  });

  it('smoke: real catalog search finds planets by prefix', () => {
    const real = buildSearchEntries(CELESTIAL_CATALOG);
    expect(matchBodies('jup', real)[0]!.name).toBe('Jupiter');
    expect(real.length).toBe(CELESTIAL_CATALOG.length);
  });
});
