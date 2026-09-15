/**
 * Visualization layer — pure position sync: catalog + Kepler propagation ->
 * scene-space coordinates. No three.js: consumed by scene.ts AND by tests.
 */

import { CELESTIAL_BY_ID, CELESTIAL_CATALOG, type CelestialBodyRecord } from '../data/catalog';
import { orbitalPositionAu } from '../sim/orbit';
import type { Vec3 } from '../sim/vec';
import { eclipticToScene } from './frame';
import { heliocentricRadiusScene, orbitOffsetScene, type ScaleMode } from './scale';

/**
 * Map a parent-relative ecliptic AU vector into scene space under `mode`.
 * Distances are radially scaled (direction preserved); moons additionally get
 * the never-inside-the-planet floor. `eclipticToScene` is an isometry, so the
 * output length equals the scaled distance exactly.
 */
export function orbitSceneOffset(
  relEclipticAu: Vec3,
  body: CelestialBodyRecord,
  mode: ScaleMode,
): Vec3 {
  const dist = Math.hypot(relEclipticAu.x, relEclipticAu.y, relEclipticAu.z);
  let radiusScene: number;
  if (body.parentId === 'sun') {
    radiusScene = heliocentricRadiusScene(dist, mode);
  } else {
    const parent = CELESTIAL_BY_ID.get(body.parentId ?? 'sun');
    radiusScene = orbitOffsetScene(dist, parent?.radiusKm ?? 0, body.radiusKm ?? 0, mode);
  }
  const k = radiusScene / dist;
  return eclipticToScene({
    x: relEclipticAu.x * k,
    y: relEclipticAu.y * k,
    z: relEclipticAu.z * k,
  });
}

/**
 * Heliocentric scene positions for every orbiting catalog body (plus the Sun at
 * the origin). Catalog assembly order guarantees parents precede children.
 */
export function heliocentricScenePositions(
  daysSinceEpoch: number,
  mode: ScaleMode,
): ReadonlyMap<string, Vec3> {
  const out = new Map<string, Vec3>([['sun', { x: 0, y: 0, z: 0 }]]);
  for (const body of CELESTIAL_CATALOG) {
    if (body.orbit === undefined) continue; // belts are static point clouds
    const parentScene = out.get(body.parentId ?? 'sun');
    if (parentScene === undefined) continue; // defensive; ordering makes this unreachable
    const offset = orbitSceneOffset(orbitalPositionAu(body.orbit, daysSinceEpoch), body, mode);
    out.set(body.id, {
      x: parentScene.x + offset.x,
      y: parentScene.y + offset.y,
      z: parentScene.z + offset.z,
    });
  }
  return out;
}
