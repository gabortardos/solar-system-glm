/**
 * UI layer — pure body-search matching for the palette (K).
 * Ranks: name prefix > name substring > id substring > parent-name substring.
 * Ties keep catalog order, so the Sun and planets surface first.
 */

import type { CelestialBodyRecord } from '../data/catalog';
import { kindLabel } from './format';

export interface SearchEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly parentName: string;
}

export function buildSearchEntries(catalog: readonly CelestialBodyRecord[]): readonly SearchEntry[] {
  const byId = new Map(catalog.map((body) => [body.id, body] as const));
  return catalog.map((body) => ({
    id: body.id,
    name: body.name,
    kind: kindLabel(body.kind),
    parentName: body.parentId !== null ? (byId.get(body.parentId)?.name ?? '') : '',
  }));
}

/** Ranked matches for a query; an empty query returns the head of catalog order. */
export function matchBodies(
  query: string,
  entries: readonly SearchEntry[],
  limit = 8,
): readonly SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') return entries.slice(0, limit);

  const ranked: { entry: SearchEntry; rank: number }[] = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    let rank: number | undefined;
    if (name.startsWith(q)) rank = 0;
    else if (name.includes(q)) rank = 1;
    else if (entry.id.toLowerCase().includes(q)) rank = 2;
    else if (entry.parentName.toLowerCase().includes(q)) rank = 3;
    if (rank !== undefined) ranked.push({ entry, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank); // stable: preserves catalog order within a rank
  return ranked.slice(0, limit).map((r) => r.entry);
}
