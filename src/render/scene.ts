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
import { SHOWCASE_BODY_ID, applyShowcaseDetail, showcaseRotationY } from './showcase';

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
  /** Active touch/mouse pointers; one drags to orbit, two pinch to zoom. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
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

    // Space is harsh: near-zero fill keeps night sides black and terminators
    // sharp — the single biggest realism lever for airless, sunlit worlds.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.05));
    const sunLight = new THREE.PointLight(0xfff2d5, 2.2, 0, 0); // zero decay: reaches the Kuiper belt
    this.scene.add(sunLight);
    this.scene.add(SolarScene.buildStarfield(2_600));

    // Touch-first input: one pointer orbits around the focused body, two
    // pointers pinch-zoom. `touch-action: none` stops the browser from
    // hijacking the gestures for page scroll/zoom.
    canvas.style.touchAction = 'none';
    this.onPointerDown = (e): void => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!canvas.hasPointerCapture(e.pointerId)) canvas.setPointerCapture(e.pointerId);
    };
    this.onPointerMove = (e): void => {
      const prev = this.pointers.get(e.pointerId);
      if (prev === undefined) return;
      if (this.pointers.size === 1) {
        this.controls.rotate(e.clientX - prev.x, e.clientY - prev.y);
      } else if (this.pointers.size >= 2) {
        // Pinch: zoom by how much the finger span grew since the last move.
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)!;
        const spanPrev = Math.hypot(prev.x - other[1].x, prev.y - other[1].y);
        const spanNow = Math.hypot(e.clientX - other[1].x, e.clientY - other[1].y);
        if (spanPrev > 0) this.controls.zoomByFactor(spanNow / spanPrev);
      }
      prev.x = e.clientX;
      prev.y = e.clientY;
    };
    this.onPointerUp = (e): void => {
      this.pointers.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    this.onWheel = (e): void => {
      e.preventDefault();
      this.controls.zoom(e.deltaY);
    };
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
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
    const showcaseMesh = this.visuals.meshes.get(SHOWCASE_BODY_ID);
    if (showcaseMesh !== undefined) applyShowcaseDetail(showcaseMesh, mode, this.renderer);
    this.scene.add(this.visuals.group);
  }

  /**
   * Point the orbit camera at a body and frame it for investigation: the zoom
   * floor hugs the body (~1.35 radii), the near plane is tightened so close
   * orbits of small bodies never clip, and the eye lands at `framingDistance`.
   * Callers re-target every frame as the body moves along its orbit.
   */
  frameBody(target: Vec3, bodyRadiusScene: number, framingDistance: number): void {
    const minDistance = Math.max(bodyRadiusScene * 1.35, 1e-6);
    this.controls.setRange(minDistance, CAMERA_RANGES[this.mode].max);
    this.controls.setTarget(target);
    this.controls.setDistance(framingDistance);
    this.camera.near = Math.min(this.mode === 'true' ? 2e-5 : 0.1, minDistance * 0.4);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Whole-system overview: orbit the Sun (scene origin) with every orbit inside
   * the frame. The zoom floor resets to the mode default so the user can keep
   * dragging/zooming freely across the full system — only the framing changes.
   */
  frameSystemView(distance: number): void {
    const range = CAMERA_RANGES[this.mode];
    this.controls.setRange(range.min, range.max);
    this.controls.setTarget({ x: 0, y: 0, z: 0 });
    this.controls.setDistance(distance);
    this.camera.near = this.mode === 'true' ? 2e-5 : 0.1;
    this.camera.updateProjectionMatrix();
  }

  syncPositions(positions: ReadonlyMap<string, Vec3>, simDays: number): void {
    if (this.visuals === null) return;
    for (const [id, mesh] of this.visuals.meshes) {
      const p = positions.get(id);
      if (p !== undefined) mesh.position.set(p.x, p.y, p.z);
    }
    // Showcase body spins at its real catalog period (tidally locked Moon).
    const showcase = this.visuals.meshes.get(SHOWCASE_BODY_ID);
    if (showcase !== undefined) showcase.rotation.y = showcaseRotationY(simDays);
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
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
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
