/**
 * Solar System Explorer — application entry point.
 * Layer: root composition root — the ONLY file allowed to wire layers together.
 */
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

  const frame = (): void => {
    // Temporary Step-1 render loop; replaced by the Engine kernel in Step 2.
    gl.clearColor(0.008, 0.008, 0.016, 1); // deep-space black
    gl.clear(gl.COLOR_BUFFER_BIT);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  console.info('[solar-system-glm] Step 1 scaffold online — WebGL2 context acquired.');
}

boot();
