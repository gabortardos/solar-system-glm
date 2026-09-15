/**
 * Solar System Explorer — application entry point.
 * Layer: root composition root — the ONLY file allowed to wire layers together.
 */
import { Engine } from './core/engine';
import { createCanvas } from './render/canvas';

function boot(): void {
  const host = document.querySelector<HTMLElement>('#app');
  if (!host) {
    throw new Error('Boot failed: #app host element not found in document.');
  }

  const managed = createCanvas(host);
  const gl = managed.canvas.getContext('webgl2');
  if (!gl) {
    throw new Error('Boot failed: WebGL2 is not available in this browser.');
  }

  const engine = new Engine();

  // Step-2 placeholder renderer: deep-space clear driven by the kernel's interpolation alpha.
  engine.registerRenderer({
    render: (alpha: number): void => {
      gl.clearColor(0.008 + 0.004 * alpha, 0.008, 0.016, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  });

  window.addEventListener('resize', managed.resize);
  engine.start();
  console.info(`[solar-system-glm] ${engine.version} kernel online.`);
}

boot();

