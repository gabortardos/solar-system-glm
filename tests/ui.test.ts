/**
 * Step 6.5+7 tests — HUD formatting, warp ladder/slider, chase camera math,
 * and modal-input disabling. All pure/headless (DOM modules keep their logic
 * in these pure helpers so no jsdom is needed).
 */
import { describe, expect, it } from 'vitest';
import { KeyboardActionMap } from '../src/gameplay/input';
import { NO_INPUT } from '../src/gameplay/ship';
import { chaseCameraPose } from '../src/render/controls';
import { QUAT_IDENTITY, quatFromAxisAngle } from '../src/sim/quat';
import {
  bankDeg,
  formatDateUtc,
  formatDistance,
  formatSpeed,
  formatWarp,
  headingDeg,
  pitchDeg,
} from '../src/ui/format';
import {
  MAX_WARP,
  MIN_WARP,
  WARP_LADDER,
  nextWarp,
  sliderToWarp,
  warpToSlider,
} from '../src/ui/warp';

describe('ui format helpers', () => {
  it('headingDeg maps scene axes to compass bearings', () => {
    expect(headingDeg({ x: 0, y: 0, z: 1 })).toBe(0);
    expect(headingDeg({ x: 1, y: 0, z: 0 })).toBe(90);
    expect(headingDeg({ x: 0, y: 0, z: -1 })).toBe(180);
    expect(headingDeg({ x: -1, y: 0, z: 0 })).toBe(270);
  });

  it('pitchDeg measures ecliptic elevation', () => {
    expect(pitchDeg({ x: 0, y: 1, z: 0 })).toBeCloseTo(90);
    expect(pitchDeg({ x: 0, y: -1, z: 0 })).toBeCloseTo(-90);
    expect(pitchDeg({ x: 1, y: 0, z: 0 })).toBeCloseTo(0);
  });

  it('bankDeg is positive when the right wing dips (roll right)', () => {
    expect(bankDeg({ x: 1, y: 0, z: 0 })).toBeCloseTo(0);
    expect(bankDeg({ x: 0, y: -1, z: 0 })).toBeCloseTo(90);
    expect(bankDeg({ x: 0, y: 1, z: 0 })).toBeCloseTo(-90);
  });

  it('labels scene units vs AU depending on scale mode', () => {
    expect(formatSpeed(4, 'compressed')).toBe('4.00 u/s');
    expect(formatSpeed(4, 'true')).toBe('4.00 AU/s');
    expect(formatSpeed(123.456, 'compressed')).toBe('123 u/s');
    expect(formatDistance(2.5, 'compressed')).toBe('2.50 u');
    expect(formatDistance(0.98, 'true')).toBe('0.98 AU');
  });

  it('formatWarp humanizes the time scale', () => {
    expect(formatWarp(1)).toBe('1×');
    expect(formatWarp(10)).toBe('10×');
    expect(formatWarp(60)).toBe('1.0 min/s');
    expect(formatWarp(3_600)).toBe('1.0 h/s');
    expect(formatWarp(86_400)).toBe('1.0 d/s');
    expect(formatWarp(1_000_000)).toBe('12 d/s');
  });

  it('formatDateUtc renders a UTC stamp', () => {
    expect(formatDateUtc(new Date(Date.UTC(2026, 8, 15, 19, 42)))).toBe('2026-09-15 19:42 UTC');
  });
});

describe('time-warp ladder and slider', () => {
  it('steps to neighbouring rungs in both directions', () => {
    expect(nextWarp(1, 1)).toBe(10);
    expect(nextWarp(10, 1)).toBe(60);
    expect(nextWarp(60, -1)).toBe(10);
    expect(nextWarp(600, -1)).toBe(60);
  });

  it('clamps at both ends of the ladder', () => {
    expect(nextWarp(MAX_WARP, 1)).toBe(MAX_WARP);
    expect(nextWarp(MIN_WARP, -1)).toBe(MIN_WARP);
  });

  it('ladder is sorted and inside the kernel range', () => {
    for (let i = 1; i < WARP_LADDER.length; i++) {
      expect(WARP_LADDER[i]!).toBeGreaterThan(WARP_LADDER[i - 1]!);
    }
    expect(WARP_LADDER[0]).toBe(MIN_WARP);
    expect(WARP_LADDER[WARP_LADDER.length - 1]).toBe(MAX_WARP);
  });

  it('slider endpoints map to exact warp bounds and stays monotonic', () => {
    expect(warpToSlider(1)).toBe(0);
    expect(warpToSlider(1_000_000)).toBe(1_000);
    expect(sliderToWarp(0)).toBe(1);
    expect(sliderToWarp(1_000)).toBe(1_000_000);
    let last = -Infinity;
    for (let pos = 0; pos <= 1_000; pos += 50) {
      const warp = sliderToWarp(pos);
      expect(warp).toBeGreaterThanOrEqual(last);
      last = warp;
    }
  });
});

describe('chase camera pose', () => {
  it('sits behind and above an identity-oriented ship, looking ahead', () => {
    const pose = chaseCameraPose({ x: 0, y: 0, z: 0 }, QUAT_IDENTITY, 10, 2);
    expect(pose.position.x).toBeCloseTo(0);
    expect(pose.position.y).toBeCloseTo(2);
    expect(pose.position.z).toBeCloseTo(10); // behind: nose points -Z
    expect(pose.target.x).toBeCloseTo(0);
    expect(pose.target.y).toBeCloseTo(0);
    expect(pose.target.z).toBeCloseTo(-6); // looks ahead of the nose
  });

  it('follows a nose-up ship so the camera ends up below and behind', () => {
    const noseUp = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const pose = chaseCameraPose({ x: 0, y: 0, z: 0 }, noseUp, 10, 2);
    expect(pose.position.y).toBeCloseTo(-10); // opposite of forward (+Y)
    expect(pose.position.z).toBeCloseTo(2); // ship-up (+Z after rotation) * height
    expect(pose.target.y).toBeCloseTo(6);
  });
});

describe('KeyboardActionMap modal disabling', () => {
  it('snapshot stays neutral while disabled, even with keys held', () => {
    const map = new KeyboardActionMap();
    map.press('KeyW');
    expect(map.snapshot().pitch).toBe(1);
    map.setEnabled(false);
    expect(map.snapshot()).toEqual(NO_INPUT);
    // Disabling releases held keys; re-enabling accepts fresh presses again.
    map.setEnabled(true);
    expect(map.snapshot().pitch).toBe(0);
    map.press('KeyW');
    expect(map.snapshot().pitch).toBe(1);
  });
});
