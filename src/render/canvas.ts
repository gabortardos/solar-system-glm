/**
 * Visualization layer — canvas ownership & sizing only.
 * RULE: may implement core-engine contracts; must never be imported by data/sim layers.
 */

export interface ManagedCanvas {
  readonly canvas: HTMLCanvasElement;
  /** Re-sync drawing-buffer size with the host element and device pixel ratio. */
  resize(): void;
}

export function createCanvas(host: HTMLElement): ManagedCanvas {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  host.appendChild(canvas);

  const resize = (): void => {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(host.clientWidth * ratio));
    const h = Math.max(1, Math.floor(host.clientHeight * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  window.addEventListener('resize', resize);
  resize();

  return {
    canvas,
    resize,
  };
}
