/**
 * Gameplay layer — focus targeting & travel navigation (Steps 7/8).
 * Pure helpers: which bodies the camera may focus on, focus cycling order,
 * and teleport arrival geometry for "warp there". No DOM, no three.js.
 */

import type { CelestialBodyRecord } from '../data/catalog';
import { addVec3, scaleVec3, type Vec3 } from '../sim/vec';

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

export interface ArrivalPlan {
  readonly position: Vec3;
  readonly lookDirection: Vec3;
}

/**
 * Teleport arrival geometry: `standoffDistance` from the body, on the side the
 * ship currently occupies (approach from where you are); fallback direction is
 * radially away from the Sun, then +X if the body sits exactly at the origin.
 * The nose aims straight at the body.
 */
export function travelArrival(
  bodyPosition: Vec3,
  shipPosition: Vec3,
  standoffDistance: number,
): ArrivalPlan {
  let dx = shipPosition.x - bodyPosition.x;
  let dy = shipPosition.y - bodyPosition.y;
  let dz = shipPosition.z - bodyPosition.z;
  let len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) {
    // Ship sits on the body: approach from the anti-sunward side.
    dx = bodyPosition.x;
    dy = bodyPosition.y;
    dz = bodyPosition.z;
    len = Math.hypot(dx, dy, dz);
  }
  if (len < 1e-9) {
    dx = 1;
    dy = 0;
    dz = 0;
    len = 1;
  }
  const k = standoffDistance / len;
  const offset: Vec3 = { x: dx * k, y: dy * k, z: dz * k };
  return {
    position: addVec3(bodyPosition, offset),
    lookDirection: scaleVec3(offset, -1),
  };
}
