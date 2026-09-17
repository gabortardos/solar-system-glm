/**
 * Visualization layer — builds three.js visuals for the whole catalog:
 * body meshes, orbit path lines, and belt point clouds. Rebuilt on scale toggle.
 */

import * as THREE from 'three';
import { CELESTIAL_BY_ID, type CelestialBodyRecord } from '../data/catalog';
import { sampleOrbitAu } from '../sim/orbit';
import type { Vec3 } from '../sim/vec';
import { orbitSceneOffset } from './sync';
import { bodyRadiusScene, heliocentricRadiusScene, type ScaleMode } from './scale';
import { hashString, mulberry32 } from './rand';
import {
  SHOWCASE_BODY_ID,
  SHOWCASE_HEIGHT_SEGMENTS,
  SHOWCASE_WIDTH_SEGMENTS,
} from './showcase';

export interface SystemVisuals {
  readonly group: THREE.Group;
  readonly meshes: ReadonlyMap<string, THREE.Mesh>;
}

const ORBIT_SEGMENTS = 220;

function makeBeltPoints(body: CelestialBodyRecord, mode: ScaleMode): THREE.Points {
  const belt = body.belt!;
  const rng = mulberry32(hashString(body.id));
  const count = body.id === 'asteroid-belt' ? 1_400 : 2_200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = rng() * 2 * Math.PI;
    const radAu = belt.innerRadiusAu + rng() * (belt.outerRadiusAu - belt.innerRadiusAu);
    const r = mode === 'true' ? radAu : heliocentricRadiusScene(radAu, mode);
    // Thin gaussian-ish vertical spread (sum of 3 uniforms), scaled to radius.
    const height = (((rng() + rng() + rng()) - 1.5) / 1.5) * r * (mode === 'true' ? 0.05 : 0.035);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = height;
    positions[i * 3 + 2] = -Math.sin(angle) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(body.colorHex),
    size: mode === 'true' ? 0.02 : 0.65,
    transparent: true,
    opacity: 0.75,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function makeOrbitLine(body: CelestialBodyRecord, mode: ScaleMode): THREE.LineLoop {
  const samples: readonly Vec3[] = sampleOrbitAu(body.orbit!, ORBIT_SEGMENTS);
  const mapped = samples.map((p) => {
    const s = orbitSceneOffset(p, body, mode);
    return new THREE.Vector3(s.x, s.y, s.z);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(mapped);
  const dim = body.kind === 'moon' ? 0.35 : 0.6;
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(body.colorHex).lerp(new THREE.Color(0x334455), dim),
    transparent: true,
    opacity: body.kind === 'moon' ? 0.3 : 0.5,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.frustumCulled = false;
  return line;
}

export function buildSystemVisuals(
  catalog: readonly CelestialBodyRecord[],
  mode: ScaleMode,
): SystemVisuals {
  const group = new THREE.Group();
  const meshes = new Map<string, THREE.Mesh>();

  for (const body of catalog) {
    if (body.kind === 'belt') {
      group.add(makeBeltPoints(body, mode));
      continue;
    }
    const radius = bodyRadiusScene(body.radiusKm ?? 1, mode);
    const isShowcase = body.id === SHOWCASE_BODY_ID;
    const geometry = isShowcase
      ? new THREE.SphereGeometry(radius, SHOWCASE_WIDTH_SEGMENTS, SHOWCASE_HEIGHT_SEGMENTS)
      : new THREE.SphereGeometry(radius, 32, 16);
    const material =
      body.kind === 'star'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(body.colorHex) })
        : new THREE.MeshStandardMaterial({
            color: new THREE.Color(body.colorHex),
            // Showcase body: dry regolith — matte, zero metal.
            roughness: isShowcase ? 0.97 : 0.85,
            metalness: isShowcase ? 0 : 0.05,
          });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.bodyId = body.id;
    meshes.set(body.id, mesh);
    group.add(mesh);

    if (body.orbit !== undefined) group.add(makeOrbitLine(body, mode));
  }

  return { group, meshes };
}

/** Dispose every GPU resource owned by a visuals group (used on scale rebuild). */
export function disposeVisuals(visuals: SystemVisuals): void {
  for (const child of visuals.group.children) {
    const object = child as THREE.Mesh | THREE.Points | THREE.LineLoop;
    object.geometry?.dispose();
    const material = object.material as THREE.Material | undefined;
    material?.dispose();
  }
  visuals.group.clear();
  void CELESTIAL_BY_ID; // keep import graph explicit for future label lookups
}
