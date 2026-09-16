/**
 * Gameplay layer — semantic action input.
 * Bindings use physical `e.code` values (KeyW, ...) so international layouts
 * keep identical hand positions, and every binding is a plain letter — no
 * special characters. Future touch UIs drive the same axes via setVirtualAxis /
 * setVirtualButton, so no flight code changes when mobile support lands.
 */

import type { ShipInput } from './ship';

export type ShipAction =
  | 'pitchUp' | 'pitchDown'
  | 'yawLeft' | 'yawRight'
  | 'rollLeft' | 'rollRight'
  | 'throttleUp' | 'throttleDown'
  | 'brake';

export const SHIP_KEY_BINDINGS: Record<ShipAction, string> = {
  pitchUp: 'KeyW',
  pitchDown: 'KeyS',
  yawLeft: 'KeyA',
  yawRight: 'KeyD',
  rollLeft: 'KeyQ',
  rollRight: 'KeyE',
  throttleUp: 'KeyR',
  throttleDown: 'KeyF',
  brake: 'KeyB',
};

const ACTION_BY_CODE: Readonly<Record<string, ShipAction>> = {
  KeyW: 'pitchUp',
  KeyS: 'pitchDown',
  KeyA: 'yawLeft',
  KeyD: 'yawRight',
  KeyQ: 'rollLeft',
  KeyE: 'rollRight',
  KeyR: 'throttleUp',
  KeyF: 'throttleDown',
  KeyB: 'brake',
};

const VIRTUAL_AXES = ['pitch', 'yaw', 'roll'] as const;
type VirtualAxis = (typeof VIRTUAL_AXES)[number];
type VirtualButton = 'throttleUp' | 'throttleDown' | 'brake';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class KeyboardActionMap {
  private readonly down = new Set<ShipAction>();
  private readonly virtual: {
    pitch: number; yaw: number; roll: number;
    throttleUp: boolean; throttleDown: boolean; brake: boolean;
  } = { pitch: 0, yaw: 0, roll: 0, throttleUp: false, throttleDown: false, brake: false };

  press(code: string): void {
    const action = ACTION_BY_CODE[code];
    if (action !== undefined) this.down.add(action);
  }

  release(code: string): void {
    const action = ACTION_BY_CODE[code];
    if (action !== undefined) this.down.delete(action);
  }

  releaseAll(): void {
    this.down.clear();
  }

  isDown(action: ShipAction): boolean {
    return this.down.has(action);
  }

  /** Touch joysticks/tilt: analog axis in [-1, 1], added to keyboard state. */
  setVirtualAxis(axis: VirtualAxis, value: number): void {
    this.virtual[axis] = clamp(value, -1, 1);
  }

  /** Touch buttons: hold-state overrides added to keyboard state. */
  setVirtualButton(button: VirtualButton, on: boolean): void {
    this.virtual[button] = on;
  }

  snapshot(): ShipInput {
    const pitch = (this.down.has('pitchUp') ? 1 : 0) + (this.down.has('pitchDown') ? -1 : 0);
    const yaw = (this.down.has('yawLeft') ? 1 : 0) + (this.down.has('yawRight') ? -1 : 0);
    const roll = (this.down.has('rollRight') ? 1 : 0) + (this.down.has('rollLeft') ? -1 : 0);
    return {
      pitch: clamp(pitch + this.virtual.pitch, -1, 1),
      yaw: clamp(yaw + this.virtual.yaw, -1, 1),
      roll: clamp(roll + this.virtual.roll, -1, 1),
      throttleUp: this.down.has('throttleUp') || this.virtual.throttleUp,
      throttleDown: this.down.has('throttleDown') || this.virtual.throttleDown,
      brake: this.down.has('brake') || this.virtual.brake,
    };
  }

  /** Bind to a window; returns a detach function. Bound keys get preventDefault. */
  attach(target: Window): () => void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (ACTION_BY_CODE[event.code] !== undefined) {
        event.preventDefault();
        if (!event.repeat) this.press(event.code);
      }
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      this.release(event.code);
    };
    const onBlur = (): void => {
      this.releaseAll();
    };
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
    return () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    };
  }
}
