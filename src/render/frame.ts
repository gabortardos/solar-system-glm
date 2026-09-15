/**
 * Visualization layer — reference-frame adapter.
 * The sim computes ecliptic coordinates (+z = north ecliptic pole, right-handed);
 * three.js expects Y-up. This mapping is a proper rotation (det = +1), so
 * handedness and retrograde direction are preserved exactly.
 */

import type { Vec3 } from '../sim/vec';

export function eclipticToScene(v: Vec3): Vec3 {
  return { x: v.x, y: v.z, z: -v.y };
}

export function sceneToEcliptic(v: Vec3): Vec3 {
  return { x: v.x, y: -v.z, z: v.y };
}
