/**
 * Gameplay-adjacent pure math tests — quaternion algebra (orientation
 * foundation) and the scale round-trip used by scale-mode toggling. The arcade
 * ship controller was removed with the focus-first UX pivot.
 */
import { describe, expect, it } from 'vitest';
import { heliocentricRadiusScene, sceneToAuDistance } from '../src/render/scale';
import {
  QUAT_IDENTITY,
  quatFromAxisAngle,
  quatLookTo,
  quatNormalize,
  quatRotateVector,
} from '../src/sim/quat';

describe('Step 6 — quaternion algebra', () => {
  it('identity leaves vectors untouched', () => {
    const v = quatRotateVector(QUAT_IDENTITY, { x: 1, y: 2, z: 3 });
    expect(v.x).toBeCloseTo(1, 12);
    expect(v.y).toBeCloseTo(2, 12);
    expect(v.z).toBeCloseTo(3, 12);
  });

  it('rotates +X to -Z under +90 degrees about +Y (right-handed)', () => {
    const q = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
    const v = quatRotateVector(q, { x: 1, y: 0, z: 0 });
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(-1, 12);
  });

  it('quatLookTo along -Z with +Y up is the identity rotation', () => {
    const q = quatLookTo({ x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
    expect(Math.abs(q.w)).toBeCloseTo(1, 9);
    expect(Math.hypot(q.x, q.y, q.z)).toBeLessThan(1e-9);
  });

  it('quatLookTo aims the nose and keeps up', () => {
    const q = quatLookTo({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    const forward = quatRotateVector(q, { x: 0, y: 0, z: -1 });
    const up = quatRotateVector(q, { x: 0, y: 1, z: 0 });
    expect(forward.x).toBeCloseTo(1, 9);
    expect(Math.abs(forward.y)).toBeLessThan(1e-9);
    expect(Math.abs(forward.z)).toBeLessThan(1e-9);
    expect(up.y).toBeCloseTo(1, 9);
  });

  it('quatNormalize produces unit length', () => {
    const q = quatNormalize({ x: 3, y: 4, z: 0, w: 12 });
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 12);
  });
});

describe('Step 6 — scale round-trip for mode toggling', () => {
  it('sceneToAuDistance inverts heliocentricRadiusScene exactly', () => {
    for (const au of [0.05, 0.387, 1, 9.537, 30.07, 97.4, 370]) {
      expect(sceneToAuDistance(heliocentricRadiusScene(au, 'compressed'), 'compressed')).toBeCloseTo(au, 9);
    }
    expect(sceneToAuDistance(12.34, 'true')).toBe(12.34);
  });
});
