/**
 * Pure data layer — the assembled celestial catalog and lookup helpers.
 * RULE: no imports from any other layer; no rendering concepts ever appear here.
 */

import type { CelestialBodyRecord, CelestialKind } from './schema';
import { SUN_AND_INNER_PLANETS } from './bodies.inner';
import { OUTER_PLANETS } from './bodies.outer';
import { DWARF_PLANETS } from './bodies.dwarf';
import { BELTS_AND_COMETS } from './bodies.belts-comets';
import { MOONS_INNER_SYSTEM } from './moons.earth-mars-jupiter';
import { MOONS_SATURN_URANUS } from './moons.saturn-uranus';
import { MOONS_OUTER } from './moons.neptune-trans';

export * from './schema';
export { validateCatalog } from './validation';
export type { CatalogIssue } from './validation';

export const CELESTIAL_CATALOG: readonly CelestialBodyRecord[] = [
  ...SUN_AND_INNER_PLANETS,
  ...OUTER_PLANETS,
  ...DWARF_PLANETS,
  ...MOONS_INNER_SYSTEM,
  ...MOONS_SATURN_URANUS,
  ...MOONS_OUTER,
  ...BELTS_AND_COMETS,
];

export const CELESTIAL_BY_ID: ReadonlyMap<string, CelestialBodyRecord> = new Map(
  CELESTIAL_CATALOG.map((body) => [body.id, body] as const),
);

export const SUN_ID = 'sun';
export const EARTH_ID = 'earth';
export const PLANET_IDS = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;

export function getCelestial(id: string): CelestialBodyRecord | undefined {
  return CELESTIAL_BY_ID.get(id);
}

export function childrenOf(id: string): readonly CelestialBodyRecord[] {
  return CELESTIAL_CATALOG.filter((body) => body.parentId === id);
}

export function bodiesOfKind(kind: CelestialKind): readonly CelestialBodyRecord[] {
  return CELESTIAL_CATALOG.filter((body) => body.kind === kind);
}

