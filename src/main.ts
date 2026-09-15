/**
 * Solar System Explorer — application entry point.
 * Layer: root composition root — the ONLY file allowed to wire layers together.
 */
import { Engine } from './core/engine';
import { createCanvas } from './render/canvas';
import { SolarScene } from './render/scene';
import type { ScaleMode } from './render/scale';
import { heliocentricScenePositions } from './render/sync';
import { daysSinceJ2000 } from './sim/orbit';

const SECONDS_PER_DAY = 86_400;

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

  // Per-frame presentation: propagate every catalog body at the warped sim time.
  engine.registerRenderer({
    render: (): void => {
      const simulationSeconds = engine.time.snapshot().simulationSeconds;
      const days = bootEpochDays + simulationSeconds / SECONDS_PER_DAY;
      scene.syncPositions(heliocentricScenePositions(days, scene.currentMode));
      scene.render();
    },
  });

  // V toggles between the readable compressed view and true scale.
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.key.toLowerCase() !== 'v') return;
    const next: ScaleMode = scene.currentMode === 'compressed' ? 'true' : 'compressed';
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
    `[solar-system-glm] ${engine.version} kernel online — 48 bodies rendering. ` +
      'Drag to orbit, scroll to zoom, V toggles scale mode.',
  );
}

boot();


