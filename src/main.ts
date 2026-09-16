/**
 * Solar System Explorer — application entry point.
 * Layer: root composition root — the ONLY file allowed to wire layers together.
 */
import { Engine } from './core/engine';
import { CELESTIAL_CATALOG, getCelestial } from './data/catalog';
import { KeyboardActionMap } from './gameplay/input';
import { ShipController, SHIP_SPEED_PROFILES, type FlightEnvelope } from './gameplay/ship';
import { cycleFocus, focusableBodies, travelArrival } from './gameplay/targeting';
import { createCanvas } from './render/canvas';
import { chaseCameraPose } from './render/controls';
import {
  heliocentricRadiusScene,
  bodyRadiusScene,
  framingDistanceScene,
  sceneToAuDistance,
  type ScaleMode,
} from './render/scale';
import { SolarScene } from './render/scene';
import { buildShipVisual } from './render/ship';
import { heliocentricScenePositions } from './render/sync';
import { J2000_UTC_MS, daysSinceJ2000 } from './sim/orbit';
import { addVec3, lengthVec3, scaleVec3, type Vec3 } from './sim/vec';
import { formatDistance } from './ui/format';
import { createHud } from './ui/hud';
import { createInfoOverlay } from './ui/overlay';
import { createSettingsPanel, type PanelState } from './ui/panel';
import { createSearchPalette } from './ui/palette';
import { nextWarp } from './ui/warp';

const SECONDS_PER_DAY = 86_400;
const MS_PER_DAY = 86_400_000;
/** Ship mesh length per mode: ~1.4 scene units compressed; scaled down in true mode. */
const SHIP_VISUAL_SCALE: Record<ScaleMode, number> = { compressed: 1, true: 0.004 };
/** Chase camera eye distance from the ship, per scale mode. */
const CHASE_DISTANCE: Record<ScaleMode, number> = { compressed: 7, true: 0.03 };
/** Boot framing: start the free-orbit camera close enough to see the ship. */
const BOOT_ORBIT_DISTANCE = 9;
/** HUD DOM refresh cadence (frames); 60/6 = 10 Hz. */
const HUD_EVERY_FRAMES = 6;

type CameraMode = 'chase' | 'orbit' | 'follow';

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

  // Start framed on the ship: chase cam by default, free-orbit anchored close by.
  let cameraMode: CameraMode = 'chase';
  scene.controls.setTarget(ship.position);
  scene.controls.setDistance(BOOT_ORBIT_DISTANCE);

  const hud = createHud(document.body);

  // --- Focus targeting (Steps 7/8): follow-body camera, info overlay, search & travel.
  const FOCUS_BODIES = focusableBodies(CELESTIAL_CATALOG);
  let focusId: string | null = null;

  const overlay = createInfoOverlay(document.body, {
    onTravel: (id: string): void => travelTo(id),
  });
  const palette = createSearchPalette(document.body, {
    onSelect: (id: string): void => focusBody(id),
    onTravel: (id: string): void => travelTo(id),
  });

  function currentDays(): number {
    return bootEpochDays + engine.time.snapshot().simulationSeconds / SECONDS_PER_DAY;
  }

  /** Auto-frame the focused body: orbit camera pulled to ~6 body radii. */
  function frameFocusedBody(): void {
    const record = focusId !== null ? getCelestial(focusId) : undefined;
    if (record === undefined) return;
    const mode = scene.currentMode;
    scene.controls.setDistance(
      framingDistanceScene(bodyRadiusScene(record.radiusKm ?? 0, mode), mode),
    );
  }

  function focusBody(id: string): void {
    focusId = id;
    cameraMode = 'follow';
    scene.setChasePose(null);
    frameFocusedBody();
    overlay.show(id);
  }

  /** Warp the ship to a standoff near the body, nose aimed at it, then follow it. */
  function travelTo(id: string): void {
    const record = getCelestial(id);
    if (record === undefined) return;
    const mode = scene.currentMode;
    const target = heliocentricScenePositions(currentDays(), mode).get(id);
    if (target === undefined) return;
    const radiusScene = bodyRadiusScene(record.radiusKm ?? 0, mode);
    const standoff =
      mode === 'compressed'
        ? Math.max(radiusScene * 3, 2.5)
        : Math.max(radiusScene * 4, radiusScene + 0.002);
    const plan = travelArrival(target, ship.position, standoff);
    ship.teleport(plan.position, plan.lookDirection, ship.envelope.maxSpeed * 0.1);
    focusBody(id);
    console.info(`[solar-system-glm] warped to ${record.name}`);
  }

  function panelState(): PanelState {
    return {
      paused: engine.time.isPaused,
      warp: engine.time.currentScale,
      scaleMode: scene.currentMode,
      cameraMode,
    };
  }

  function toggleScale(): void {
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
  }

  function toggleCamera(): void {
    cameraMode = cameraMode === 'chase' ? 'orbit' : cameraMode === 'orbit' ? 'follow' : 'chase';
    if (cameraMode === 'orbit') {
      scene.setChasePose(null);
      scene.controls.setTarget(ship.position);
    } else if (cameraMode === 'follow') {
      if (focusId === null) focusId = 'sun';
      scene.setChasePose(null);
      frameFocusedBody();
      overlay.show(focusId);
    }
  }

  const panel = createSettingsPanel(document.body, {
    onPauseToggle: (): void => {
      engine.time.togglePause();
      panel.update(panelState());
    },
    onWarpSet: (warp: number): void => {
      engine.time.setTimeScale(warp);
      panel.update(panelState());
    },
    onScaleToggle: (): void => {
      toggleScale();
      panel.update(panelState());
    },
    onCameraToggle: (): void => {
      toggleCamera();
      panel.update(panelState());
    },
  });
  panel.update(panelState());

  engine.register({
    update: (dtSeconds): void => {
      ship.update(dtSeconds, keys.snapshot());
    },
  });

  let frame = 0;
  engine.registerRenderer({
    render: (): void => {
      keys.setEnabled(!panel.isOpen() && !palette.isOpen()); // modal UI freezes flight input
      const snap = engine.time.snapshot();
      const days = bootEpochDays + snap.simulationSeconds / SECONDS_PER_DAY;
      const positions = heliocentricScenePositions(days, scene.currentMode);
      scene.syncPositions(positions);
      shipVisual.sync({
        position: ship.position,
        quaternion: ship.orientation,
        throttle01: throttle01(ship),
      });

      if (cameraMode === 'chase') {
        scene.setChasePose(
          chaseCameraPose(ship.position, ship.orientation, CHASE_DISTANCE[scene.currentMode]),
        );
      } else if (cameraMode === 'follow' && focusId !== null) {
        scene.setChasePose(null);
        const target = positions.get(focusId);
        if (target !== undefined) scene.controls.setTarget(target); // camera locked on the body
      } else {
        scene.setChasePose(null);
        scene.controls.setTarget(ship.position); // free-orbit camera anchored to the ship
      }
      scene.render();

      // HUD refresh at ~10 Hz: everything the pilot needs at a glance.
      if (++frame % HUD_EVERY_FRAMES === 0) {
        let nearestName = '—';
        let nearestDistance = Infinity;
        for (const [id, p] of positions) {
          const d = lengthVec3(addVec3(p, scaleVec3(ship.position, -1)));
          if (d < nearestDistance) {
            nearestDistance = d;
            nearestName = getCelestial(id)?.name ?? id;
          }
        }
        const mode = scene.currentMode;
        const focusRecord = focusId !== null ? getCelestial(focusId) : undefined;
        const focusPos = focusId !== null ? positions.get(focusId) : undefined;
        const focusDistance =
          focusPos !== undefined
            ? formatDistance(lengthVec3(addVec3(focusPos, scaleVec3(ship.position, -1))), mode)
            : '';
        if (focusRecord !== undefined && focusPos !== undefined) {
          overlay.show(focusRecord.id, {
            sunDistanceAu: sceneToAuDistance(lengthVec3(focusPos), mode),
            shipDistance: focusDistance,
          });
        }
        hud.update({
          speed: ship.speed,
          regime: ship.regime,
          throttle01: throttle01(ship),
          forward: ship.forward,
          right: ship.right,
          scaleMode: mode,
          cameraMode,
          sunDistanceAu: sceneToAuDistance(lengthVec3(ship.position), mode),
          nearestName,
          nearestDistance: formatDistance(nearestDistance, mode),
          warp: snap.timeScale,
          paused: snap.paused,
          simDate: new Date(J2000_UTC_MS + days * MS_PER_DAY),
          focusName: focusRecord?.name ?? null,
          focusDistance,
        });
      }
    },
  });

  // Letter-keyed app shortcuts (flight uses its own physical-code map).
  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    if (
      target !== null &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return; // typing into UI widgets never triggers shortcuts
    }
    const key = event.key.toLowerCase();

    if (key === 'n' || key === 'm') {
      // Time warp down/up — hold to sweep the ladder (auto-repeat allowed).
      engine.time.setTimeScale(nextWarp(engine.time.currentScale, key === 'm' ? 1 : -1));
      panel.update(panelState());
      return;
    }
    if (event.repeat) return; // toggles below fire once per keypress

    if (key === 'v') {
      toggleScale();
      panel.update(panelState());
    } else if (key === 't') {
      engine.time.togglePause();
      panel.update(panelState());
    } else if (key === 'c') {
      toggleCamera();
      panel.update(panelState());
    } else if (key === 'g') {
      focusBody(cycleFocus(focusId, FOCUS_BODIES).id);
      panel.update(panelState());
    } else if (key === 'k') {
      palette.toggle();
    } else if (key === 'h' || key === '?') {
      panel.toggle();
    } else if (event.key === 'Escape') {
      if (palette.isOpen()) palette.close();
      else if (panel.isOpen()) panel.close();
    }
  });

  const onResize = (): void => {
    managed.resize();
    scene.resize();
  };
  window.addEventListener('resize', onResize);

  engine.start();
  console.info(
    `[solar-system-glm] ${engine.version} kernel online. Chase cam by default: W/S/A/D/Q/E steer, ` +
      'R/F throttle, B brake. G focus next body, K search, C camera, T pause, N/M time warp, ' +
      'H help, V scale.',
  );
}

boot();




