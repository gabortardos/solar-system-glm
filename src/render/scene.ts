/**
 * Visualization layer — scene ownership: WebGL2 renderer, camera, lighting,
 * starfield, pointer/wheel input, and scale-mode lifecycle. Presentation only:
 * body positions arrive from the sim layer via sync.ts.
 */

import * as THREE from 'three';
import { CELESTIAL_CATALOG } from '../data/catalog';
import type { Vec3 } from '../sim/vec';
import { buildSystemVisuals, disposeVisuals, type SystemVisuals } from './bodies';
import { OrbitCamera } from './controls';
import { hashString, mulberry32 } from './rand';
import type { ScaleMode } from './scale';

const CAMERA_RANGES: Record<ScaleMode, { readonly min: number; readonly max: number }> = {
  compressed: { min: 4, max: 1_600 },
  true: { min: 0.002, max: 1_200 },
};

export class SolarScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitCamera;

  private visuals: SystemVisuals | null = null;
  private mode: ScaleMode;
  private readonly canvas: HTMLCanvasElement;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onWheel: (e: WheelEvent) => void;

  constructor(canvas: HTMLCanvasElement, initialMode: ScaleMode = 'compressed') {
    this.canvas = canvas;
    this.mode = initialMode;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      logarithmicDepthBuffer: true, // true-scale mode spans 1e-4..1e3 units
    });
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6_000);

    const range = CAMERA_RANGES[initialMode];
    this.controls = new OrbitCamera({
      minDistance: range.min,
      maxDistance: range.max,
      distance: initialMode === 'true' ? 12 : 420,
      phi: 0.9,
      theta: 0.65,
    });

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    const sunLight = new THREE.PointLight(0xfff2d5, 2.2, 0, 0); // zero decay: reaches the Kuiper belt
    this.scene.add(sunLight);
    this.scene.add(SolarScene.buildStarfield(2_600));

    this.onPointerDown = (e): void => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    this.onPointerMove = (e): void => {
      if (!this.dragging) return;
      this.controls.rotate(e.clientX - this.lastX, e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    this.onPointerUp = (e): void => {
      this.dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    this.onWheel = (e): void => {
      e.preventDefault();
      this.controls.zoom(e.deltaY);
    };
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.setScaleMode(initialMode);
    this.resize();
  }

  get currentMode(): ScaleMode {
    return this.mode;
  }

  setScaleMode(mode: ScaleMode): void {
    this.mode = mode;
    const range = CAMERA_RANGES[mode];
    this.controls.setRange(range.min, range.max);
    this.camera.near = mode === 'true' ? 2e-5 : 0.1;
    this.camera.updateProjectionMatrix();
    if (this.visuals !== null) {
      this.scene.remove(this.visuals.group);
      disposeVisuals(this.visuals);
    }
    this.visuals = buildSystemVisuals(CELESTIAL_CATALOG, mode);
    this.scene.add(this.visuals.group);
  }

  syncPositions(positions: ReadonlyMap<string, Vec3>): void {
    if (this.visuals === null) return;
    for (const [id, mesh] of this.visuals.meshes) {
      const p = positions.get(id);
      if (p !== undefined) mesh.position.set(p.x, p.y, p.z);
    }
  }

  render(): void {
    const eye = this.controls.position;
    const target = this.controls.getTarget();
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.lookAt(target.x, target.y, target.z);
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = this.canvas.width || 1;
    const h = this.canvas.height || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    if (this.visuals !== null) disposeVisuals(this.visuals);
    this.renderer.dispose();
  }

  private static buildStarfield(count: number): THREE.Points {
    const rng = mulberry32(hashString('starfield-v1'));
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rng() * 2 - 1;
      const angle = rng() * 2 * Math.PI;
      const r = 2_600;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = r * s * Math.cos(angle);
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * s * Math.sin(angle);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xcdd7ff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
    });
    return new THREE.Points(geometry, material);
  }
}
