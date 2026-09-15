/**
 * Pure data layer — celestial catalog schema (Step 3 scope).
 * RULE: no imports from any other layer; no rendering concepts ever appear here.
 */

export type CelestialKind =
  | 'star'
  | 'planet'
  | 'dwarf-planet'
  | 'moon'
  | 'asteroid'
  | 'comet'
  | 'belt';

export interface CelestialBodyRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: CelestialKind;
  /** Parent body id (e.g. a moon's planet); null for the Sun. */
  readonly parentId: string | null;
  /** Mean radius in kilometres. */
  readonly radiusKm: number;
  /** One-line summary shown in the information overlay. */
  readonly summary: string;
}

/** Seed set — Step 3 replaces this with the full catalog (planets, moons, belts, comets). */
export const CATALOG_SEED: readonly CelestialBodyRecord[] = [
  {
    id: 'sun',
    name: 'Sun',
    kind: 'star',
    parentId: null,
    radiusKm: 696_340,
    summary: 'G-type main-sequence star containing 99.86% of the system mass.',
  },
  {
    id: 'earth',
    name: 'Earth',
    kind: 'planet',
    parentId: 'sun',
    radiusKm: 6_371,
    summary: 'Home world and default starting point of the explorer.',
  },
];
