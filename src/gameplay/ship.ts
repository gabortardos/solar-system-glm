/**
 * Gameplay layer — arcade spaceship controller (Step 6).
 * Pure scene-space kinematics: smoothed angular rates, multiplicative throttle,
 * velocity always nose-aligned (arcade). No three.js — main.ts bridges values to
 * the render layer. Convention: forward = local -Z, up = +Y, right = +X.
 */

import { addVec3, lengthVec3, scaleVec3, type Vec3 } from '../sim/vec';
import {
  quatFromAxisAngle,
  quatLookTo,
  quatMultiply,
  quatNormalize,
  quatRotateVector,
  type Quat,
} from './quat';

export type ThrottleRegime = 'orbital' | 'cruise' | 'warp';

/** Semantic flight input; keyboard and (later) touch both produce this shape. */
export interface ShipInput {
  /** -1..1; +1 pitches the nose up (W). */
  readonly pitch: number;
  /** -1..1; +1 yaws the nose left (A). */
  readonly yaw: number;
  /** -1..1; +1 rolls right (E). */
  readonly roll: number;
  readonly throttleUp: boolean;
  readonly throttleDown: boolean;
  readonly brake: boolean;
}

export const NO_INPUT: ShipInput = {
  pitch: 0, yaw: 0, roll: 0, throttleUp: false, throttleDown: false, brake: false,
};

export interface FlightEnvelope {
  /** Scene units per sim-second. */
  readonly minSpeed: number;
  readonly maxSpeed: number;
  /** Multiplicative throttle growth per second (1.6 = +160%/s). */
  readonly throttleRate: number;
  /** Exponential brake decay per second. */
  readonly brakeRate: number;
  /** Keep-out shell around the Sun, scene units. */
  readonly minSunDistance: number;
}

/** Speed limits per visual scale mode (plain-string keys: no render import here). */
export const SHIP_SPEED_PROFILES: Record<
  'compressed' | 'true',
  Omit<FlightEnvelope, 'minSunDistance'>
> = {
  compressed: { minSpeed: 0.5, maxSpeed: 260, throttleRate: 1.6, brakeRate: 5 },
  true: { minSpeed: 0.0008, maxSpeed: 120, throttleRate: 1.4, brakeRate: 4 },
};

export const MAX_PITCH_RATE = 1.5; // rad/s
export const MAX_YAW_RATE = 1.2;
export const MAX_ROLL_RATE = 2.4;
/** How quickly angular rates chase inputs — the core "arcade feel" constant (1/s). */
export const ANGULAR_SMOOTHING = 7;

export class ShipController {
  private positionValue: Vec3;
  private orientationValue: Quat;
  private speedValue: number;
  private envelopeValue: FlightEnvelope;
  private pitchRate = 0;
  private yawRate = 0;
  private rollRate = 0;

  constructor(
    envelope: FlightEnvelope,
    spawn: { position: Vec3; lookDirection: Vec3; speed?: number },
  ) {
    this.envelopeValue = envelope;
    this.positionValue = spawn.position;
    this.orientationValue = quatLookTo(spawn.lookDirection, { x: 0, y: 1, z: 0 });
    this.speedValue = Math.min(
      Math.max(spawn.speed ?? envelope.minSpeed, envelope.minSpeed),
      envelope.maxSpeed,
    );
  }

  get position(): Vec3 { return this.positionValue; }
  get orientation(): Quat { return this.orientationValue; }
  get speed(): number { return this.speedValue; }
  get envelope(): FlightEnvelope { return this.envelopeValue; }
  get forward(): Vec3 { return quatRotateVector(this.orientationValue, { x: 0, y: 0, z: -1 }); }
  get right(): Vec3 { return quatRotateVector(this.orientationValue, { x: 1, y: 0, z: 0 }); }

  get regime(): ThrottleRegime {
    if (this.speedValue <= this.envelopeValue.maxSpeed * 0.05) return 'orbital';
    if (this.speedValue <= this.envelopeValue.maxSpeed * 0.5) return 'cruise';
    return 'warp';
  }

  setEnvelope(next: FlightEnvelope): void {
    this.envelopeValue = next;
    this.speedValue = Math.min(Math.max(this.speedValue, next.minSpeed), next.maxSpeed);
  }

  /** Uniform rescale (scale-mode toggle): moves the ship and speed together. */
  rescale(factor: number): void {
    this.positionValue = scaleVec3(this.positionValue, factor);
    this.speedValue *= factor;
  }

  teleport(position: Vec3, lookDirection: Vec3): void {
    this.positionValue = position;
    this.orientationValue = quatLookTo(lookDirection, { x: 0, y: 1, z: 0 });
    this.pitchRate = 0;
    this.yawRate = 0;
    this.rollRate = 0;
  }

  update(dt: number, input: ShipInput): void {
    if (dt <= 0) return;
    const e = this.envelopeValue;

    // 1) Angular rates chase the inputs exponentially (arcade smoothing).
    const k = 1 - Math.exp(-ANGULAR_SMOOTHING * dt);
    this.pitchRate += (input.pitch * MAX_PITCH_RATE - this.pitchRate) * k;
    this.yawRate += (input.yaw * MAX_YAW_RATE - this.yawRate) * k;
    this.rollRate += (input.roll * MAX_ROLL_RATE - this.rollRate) * k;

    // 2) Integrate orientation with body-local axis rotations (q ⊗ dq applies
    //    dq in the ship's local frame — axes must NOT be pre-rotated to world).
    const q = this.orientationValue;
    const dqPitch = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, this.pitchRate * dt);
    const dqYaw = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, this.yawRate * dt);
    const dqRoll = quatFromAxisAngle({ x: 0, y: 0, z: -1 }, this.rollRate * dt);
    this.orientationValue = quatNormalize(
      quatMultiply(quatMultiply(quatMultiply(q, dqPitch), dqYaw), dqRoll),
    );

    // 3) Throttle: multiplicative accel/decel; brake decays toward a full stop.
    if (input.brake) {
      this.speedValue *= Math.exp(-e.brakeRate * dt);
    } else if (input.throttleUp) {
      this.speedValue *= Math.exp(e.throttleRate * dt);
    } else if (input.throttleDown) {
      this.speedValue *= Math.exp(-e.throttleRate * dt);
    }
    this.speedValue = Math.min(Math.max(this.speedValue, 0), e.maxSpeed);
    if (!input.brake && this.speedValue < e.minSpeed) this.speedValue = e.minSpeed;

    // 4) Arcade kinematics: velocity is always nose-aligned.
    this.positionValue = addVec3(this.positionValue, scaleVec3(this.forward, this.speedValue * dt));

    // 5) Solar keep-out: shove the ship outside the photosphere shell.
    const r = lengthVec3(this.positionValue);
    if (r < e.minSunDistance && r > 0) {
      this.positionValue = scaleVec3(scaleVec3(this.positionValue, 1 / r), e.minSunDistance);
      this.speedValue *= 0.5; // heat-shield penalty
    }
  }
}


