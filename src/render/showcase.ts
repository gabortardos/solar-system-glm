/**
 * Visualization layer — showcase body detail: real spacecraft maps for select
 * bodies (pilot: the Moon, NASA LRO color + LOLA elevation). Textures load
 * lazily at runtime from /public/textures; on failure the procedural colored
 * sphere stays. Rotation/bump math is pure and unit-tested without WebGL.
 */

import * as THREE from 'three';
import { getCelestial } from '../data/catalog';
import { bodyRadiusScene, type ScaleMode } from './scale';

/** The catalog body that gets the photoreal treatment. */
export const SHOWCASE_BODY_ID = 'moon';

/** Dense tessellation so the silhouette and bump shading stay smooth up close. */
export const SHOWCASE_WIDTH_SEGMENTS = 192;
export const SHOWCASE_HEIGHT_SEGMENTS = 96;

/** Relative to the app base (Vite `base: './'`); resolved from /public. */
export const MOON_COLOR_URL = 'textures/moon/lroc_color_4k.jpg';
export const MOON_BUMP_URL = 'textures/moon/ldem_4k.jpg';

/** Real lunar relief is ~1.1% of the radius (roughly -9 to +11 km). */
export const LUNAR_RELIEF_FRACTION = 0.011;
/** Standard visualization exaggeration so craters read at explorer standoffs. */
export const BUMP_EXAGGERATION = 2.5;

/** Surface rotation about the body spin axis (scene Y). Prograde positive,
 *  retrograde (negative catalog periods) reverses naturally, 0 = tidally static. */
export function bodyRotationY(simDays: number, rotationPeriodHours: number): number {
  if (rotationPeriodHours === 0) return 0;
  return (2 * Math.PI * simDays * 24) / rotationPeriodHours;
}

/** Bump-map height scale for a body of the given scene radius. */
export function bumpScaleForRadius(sceneRadius: number): number {
  return sceneRadius * LUNAR_RELIEF_FRACTION * BUMP_EXAGGERATION;
}

/** Rotation of the showcase body this frame, from its real catalog period. */
export function showcaseRotationY(simDays: number): number {
  const record = getCelestial(SHOWCASE_BODY_ID);
  return bodyRotationY(simDays, record?.rotationPeriodHours ?? 0);
}

interface MoonTextures {
  readonly map: THREE.Texture;
  readonly bump: THREE.Texture;
}

let cachedTextures: Promise<MoonTextures> | null = null;

function loadMoonTextures(anisotropy: number): Promise<MoonTextures> {
  if (cachedTextures === null) {
    const loader = new THREE.TextureLoader();
    cachedTextures = Promise.all([
      loader.loadAsync(MOON_COLOR_URL),
      loader.loadAsync(MOON_BUMP_URL),
    ]).then(([map, bump]) => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = anisotropy;
      bump.anisotropy = anisotropy;
      return { map, bump };
    });
    // Allow a retry after a transient network failure.
    cachedTextures.catch(() => {
      cachedTextures = null;
    });
  }
  return cachedTextures;
}

/**
 * Attach real-surface detail to the showcase body's mesh. Safe to call on every
 * scale rebuild: textures are created once, cached, and re-applied to the new
 * mesh (mesh materials are disposed on rebuild; the textures are not).
 */
export function applyShowcaseDetail(
  mesh: THREE.Mesh,
  mode: ScaleMode,
  renderer: THREE.WebGLRenderer,
): void {
  const material = mesh.material as THREE.MeshStandardMaterial;
  const record = getCelestial(SHOWCASE_BODY_ID);
  const radius = bodyRadiusScene(record?.radiusKm ?? 1, mode);
  material.bumpScale = bumpScaleForRadius(radius);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  loadMoonTextures(anisotropy)
    .then((textures) => {
      material.map = textures.map;
      material.bumpMap = textures.bump;
      material.color.set(0xffffff); // let the map carry albedo
      material.needsUpdate = true;
    })
    .catch((err: unknown) => {
      console.warn(
        '[solar-system-glm] Moon surface maps failed to load; keeping procedural sphere.',
        err,
      );
    });
}
