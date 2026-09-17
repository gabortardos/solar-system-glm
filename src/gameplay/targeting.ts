/**
 * Gameplay layer — focus targeting (Step 7).
 * Pure helpers: which bodies the camera may focus on and the focus cycling
 * order. No DOM, no three.js.
 */

import type { CelestialBodyRecord } from '../data/catalog';

/**
 * Focusable bodies: everything with a propagated position (the Sun plus all
 * bodies carrying orbit elements). Static belt point-clouds are excluded.
 * Catalog assembly order (Sun, planets, dwarfs, moons) makes a sane cycle.
 */
export function focusableBodies(
  catalog: readonly CelestialBodyRecord[],
): readonly CelestialBodyRecord[] {
  return catalog.filter((body) => body.id === 'sun' || body.orbit !== undefined);
}

/**
 * Next focus in cycle order. `currentId === null` starts at the Sun when
 * stepping forward, at the last body when stepping backward; wraps both ways.
 */
export function cycleFocus(
  currentId: string | null,
  bodies: readonly CelestialBodyRecord[],
  step: 1 | -1 = 1,
): CelestialBodyRecord {
  if (bodies.length === 0) throw new Error('cycleFocus: no focusable bodies');
  const n = bodies.length;
  const index = currentId === null ? -1 : bodies.findIndex((body) => body.id === currentId);
  if (index === -1) return bodies[step > 0 ? 0 : n - 1]!;
  const next = (((index + step) % n) + n) % n;
  return bodies[next]!;
}
