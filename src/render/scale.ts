/**
 * Visualization layer — pure scale strategies.
 * 'compressed' trades literal proportions for readability; 'true' is honest reality.
 * No three.js here: these are plain functions both the scene and the tests consume.
 */

export type ScaleMode = 'compressed' | 'true';

/** 1 AU expressed in kilometres (IAU 2012 definition). */
export const KM_PER_AU = 149_597_870.7;

/**
 * Compressed distance: scene = GAIN * ln(1 + au / KNEE).
 * KNEE=0.05 AU keeps the inner system spread out; log tames the outer system.
 */
export const COMPRESS_KNEE_AU = 0.05;
export const COMPRESS_GAIN = 40;

/**
 * Compressed body radius: scene = GAIN_R * sqrt(km), floored at MIN units.
 * sqrt keeps a strong hierarchy (Sun ~10x Earth) while moons stay visible.
 */
export const RADII_GAIN = 0.0044;
export const MIN_BODY_RADIUS_UNITS = 0.02;

/** Extra clearance so compressed moon orbits never intersect their planet. */
export const MOON_ORBIT_PAD_UNITS = 0.3;

/** Heliocentric (or any parent-relative) distance in AU -> scene units. */
export function heliocentricRadiusScene(distanceAu: number, mode: ScaleMode): number {
  if (mode === 'true') return distanceAu;
  return COMPRESS_GAIN * Math.log(1 + distanceAu / COMPRESS_KNEE_AU);
}

/**
 * Parent-relative orbit distance for satellites. In compressed mode the raw log
 * distance for close moons (Phobos!) would place them inside the planet, so the
 * scaled parent+child radii plus padding form a visibility floor.
 */
export function orbitOffsetScene(
  distanceAu: number,
  parentRadiusKm: number,
  bodyRadiusKm: number,
  mode: ScaleMode,
): number {
  if (mode === 'true') return distanceAu;
  const logDistance = COMPRESS_GAIN * Math.log(1 + distanceAu / COMPRESS_KNEE_AU);
  const floor =
    bodyRadiusScene(parentRadiusKm, 'compressed') +
    bodyRadiusScene(bodyRadiusKm, 'compressed') +
    MOON_ORBIT_PAD_UNITS;
  return Math.max(logDistance, floor);
}

/** Mean body radius in km -> scene units. */
export function bodyRadiusScene(radiusKm: number, mode: ScaleMode): number {
  if (mode === 'true') return radiusKm / KM_PER_AU;
  return Math.max(MIN_BODY_RADIUS_UNITS, RADII_GAIN * Math.sqrt(Math.max(radiusKm, 0)));
}

/** Inverse of heliocentricRadiusScene: scene units back to AU (exact in both modes). */
export function sceneToAuDistance(sceneUnits: number, mode: ScaleMode): number {
  if (mode === 'true') return sceneUnits;
  return COMPRESS_KNEE_AU * (Math.exp(sceneUnits / COMPRESS_GAIN) - 1);
}
