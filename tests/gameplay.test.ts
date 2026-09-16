import { describe, expect, it } from 'vitest';
import {
  QUAT_IDENTITY,
  quatFromAxisAngle,
  quatLookTo,
  quatNormalize,
  quatRotateVector,
} from '../src/sim/quat';
import {
  ShipController,
  SHIP_SPEED_PROFILES,
  type FlightEnvelope,
  type ShipInput,
} from '../src/gameplay/ship';
import { KeyboardActionMap } from '../src/gameplay/input';
import { heliocentricRadiusScene, sceneToAuDistance } from '../src/render/scale';

const DT = 1 / 60;

function makeEnvelope(): FlightEnvelope {
  return { ...SHIP_SPEED_PROFILES.compressed, minSunDistance: 5 };
}

function makeShip(): ShipController {
  return new ShipController(makeEnvelope(), {
    position: { x: 100, y: 0, z: 0 },
    lookDirection: { x: -1, y: 0, z: 0 },
    speed: 5,
  });
}

function hold(ship: ShipController, input: ShipInput, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) ship.update(DT, input);
}

const input = (partial: Partial<ShipInput>): ShipInput => ({
  pitch: 0, yaw: 0, roll: 0, throttleUp: false, throttleDown: false, brake: false, ...partial,
});

describe('Step 6 — quaternion algebra', () => {
  it('identity leaves vectors untouched', () => {
    const v = quatRotateVector(QUAT_IDENTITY, { x: 1, y: 2, z: 3 });
    expect(v.x).toBeCloseTo(1, 12);
    expect(v.y).toBeCloseTo(2, 12);
    expect(v.z).toBeCloseTo(3, 12);
  });

  it('rotates +X to -Z under +90 degrees about +Y (right-handed)', () => {
    const q = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
    const v = quatRotateVector(q, { x: 1, y: 0, z: 0 });
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(-1, 12);
  });

  it('quatLookTo along -Z with +Y up is the identity rotation', () => {
    const q = quatLookTo({ x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
    expect(Math.abs(q.w)).toBeCloseTo(1, 9);
    expect(Math.hypot(q.x, q.y, q.z)).toBeLessThan(1e-9);
  });

  it('quatLookTo aims the nose and keeps up', () => {
    const q = quatLookTo({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    const forward = quatRotateVector(q, { x: 0, y: 0, z: -1 });
    const up = quatRotateVector(q, { x: 0, y: 1, z: 0 });
    expect(forward.x).toBeCloseTo(1, 9);
    expect(Math.abs(forward.y)).toBeLessThan(1e-9);
    expect(Math.abs(forward.z)).toBeLessThan(1e-9);
    expect(up.y).toBeCloseTo(1, 9);
  });

  it('quatNormalize produces unit length', () => {
    const q = quatNormalize({ x: 3, y: 4, z: 0, w: 12 });
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 12);
  });
});

describe('Step 6 — arcade ship controller', () => {
  it('flies straight: no input advances position exactly along the nose', () => {
    const ship = makeShip();
    hold(ship, input({}), 1);
    expect(ship.position.x).toBeCloseTo(95, 9);
    expect(ship.position.y).toBeCloseTo(0, 9);
    expect(ship.position.z).toBeCloseTo(0, 9);
  });

  it('W pitches the nose up', () => {
    const ship = makeShip();
    hold(ship, input({ pitch: 1 }), 1);
    expect(ship.forward.y).toBeGreaterThan(0.5);
  });

  it('E rolls right: the right wing dips', () => {
    const ship = makeShip();
    hold(ship, input({ roll: 1 }), 0.5);
    expect(ship.right.y).toBeLessThan(-0.2);
  });

  it('R accelerates to warp with a hard ceiling', () => {
    const ship = makeShip();
    ship.teleport({ x: 100, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }); // face away from the Sun
    hold(ship, input({ throttleUp: true }), 2.5);
    expect(ship.speed).toBeGreaterThan(130);
    expect(ship.speed).toBeLessThanOrEqual(260);
    expect(ship.regime).toBe('warp');
  });

  it('F decelerates but never below minSpeed while not braking', () => {
    const ship = makeShip();
    hold(ship, input({ throttleDown: true }), 3);
    expect(ship.speed).toBeCloseTo(0.5, 9);
  });

  it('B brakes toward a full stop (orbital regime)', () => {
    const ship = makeShip();
    ship.teleport({ x: 100, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }); // face away from the Sun
    hold(ship, input({ throttleUp: true }), 2.5);
    hold(ship, input({ brake: true }), 1.5);
    expect(ship.speed).toBeLessThan(1);
    expect(ship.regime).toBe('orbital');
  });

  it('solar keep-out shoves the ship outside the shell', () => {
    const ship = makeShip();
    ship.teleport({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 });
    ship.update(DT, input({}));
    expect(Math.hypot(ship.position.x, ship.position.y, ship.position.z)).toBeCloseTo(5, 9);
  });

  it('rescale moves position and speed together', () => {
    const ship = makeShip();
    ship.rescale(0.1);
    expect(ship.position.x).toBeCloseTo(10, 12);
    expect(ship.speed).toBeCloseTo(0.5, 12);
  });

  it('setEnvelope clamps speed into the new profile', () => {
    const ship = makeShip();
    ship.setEnvelope({ minSpeed: 10, maxSpeed: 100, throttleRate: 1, brakeRate: 1, minSunDistance: 1 });
    expect(ship.speed).toBeCloseTo(10, 9);
  });
});

describe('Step 6 — semantic input map', () => {
  it('maps letter keys to flight axes with cancellation', () => {
    const keys = new KeyboardActionMap();
    expect(keys.snapshot().pitch).toBe(0);
    keys.press('KeyW');
    expect(keys.snapshot().pitch).toBe(1);
    keys.press('KeyS');
    expect(keys.snapshot().pitch).toBe(0);
    keys.release('KeyW');
    expect(keys.snapshot().pitch).toBe(-1);
    keys.release('KeyS');
    expect(keys.snapshot().pitch).toBe(0);
  });

  it('yaw and roll follow the documented signs', () => {
    const keys = new KeyboardActionMap();
    keys.press('KeyA');
    expect(keys.snapshot().yaw).toBe(1); // A = nose left
    keys.press('KeyD');
    expect(keys.snapshot().yaw).toBe(0);
    keys.releaseAll();
    keys.press('KeyE');
    expect(keys.snapshot().roll).toBe(1); // E = roll right
    keys.press('KeyQ');
    expect(keys.snapshot().roll).toBe(0);
  });

  it('exposes throttle and brake buttons', () => {
    const keys = new KeyboardActionMap();
    keys.press('KeyR');
    expect(keys.snapshot().throttleUp).toBe(true);
    keys.press('KeyF');
    expect(keys.snapshot().throttleDown).toBe(true);
    keys.press('KeyB');
    expect(keys.snapshot().brake).toBe(true);
    keys.releaseAll();
    expect(keys.snapshot().brake).toBe(false);
  });

  it('ignores non-bound codes (no special-character bindings exist)', () => {
    const keys = new KeyboardActionMap();
    keys.press('BracketLeft');
    keys.press('Semicolon');
    keys.press('Space');
    const snap = keys.snapshot();
    expect(snap.pitch + snap.yaw + snap.roll).toBe(0);
    expect(snap.throttleUp || snap.throttleDown || snap.brake).toBe(false);
  });

  it('virtual axes/buttons (future touch UI) feed the same snapshot', () => {
    const keys = new KeyboardActionMap();
    keys.setVirtualAxis('yaw', -1);
    expect(keys.snapshot().yaw).toBe(-1);
    keys.setVirtualAxis('pitch', 5); // clamped to [-1, 1]
    expect(keys.snapshot().pitch).toBe(1);
    keys.setVirtualButton('brake', true);
    expect(keys.snapshot().brake).toBe(true);
    keys.setVirtualAxis('roll', 1);
    expect(keys.snapshot().roll).toBe(1);
  });
});

describe('Step 6 — scale round-trip for mode toggling', () => {
  it('sceneToAuDistance inverts heliocentricRadiusScene exactly', () => {
    for (const au of [0.05, 0.387, 1, 9.537, 30.07, 97.4, 370]) {
      expect(sceneToAuDistance(heliocentricRadiusScene(au, 'compressed'), 'compressed')).toBeCloseTo(au, 9);
    }
    expect(sceneToAuDistance(12.34, 'true')).toBe(12.34);
  });
});

