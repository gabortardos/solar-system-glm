/**
 * Pure data layer — catalog integrity validator.
 * Runs at test time and at runtime boot; returns issues instead of throwing.
 */

import type { CelestialBodyRecord, CelestialKind } from './schema';

export interface CatalogIssue {
  readonly bodyId: string;
  readonly problem: string;
}

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/** Which parent kinds each child kind may orbit; null = must have no parent. */
const PARENT_KINDS: Record<CelestialKind, readonly CelestialKind[] | null> = {
  star: null,
  planet: ['star'],
  'dwarf-planet': ['star'],
  moon: ['planet', 'dwarf-planet'],
  asteroid: ['star', 'planet', 'dwarf-planet'],
  comet: ['star'],
  belt: ['star'],
};

const ORBIT_REQUIRED: readonly CelestialKind[] = [
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
];

export function validateCatalog(records: readonly CelestialBodyRecord[]): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const byId = new Map(records.map((r) => [r.id, r] as const));
  const seen = new Set<string>();
  const add = (bodyId: string, problem: string): void => {
    issues.push({ bodyId, problem });
  };

  for (const b of records) {
    if (b.id.length === 0) add(b.id, 'id must be non-empty');
    if (seen.has(b.id)) add(b.id, 'duplicate id');
    seen.add(b.id);
    if (b.name.length === 0) add(b.id, 'name must be non-empty');
    if (b.summary.length === 0) add(b.id, 'summary must be non-empty');
    if (b.facts.length === 0) add(b.id, 'at least one fact is required');
    if (!COLOR_RE.test(b.colorHex)) add(b.id, `invalid colorHex "${b.colorHex}"`);

    if (b.kind === 'belt') {
      const belt = b.belt;
      if (belt === undefined) {
        add(b.id, 'belt requires belt dimensions');
      } else {
        if (!(belt.innerRadiusAu > 0)) add(b.id, 'belt innerRadiusAu must be > 0');
        if (!(belt.outerRadiusAu > belt.innerRadiusAu)) add(b.id, 'belt outerRadiusAu must exceed innerRadiusAu');
        if (!(belt.estimatedObjects > 0)) add(b.id, 'belt estimatedObjects must be > 0');
      }
    } else {
      if (b.radiusKm === undefined || !(b.radiusKm > 0)) add(b.id, 'radiusKm must be a positive number');
      if (ORBIT_REQUIRED.includes(b.kind) && b.orbit === undefined) {
        add(b.id, `${b.kind} requires orbital elements`);
      }
    }

    const o = b.orbit;
    if (o !== undefined) {
      if (!(o.semiMajorAxisAu > 0)) add(b.id, 'orbit semiMajorAxisAu must be > 0');
      if (!(o.eccentricity >= 0 && o.eccentricity < 1)) add(b.id, 'orbit eccentricity must be in [0,1)');
      if (!(o.inclinationDeg >= -180 && o.inclinationDeg <= 180)) add(b.id, 'orbit inclinationDeg must be in [-180,180]');
      if (!(o.periodDays > 0)) add(b.id, 'orbit periodDays must be > 0');
      const angles: readonly [string, number | undefined][] = [
        ['meanAnomalyDegAtEpoch', o.meanAnomalyDegAtEpoch],
        ['longitudeOfAscendingNodeDeg', o.longitudeOfAscendingNodeDeg],
        ['argumentOfPeriapsisDeg', o.argumentOfPeriapsisDeg],
      ];
      for (const [label, v] of angles) {
        if (v !== undefined && !(v >= 0 && v < 360)) add(b.id, `orbit ${label} must be in [0,360)`);
      }
    }
  }

  for (const b of records) {
    if (b.parentId === null) {
      if (b.kind !== 'star') add(b.id, 'only a star may have parentId null');
      continue;
    }
    const parent = byId.get(b.parentId);
    if (parent === undefined) {
      add(b.id, `unknown parentId "${b.parentId}"`);
      continue;
    }
    const allowed = PARENT_KINDS[b.kind]!;
    if (!allowed.includes(parent.kind)) add(b.id, `${b.kind} cannot orbit a ${parent.kind}`);
  }

  // Cycle guard: walking parents must terminate quickly.
  for (const b of records) {
    let cursor: CelestialBodyRecord | undefined = b;
    let depth = 0;
    while (cursor !== undefined && cursor.parentId !== null) {
      cursor = byId.get(cursor.parentId);
      depth += 1;
      if (depth > 16) {
        add(b.id, 'parent chain exceeds depth 16 (cycle?)');
        break;
      }
    }
  }

  return issues;
}
