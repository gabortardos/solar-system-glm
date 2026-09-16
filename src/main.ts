/**
 * Solar System Explorer — application entry point.
 * Layer: root composition root — the ONLY file allowed to wire layers together.
 */
import { Engine } from './core/engine';
import { getCelestial } from './data/catalog';
import { KeyboardActionMap } from './gameplay/input';
import { ShipController, SHIP_SPEED_PROFILES, type FlightEnvelope } from './gameplay/ship';
import { createCanvas } from './render/canvas';
import { heliocentricRadiusScene, bodyRadiusScene, sceneToAuDistance, type ScaleMode } from './render/scale';
import { SolarScene } from './render/scene';
import { buildShipVisual } from './render/ship';
import { heliocentricScenePositions } from './render/sync';
import { daysSinceJ2000 } from './sim/orbit';
import { addVec3, lengthVec3, scaleVec3, type Vec3 } from './sim/vec';

const SECONDS_PER_DAY = 86_400;
/** Ship mesh length per mode: ~1.4 scene units compressed; scaled down in true mode. */
const SHIP_VISUAL_SCALE: Record<ScaleMode, number> = { compressed: 1, true: 0.004 };

function envelopeFor(mode: ScaleMode): FlightEnvelope {
  const sunRadius = bodyRadiusScene(getCelestial('sun')!.radiusKm ?? 696_340, mode);
  return { ...SHIP_SPEED_PROFILES[mode], minSunDistance: sunRadius * 1.5 };
}

function throttle01(ship: ShipController): number {
  const e = ship.envelope;
  const lo = Math.log(e.minSpeed);
  const hi = Math.log(e.maxSpeed);
  return Math.min(1, Math.max(0, (Math.log(Math.max(ship.speed, e.minSpeed)) - lo) / (hi - lo)));
}

function boot(): void {
  const host = document.querySelector<HTMLElement>('#app');
  if (!host) {
    throw new Error('Boot failed: #app host element not found in document.');
  }

  const managed = createCanvas(host);
  if (!managed.canvas.getContext('webgl2')) {
    throw new Error('Boot failed: WebGL2 is not available in this browser.');
  }

  const engine = new Engine();
  const scene = new SolarScene(managed.canvas, 'compressed');
  const bootEpochDays = daysSinceJ2000(new Date());

  // Spawn the ship just off Earth, nose toward the Sun.
  const earthScene = heliocentricScenePositions(bootEpochDays, 'compressed').get('earth')!;
  const spawnOffset: Vec3 = { x: 2.5, y: 1.2, z: 2.5 };
  const ship = new ShipController(envelopeFor('compressed'), {
    position: addVec3(earthScene, spawnOffset),
    lookDirection: scaleVec3(earthScene, -1),
    speed: 4,
  });

  const shipVisual = buildShipVisual();
  shipVisual.setScale(SHIP_VISUAL_SCALE.compressed);
  scene.attach(shipVisual.group);

  const keys = new KeyboardActionMap();
  keys.attach(window);

  engine.register({
    update: (dtSeconds): void => {
      ship.update(dtSeconds, keys.snapshot());
    },
  });

  engine.registerRenderer({
    render: (): void => {
      const days = bootEpochDays + engine.time.snapshot().simulationSeconds / SECONDS_PER_DAY;
      scene.syncPositions(heliocentricScenePositions(days, scene.currentMode));
      shipVisual.sync({ position: ship.position, quaternion: ship.orientation, throttle01: throttle01(ship) });
      scene.controls.setTarget(ship.position); // free-orbit camera anchored to the ship
      scene.render();
    },
  });

  // V toggles between the readable compressed view and true scale.
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.key.toLowerCase() !== 'v') return;
    const from = scene.currentMode;
    const next: ScaleMode = from === 'compressed' ? 'true' : 'compressed';

    // Radially remap the ship's position and speed into the other mode's units.
    const radius = lengthVec3(ship.position);
    if (radius > 1e-12) {
      const au = sceneToAuDistance(radius, from);
      ship.rescale(heliocentricRadiusScene(au, next) / radius);
    }
    ship.setEnvelope(envelopeFor(next));
    shipVisual.setScale(SHIP_VISUAL_SCALE[next]);

    scene.setScaleMode(next);
    console.info(`[solar-system-glm] scale mode: ${next}`);
  });

  const onResize = (): void => {
    managed.resize();
    scene.resize();
  };
  window.addEventListener('resize', onResize);

  engine.start();
  console.info(
    `[solar-system-glm] ${engine.version} kernel online. Fly: W/S pitch, A/D yaw, Q/E roll, ` +
      'R/F throttle, B brake. Camera: drag/scroll. V toggles scale.',
  );
}

boot();



