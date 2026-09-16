/**
 * Simulation layer — minimal immutable 3-vector math.
 * Pure math; deliberately independent of three.js (that is the render layer's job).
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scaleVec3(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

export function dotVec3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function lengthVec3(a: Vec3): number {
  return Math.sqrt(dotVec3(a, a));
}

export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Returns `a` scaled to unit length; the zero vector maps to itself. */
export function normalizeVec3(a: Vec3): Vec3 {
  const length = lengthVec3(a);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return { x: a.x / length, y: a.y / length, z: a.z / length };
}

/** Ecliptic frame convention used throughout the sim: +z is the north ecliptic pole. */
export const ECLIPTIC_FRAME_NOTE =
  'Positions are heliocentric/local ecliptic Cartesian AU; +z = north ecliptic pole. Render maps this frame to screen space.';
