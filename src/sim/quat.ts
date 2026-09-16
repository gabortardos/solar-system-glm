/**
 * Gameplay layer — minimal right-handed quaternion algebra.
 * Pure math, no three.js: main.ts bridges these verbatim into THREE.Quaternion.
 * Convention matches three.js objects: forward = local -Z, up = +Y, right = +X.
 */

import { crossVec3, dotVec3, lengthVec3, scaleVec3, type Vec3 } from '../sim/vec';

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export const QUAT_IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

export function quatFromAxisAngle(axis: Vec3, angleRad: number): Quat {
  const half = angleRad / 2;
  const s = Math.sin(half);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatNormalize(q: Quat): Quat {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

export function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/** Rotate vector v by quaternion q (v' = q v q*), expanded for speed. */
export function quatRotateVector(q: Quat, v: Vec3): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** Build a quaternion from an orthonormal basis given as matrix columns. */
function quatFromBasis(xAxis: Vec3, yAxis: Vec3, zAxis: Vec3): Quat {
  const m00 = xAxis.x, m10 = xAxis.y, m20 = xAxis.z;
  const m01 = yAxis.x, m11 = yAxis.y, m21 = yAxis.z;
  const m02 = zAxis.x, m12 = zAxis.y, m22 = zAxis.z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return { w: s / 4, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return { w: (m21 - m12) / s, x: s / 4, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: s / 4, z: (m12 + m21) / s };
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: s / 4 };
}

/** Orientation turning the body's -Z toward `direction`, +Y as close to `up` as possible. */
export function quatLookTo(direction: Vec3, up: Vec3): Quat {
  const zAxis = scaleVec3(direction, -1);
  let xAxis = crossVec3(up, zAxis);
  if (dotVec3(xAxis, xAxis) < 1e-12) {
    xAxis = crossVec3({ x: 0, y: 0, z: 1 }, zAxis); // direction parallel to up: pick any perpendicular
  }
  xAxis = scaleVec3(xAxis, 1 / (lengthVec3(xAxis) || 1));
  const yAxis = crossVec3(zAxis, xAxis);
  return quatNormalize(quatFromBasis(xAxis, yAxis, zAxis));
}
