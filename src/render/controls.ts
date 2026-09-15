/**
 * Visualization layer — orbit camera controller.
 * Pure spherical math around a focus target; no three.js, fully headless-testable.
 * The scene applies `position`/`target` to the real camera each frame.
 */

import type { Vec3 } from '../sim/vec';

export interface OrbitCameraOptions {
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly distance?: number;
  readonly theta?: number;
  readonly phi?: number;
}

export const ROTATE_SPEED_RAD_PER_PIXEL = 0.005;
export const ZOOM_SPEED = 0.0014;

/** Keep the camera away from the poles so the view never degenerates. */
const PHI_MIN = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class OrbitCamera {
  private theta: number;
  private phi: number;
  private distance: number;
  private minDistance: number;
  private maxDistance: number;
  private target: Vec3;

  constructor(options: OrbitCameraOptions = {}) {
    this.minDistance = options.minDistance ?? 1;
    this.maxDistance = Math.max(options.maxDistance ?? 1000, this.minDistance);
    this.distance = clamp(options.distance ?? 100, this.minDistance, this.maxDistance);
    this.theta = options.theta ?? 0.65;
    this.phi = clamp(options.phi ?? 0.9, PHI_MIN, Math.PI - PHI_MIN);
    this.target = { x: 0, y: 0, z: 0 };
  }

  /** Drag-to-rotate: pixels -> radians; phi clamped away from the poles. */
  rotate(dxPixels: number, dyPixels: number): void {
    this.theta -= dxPixels * ROTATE_SPEED_RAD_PER_PIXEL;
    this.phi = clamp(this.phi - dyPixels * ROTATE_SPEED_RAD_PER_PIXEL, PHI_MIN, Math.PI - PHI_MIN);
  }

  /** Wheel-to-zoom: positive delta (scroll down) dollies out, clamped to range. */
  zoom(delta: number): void {
    this.distance = clamp(
      this.distance * Math.exp(delta * ZOOM_SPEED),
      this.minDistance,
      this.maxDistance,
    );
  }

  setRange(minDistance: number, maxDistance: number): void {
    this.minDistance = minDistance;
    this.maxDistance = Math.max(maxDistance, minDistance);
    this.distance = clamp(this.distance, this.minDistance, this.maxDistance);
  }

  setTarget(target: Vec3): void {
    this.target = { x: target.x, y: target.y, z: target.z };
  }

  getTarget(): Vec3 {
    return { ...this.target };
  }

  /** Camera eye = target + distance * (sin phi sin theta, cos phi, sin phi cos theta). */
  get position(): Vec3 {
    const sinPhi = Math.sin(this.phi);
    return {
      x: this.target.x + this.distance * sinPhi * Math.sin(this.theta),
      y: this.target.y + this.distance * Math.cos(this.phi),
      z: this.target.z + this.distance * sinPhi * Math.cos(this.theta),
    };
  }

  get state(): { theta: number; phi: number; distance: number } {
    return { theta: this.theta, phi: this.phi, distance: this.distance };
  }
}
