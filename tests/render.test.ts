import { describe, expect, it } from 'vitest';
import { getCelestial } from '../src/data/catalog';
import { sampleOrbitAu } from '../src/sim/orbit';
import { OrbitCamera } from '../src/render/controls';
import { eclipticToScene, sceneToEcliptic } from '../src/render/frame';
import { hashString, mulberry32 } from '../src/render/rand';
import {
  KM_PER_AU,
  bodyRadiusScene,
  heliocentricRadiusScene,
  orbitOffsetScene,
} from '../src/render/scale';
import { heliocentricScenePositions } from '../src/render/sync';

describe('Step 5 — frame mapping', () => {
  it('maps ecliptic (+z north) into Y-up scene space and back', () => {
    expect(eclipticToScene({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 3, z: -2 });
    const v = { x: 4.5, y: -1.25, z: 0.75 };
    const round = sceneToEcliptic(eclipticToScene(v));
    expect(round.x).toBeCloseTo(v.x, 12);
    expect(round.y).toBeCloseTo(v.y, 12);
    expect(round.z).toBeCloseTo(v.z, 12);
  });

  it('mulberry32 is stable for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 8; i++) expect(a()).toBe(b());
    expect(hashString('asteroid-belt')).toBe(hashString('asteroid-belt'));
  });
});

describe('Step 5 — scale strategies', () => {
  const order = [0.387, 0.723, 1, 1.524, 5.203, 9.537, 19.19, 30.07, 39.48, 67.78, 370];

  it('compressed mode is strictly monotonic in distance', () => {
    for (let i = 1; i < order.length; i++) {
      expect(heliocentricRadiusScene(order[i]!, 'compressed')).toBeGreaterThan(
        heliocentricRadiusScene(order[i - 1]!, 'compressed'),
      );
    }
  });

  it('true mode is the identity on distances and physical radii', () => {
    expect(heliocentricRadiusScene(12.34, 'true')).toBe(12.34);
    expect(bodyRadiusScene(6371, 'true')).toBeCloseTo(6371 / KM_PER_AU, 15);
  });

  it('compressed mode keeps Earth in a readable band (~120 units)', () => {
    const r = heliocentricRadiusScene(1, 'compressed');
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(140);
  });

  it('body sizes preserve hierarchy and never vanish', () => {
    const sun = bodyRadiusScene(696_340, 'compressed');
    const jupiter = bodyRadiusScene(69_911, 'compressed');
    const earth = bodyRadiusScene(6371, 'compressed');
    const moon = bodyRadiusScene(1737.4, 'compressed');
    const phobos = bodyRadiusScene(11.27, 'compressed');
    expect(sun).toBeGreaterThan(jupiter);
    expect(jupiter).toBeGreaterThan(earth);
    expect(earth).toBeGreaterThan(moon);
    expect(phobos).toBeGreaterThanOrEqual(0.02);
  });

  it('moon orbits never sink inside their planet in compressed mode', () => {
    const marsRadius = bodyRadiusScene(getCelestial('mars')!.radiusKm ?? 0, 'compressed');
    const phobosDistance = orbitOffsetScene(0.0000627, 3389.5, 11.27, 'compressed');
    expect(phobosDistance).toBeGreaterThan(marsRadius);
  });
});

describe('Step 5 — orbit camera', () => {
  it('clamps phi away from the poles', () => {
    const cam = new OrbitCamera({ minDistance: 4, maxDistance: 1600, distance: 420 });
    cam.rotate(0, 100_000);
    expect(cam.state.phi).toBeCloseTo(0.05, 6);
    cam.rotate(0, -100_000);
    expect(cam.state.phi).toBeCloseTo(Math.PI - 0.05, 6);
  });

  it('zoom clamps to the configured range', () => {
    const cam = new OrbitCamera({ minDistance: 4, maxDistance: 1600, distance: 100 });
    cam.zoom(100_000);
    expect(cam.state.distance).toBe(1600);
    cam.zoom(-100_000);
    expect(cam.state.distance).toBe(4);
  });

  it('position is target plus spherical offset', () => {
    const cam = new OrbitCamera({
      theta: 0,
      phi: Math.PI / 2,
      distance: 10,
      minDistance: 1,
      maxDistance: 100,
    });
    cam.setTarget({ x: 5, y: 6, z: 7 });
    const p = cam.position;
    expect(p.x).toBeCloseTo(5, 9);
    expect(p.y).toBeCloseTo(6, 9);
    expect(p.z).toBeCloseTo(17, 9);
  });
});

describe('Step 5 — scene position sync', () => {
  it('produces one scene position per orbiting body plus the Sun', () => {
    const positions = heliocentricScenePositions(9_500, 'compressed');
    expect(positions.size).toBe(46); // 45 orbiting bodies + sun
    expect(positions.get('sun')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('compressed: Earth sits in its scaled annulus and Moon stays nearby', () => {
    const positions = heliocentricScenePositions(9_500, 'compressed');
    const earth = positions.get('earth')!;
    const earthDistance = Math.hypot(earth.x, earth.y, earth.z);
    expect(earthDistance).toBeGreaterThanOrEqual(
      heliocentricRadiusScene(1 - 0.0167 - 1e-9, 'compressed'),
    );
    expect(earthDistance).toBeLessThanOrEqual(
      heliocentricRadiusScene(1 + 0.0167 + 1e-9, 'compressed'),
    );
    const moon = positions.get('moon')!;
    const moonDistance = Math.hypot(moon.x - earth.x, moon.y - earth.y, moon.z - earth.z);
    expect(moonDistance).toBeGreaterThan(1.5);
    expect(moonDistance).toBeLessThan(2.5);
  });

  it('true: Earth ~1 AU out and Moon ~0.00257 AU from Earth', () => {
    const positions = heliocentricScenePositions(9_500, 'true');
    const earth = positions.get('earth')!;
    const earthDistance = Math.hypot(earth.x, earth.y, earth.z);
    expect(earthDistance).toBeGreaterThan(0.982);
    expect(earthDistance).toBeLessThan(1.018);
    const moon = positions.get('moon')!;
    const moonDistance = Math.hypot(moon.x - earth.x, moon.y - earth.y, moon.z - earth.z);
    expect(moonDistance).toBeGreaterThan(0.0024);
    expect(moonDistance).toBeLessThan(0.0028);
  });

  it('sampleOrbitAu returns a finite, bounded loop', () => {
    const earth = getCelestial('earth')!.orbit!;
    const points = sampleOrbitAu(earth, 240);
    expect(points).toHaveLength(240);
    for (const p of points) {
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
      const radius = Math.hypot(p.x, p.y, p.z);
      expect(radius).toBeGreaterThan(earth.semiMajorAxisAu * (1 - earth.eccentricity) - 1e-9);
      expect(radius).toBeLessThan(earth.semiMajorAxisAu * (1 + earth.eccentricity) + 1e-9);
    }
  });
});

