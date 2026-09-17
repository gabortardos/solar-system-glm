/**
 * Solar System Explorer — application entry point.
 * Layer: root composition root — the ONLY file allowed to wire layers together.
 *
 * Camera-first explorer: there is no spaceship. The orbit camera always
 * investigates the focused body — drag (or one finger) to circle around it,
 * wheel/pinch to zoom, G/K/overlay to jump between bodies.
 */

import { Engine } from './core/engine';
import { CELESTIAL_CATALOG, getCelestial } from './data/catalog';
import { cycleFocus, focusableBodies } from './gameplay/targeting';
import { createCanvas } from './render/canvas';
import {
  bodyRadiusScene,
  framingDistanceScene,
  sceneToAuDistance,
  type ScaleMode,
} from './render/scale';
import { SolarScene } from './render/scene';
import { heliocentricScenePositions } from './render/sync';
import { J2000_UTC_MS, daysSinceJ2000 } from './sim/orbit';
import { lengthVec3, type Vec3 } from './sim/vec';
import { formatDistance } from './ui/format';
import { createHud } from './ui/hud';
import { createInfoOverlay } from './ui/overlay';
import { createSettingsPanel, type PanelState } from './ui/panel';
import { createSearchPalette } from './ui/palette';
import { nextWarp } from './ui/warp';

const SECONDS_PER_DAY = 86_400;
const MS_PER_DAY = 86_400_000;
/** HUD DOM refresh cadence (frames); 60/6 = 10 Hz. */
const HUD_EVERY_FRAMES = 6;
/** Boot focus: the showcase body — the photoreal Moon. */
const BOOT_FOCUS_ID = 'moon';

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
  const FOCUS_BODIES = focusableBodies(CELESTIAL_CATALOG);

  let focusId = BOOT_FOCUS_ID;
  let frame = 0;

  function currentDays(): number {
    return bootEpochDays + engine.time.snapshot().simulationSeconds / SECONDS_PER_DAY;
  }

  function focusRadiusScene(id: string, mode: ScaleMode): number {
    return bodyRadiusScene(getCelestial(id)?.radiusKm ?? 1, mode);
  }

  /** Focus a body: re-frame the camera around it for investigation. */
  function focusBody(id: string): void {
    const record = getCelestial(id);
    if (record === undefined) return;
    focusId = id;
    const mode = scene.currentMode;
    const radius = focusRadiusScene(id, mode);
    const position = heliocentricScenePositions(currentDays(), mode).get(id);
    if (position !== undefined) {
      scene.frameBody(position, radius, framingDistanceScene(radius, mode));
    }
  }

  function panelState(): PanelState {
    const snap = engine.time.snapshot();
    return { paused: snap.paused, warp: snap.timeScale, scaleMode: scene.currentMode };
  }

  function toggleScale(): void {
    scene.setScaleMode(scene.currentMode === 'compressed' ? 'true' : 'compressed');
    focusBody(focusId); // re-frame at the new scale's units
  }

  const hud = createHud(host);
  const overlay = createInfoOverlay(host, {
    onFocus(bodyId): void {
      focusBody(bodyId);
    },
  });
  const panel = createSettingsPanel(host, {
    onPauseToggle: () => {
      engine.time.togglePause();
      panel.update(panelState());
    },
    onWarpSet: (warp: number) => {
      engine.time.setTimeScale(warp);
      panel.update(panelState());
    },
    onScaleToggle: () => {
      toggleScale();
      panel.update(panelState());
    },
    onFocusNext: () => {
      focusBody(cycleFocus(focusId, FOCUS_BODIES).id);
      panel.update(panelState());
    },
  });
  panel.update(panelState());
  const palette = createSearchPalette(host, {
    onSelect(bodyId): void {
      focusBody(bodyId);
    },
  });

  engine.registerRenderer({
    render: (): void => {
      frame += 1;
      const snap = engine.time.snapshot();
      const days = bootEpochDays + snap.simulationSeconds / SECONDS_PER_DAY;
      const mode = scene.currentMode;
      const positions = heliocentricScenePositions(days, mode);
      scene.syncPositions(positions, days);

      // The camera rides along with the focused body as it orbits.
      const focusPos: Vec3 | undefined = positions.get(focusId);
      if (focusPos !== undefined) scene.controls.setTarget(focusPos);

      if (frame % HUD_EVERY_FRAMES === 0 && focusPos !== undefined) {
        const focusRecord = getCelestial(focusId);
        const sunAu = sceneToAuDistance(lengthVec3(focusPos), mode);
        const cameraDistance = formatDistance(scene.controls.state.distance, mode);
        overlay.show(focusId, { sunDistanceAu: sunAu, cameraDistance });
        hud.update({
          scaleMode: mode,
          warp: snap.timeScale,
          paused: snap.paused,
          simDate: new Date(J2000_UTC_MS + days * MS_PER_DAY),
          focusName: focusRecord?.name ?? null,
          focusDistance: cameraDistance,
          sunDistanceAu: sunAu,
        });
      }
    },
  });

  // Letter-keyed app shortcuts (navigation lives in the camera, not the keys).
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

  focusBody(BOOT_FOCUS_ID); // frame the Moon before the first render
  engine.start();
  console.info(
    `[solar-system-glm] ${engine.version} kernel online. Focus-first explorer: ` +
      'drag or one finger orbits the focused body, wheel/pinch zooms. ' +
      'G focus next body, K search, T pause, N/M time warp, H help, V scale.',
  );
}

boot();
