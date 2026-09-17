import { describe, expect, it } from 'vitest';
import { getCelestial } from '../src/data/catalog';
import {
  BUMP_EXAGGERATION,
  LUNAR_RELIEF_FRACTION,
  MOON_BUMP_URL,
  MOON_COLOR_URL,
  SHOWCASE_BODY_ID,
  SHOWCASE_HEIGHT_SEGMENTS,
  SHOWCASE_WIDTH_SEGMENTS,
  bodyRotationY,
  bumpScaleForRadius,
  showcaseRotationY,
} from '../src/render/showcase';

const TAU = Math.PI * 2;
const norm = (a: number): number => ((a % TAU) + TAU) % TAU;

describe('showcase body wiring', () => {
  it('targets the catalog Moon, which carries a real rotation period', () => {
    const moon = getCelestial(SHOWCASE_BODY_ID);
    expect(moon).toBeDefined();
    expect(moon?.kind).toBe('moon');
    expect(moon?.rotationPeriodHours).toBeDefined();
    expect(moon?.rotationPeriodHours as number).toBeGreaterThan(0);
  });

  it('serves texture URLs relative to the app base', () => {
    expect(MOON_COLOR_URL.startsWith('textures/')).toBe(true);
    expect(MOON_BUMP_URL.startsWith('textures/')).toBe(true);
  });

  it('uses a densely tessellated sphere', () => {
    expect(SHOWCASE_WIDTH_SEGMENTS).toBeGreaterThanOrEqual(128);
    expect(SHOWCASE_HEIGHT_SEGMENTS).toBeGreaterThanOrEqual(64);
  });
});

describe('bodyRotationY', () => {
  it('is zero at the epoch', () => {
    expect(norm(bodyRotationY(0, 655.72))).toBe(0);
  });

  it('completes one revolution per rotation period', () => {
    const periodHours = 655.72;
    const days = periodHours / 24;
    expect(norm(bodyRotationY(days, periodHours))).toBeCloseTo(0, 9);
    expect(norm(bodyRotationY(days / 2, periodHours))).toBeCloseTo(Math.PI, 6);
  });

  it('spins retrograde for negative catalog periods', () => {
    expect(Math.sign(bodyRotationY(1, -100))).toBe(-1);
  });

  it('is safely static for a zero period', () => {
    expect(bodyRotationY(123.4, 0)).toBe(0);
  });
});

describe('bumpScaleForRadius', () => {
  it('scales linearly with the scene radius at the exaggerated relief', () => {
    const perUnit = LUNAR_RELIEF_FRACTION * BUMP_EXAGGERATION;
    expect(bumpScaleForRadius(2)).toBeCloseTo(2 * perUnit, 12);
    expect(bumpScaleForRadius(10)).toBeCloseTo(10 * perUnit, 12);
  });
});

describe('showcaseRotationY', () => {
  it('agrees with bodyRotationY on the real catalog Moon', () => {
    const period = getCelestial('moon')?.rotationPeriodHours ?? 0;
    expect(norm(showcaseRotationY(3.5) - bodyRotationY(3.5, period))).toBeCloseTo(0, 12);
  });
});
