/**
 * Navigation & discovery tests — focus cycling, framing, info formatters, and
 * search matching (Steps 7/8).
 */

import { describe, expect, it } from 'vitest';
import { CELESTIAL_CATALOG, type CelestialBodyRecord } from '../src/data/catalog';
import { cycleFocus, focusableBodies } from '../src/gameplay/targeting';
import { framingDistanceScene, heliocentricRadiusScene, systemFramingDistanceScene } from '../src/render/scale';
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

describe('framingDistanceScene', () => {
  it('frames at six radii in true mode', () => {
    expect(framingDistanceScene(0.01, 'true')).toBeCloseTo(0.06);
  });

  it('floors at 2.5 units in compressed mode for small bodies', () => {
    expect(framingDistanceScene(0.05, 'compressed')).toBe(2.5);
    expect(framingDistanceScene(2, 'compressed')).toBe(12);
  });
});

describe('systemFramingDistanceScene', () => {
  // Eris — the catalog's outermost orbit: a ≈ 67.78 AU, e ≈ 0.44.
  const erisAphelionAu = 67.78 * 1.44;

  it('frames the outermost aphelion with FOV headroom in both modes', () => {
    expect(systemFramingDistanceScene(erisAphelionAu, 'true')).toBeCloseTo(
      erisAphelionAu * 2.4,
      9,
    );
    expect(systemFramingDistanceScene(erisAphelionAu, 'compressed')).toBeCloseTo(
      heliocentricRadiusScene(erisAphelionAu, 'compressed') * 2.4,
      9,
    );
  });

  it('stays inside the camera ranges while clearing the outer orbits', () => {
    const compressed = systemFramingDistanceScene(erisAphelionAu, 'compressed');
    expect(compressed).toBeGreaterThan(600); // comfortably beyond Eris's scene orbit (~303 u)
    expect(compressed).toBeLessThan(1_600); // compressed-mode camera max
    expect(systemFramingDistanceScene(erisAphelionAu, 'true')).toBeLessThan(1_200);
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
