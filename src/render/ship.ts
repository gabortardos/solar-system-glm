/**
 * Visualization layer — procedural spaceship mesh + engine glow.
 * Consumes plain-number ship state bridged from gameplay via main.ts
 * (render must not import gameplay, per the architecture rules).
 */

import * as THREE from 'three';
import type { Vec3 } from '../sim/vec';

/** Plain-data ship pose; quaternion fields match THREE.Quaternion layout. */
export interface ShipFrameState {
  readonly position: Vec3;
  readonly quaternion: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  /** 0..1 log-normalized throttle, drives glow intensity. */
  readonly throttle01: number;
}

export interface ShipVisual {
  readonly group: THREE.Group;
  sync(state: ShipFrameState): void;
  setScale(units: number): void;
  dispose(): void;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,240,200,0.95)');
    grad.addColorStop(0.35, 'rgba(255,160,60,0.55)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

export function buildShipVisual(): ShipVisual {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xb8c4d4, roughness: 0.45, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x2b6cb0, roughness: 0.6, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.15, metalness: 0.1 });

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 12), hullMat);
  nose.rotation.x = -Math.PI / 2; // cone +Y -> nose points along local -Z
  nose.position.z = -0.35;
  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.8), accentMat);
  fuselage.position.z = 0.15;
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), glassMat);
  cockpit.position.set(0, 0.13, -0.05);
  const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.3), hullMat);
  wingLeft.position.set(-0.4, 0, 0.25);
  wingLeft.rotation.y = 0.35; // swept back
  const wingRight = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.3), hullMat);
  wingRight.position.set(0.4, 0, 0.25);
  wingRight.rotation.y = -0.35;

  const glowTexture = makeGlowTexture();
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.z = 0.62;

  group.add(nose, fuselage, cockpit, wingLeft, wingRight, glow);

  return {
    group,
    sync(state): void {
      group.position.set(state.position.x, state.position.y, state.position.z);
      group.quaternion.set(state.quaternion.x, state.quaternion.y, state.quaternion.z, state.quaternion.w);
      glow.scale.setScalar(0.45 + 0.9 * state.throttle01);
      glowMat.opacity = 0.35 + 0.6 * state.throttle01;
    },
    setScale(units): void {
      group.scale.setScalar(units);
    },
    dispose(): void {
      for (const child of group.children) {
        const mesh = child as THREE.Mesh | THREE.Sprite;
        mesh.geometry?.dispose();
        (mesh.material as THREE.Material | undefined)?.dispose();
      }
      glowTexture.dispose();
      group.clear();
    },
  };
}
