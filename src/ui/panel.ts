/**
 * UI layer — Help & Settings panel (DOM overlay).
 * A "?"-button opens a card listing controls plus live settings:
 * time warp (the "natural movement speed" of the solar system), pause,
 * scale mode, and camera mode. Pure logic (warp ladder/slider) lives in warp.ts.
 */

import { formatWarp } from './format';
import { WARP_LADDER, sliderToWarp, warpToSlider } from './warp';

export interface PanelState {
  readonly paused: boolean;
  readonly warp: number;
  readonly scaleMode: 'compressed' | 'true';
  readonly cameraMode: 'chase' | 'orbit';
}

export interface PanelHandlers {
  onPauseToggle(): void;
  onWarpSet(warp: number): void;
  onScaleToggle(): void;
  onCameraToggle(): void;
}

export interface SettingsPanel {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  update(state: PanelState): void;
}

const CSS = `
.sse-help-btn{position:fixed;right:16px;bottom:16px;z-index:11;width:38px;height:38px;
  border-radius:50%;border:1px solid rgba(120,160,255,.3);background:rgba(8,12,26,.75);
  color:#cfe3ff;font-size:18px;font-weight:700;cursor:pointer;backdrop-filter:blur(6px)}
.sse-help-btn:hover{border-color:#7fd8ff;color:#fff}
.sse-backdrop{position:fixed;inset:0;z-index:20;background:rgba(2,4,12,.55);
  display:none;align-items:center;justify-content:center;padding:20px}
.sse-backdrop.open{display:flex}
.sse-panel{width:min(440px,94vw);max-height:86vh;overflow:auto;border-radius:14px;
  background:rgba(10,14,30,.92);border:1px solid rgba(120,160,255,.28);color:#cfe3ff;
  font-family:system-ui,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.6)}
.sse-panel h2{margin:0;padding:14px 18px;font-size:15px;letter-spacing:.5px;
  border-bottom:1px solid rgba(120,160,255,.18);display:flex;justify-content:space-between;align-items:center}
.sse-panel h3{font-size:11px;letter-spacing:2px;color:#7f9cd8;margin:16px 18px 8px;text-transform:uppercase}
.sse-close{background:none;border:none;color:#8fa8d8;font-size:18px;cursor:pointer}
.sse-close:hover{color:#fff}
.sse-section{padding:0 18px}
.sse-btn{padding:7px 12px;border-radius:8px;border:1px solid rgba(120,160,255,.3);
  background:rgba(127,216,255,.08);color:#cfe3ff;font-size:12px;cursor:pointer;margin:2px 4px 2px 0}
.sse-btn:hover{border-color:#7fd8ff}
.sse-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.sse-chip{padding:4px 9px;border-radius:999px;font-size:11px;cursor:pointer;
  border:1px solid rgba(120,160,255,.25);color:#a9c2ef;background:none}
.sse-chip.on{border-color:#7fd8ff;color:#eaf2ff;background:rgba(127,216,255,.12)}
.sse-slider-row{display:flex;align-items:center;gap:10px;margin-top:10px}
.sse-slider{flex:1;accent-color:#3f7fff}
.sse-slider-val{font-size:12px;color:#eaf2ff;min-width:70px;text-align:right;font-variant-numeric:tabular-nums}
.sse-keys{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12px}
.sse-keys kbd{display:inline-block;min-width:20px;text-align:center;padding:2px 6px;
  border-radius:5px;border:1px solid rgba(120,160,255,.35);border-bottom-width:2px;
  background:rgba(20,28,54,.9);color:#eaf2ff;font-family:ui-monospace,monospace;font-size:11px}
.sse-keys span{color:#a9c2ef;align-self:center}
.sse-foot{padding:12px 18px 16px;color:#6f88bb;font-size:11px}
`;

const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['W / S', 'Pitch up / down'],
  ['A / D', 'Yaw left / right'],
  ['Q / E', 'Roll left / right'],
  ['R / F', 'Throttle up / down'],
  ['B', 'Brake to full stop'],
  ['C', 'Camera: chase ↔ free orbit'],
  ['T', 'Pause / resume time'],
  ['N / M', 'Time warp down / up'],
  ['V', 'Scale: compressed ↔ true'],
  ['H', 'Toggle this panel'],
  ['Drag', 'Orbit camera (free mode)'],
  ['Wheel', 'Zoom'],
];

export function createSettingsPanel(container: HTMLElement, handlers: PanelHandlers): SettingsPanel {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.className = 'sse-help-btn';
  button.type = 'button';
  button.title = 'Help & settings (H)';
  button.textContent = '?';

  const backdrop = document.createElement('div');
  backdrop.className = 'sse-backdrop';
  backdrop.innerHTML = `
    <div class="sse-panel" role="dialog" aria-label="Help and settings">
      <h2>Solar System Explorer <button class="sse-close" type="button" aria-label="Close">✕</button></h2>
      <h3>Time &amp; Simulation</h3>
      <div class="sse-section">
        <button class="sse-btn" data-act="pause" type="button">Pause (T)</button>
        <div class="sse-chips" data-act="chips"></div>
        <div class="sse-slider-row">
          <input class="sse-slider" data-act="slider" type="range" min="0" max="1000" step="1" />
          <span class="sse-slider-val" data-act="slider-val">1×</span>
        </div>
      </div>
      <h3>View</h3>
      <div class="sse-section">
        <button class="sse-btn" data-act="scale" type="button">Scale: Compressed (V)</button>
        <button class="sse-btn" data-act="camera" type="button">Camera: Chase (C)</button>
      </div>
      <h3>Controls</h3>
      <div class="sse-section">
        <div class="sse-keys">
          ${CONTROLS.map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('')}
        </div>
      </div>
      <div class="sse-foot">Touch controls and body search arrive in an upcoming step.</div>
    </div>`;
  container.append(button, backdrop);

  const chipsEl = backdrop.querySelector<HTMLElement>('[data-act="chips"]')!;
  const chipButtons = WARP_LADDER.map((warp) => {
    const chip = document.createElement('button');
    chip.className = 'sse-chip';
    chip.type = 'button';
    chip.textContent = formatWarp(warp);
    chip.addEventListener('click', () => handlers.onWarpSet(warp));
    chipsEl.appendChild(chip);
    return chip;
  });

  const pauseBtn = backdrop.querySelector<HTMLButtonElement>('[data-act="pause"]')!;
  const scaleBtn = backdrop.querySelector<HTMLButtonElement>('[data-act="scale"]')!;
  const cameraBtn = backdrop.querySelector<HTMLButtonElement>('[data-act="camera"]')!;
  const slider = backdrop.querySelector<HTMLInputElement>('[data-act="slider"]')!;
  const sliderVal = backdrop.querySelector<HTMLElement>('[data-act="slider-val"]')!;

  pauseBtn.addEventListener('click', () => handlers.onPauseToggle());
  scaleBtn.addEventListener('click', () => handlers.onScaleToggle());
  cameraBtn.addEventListener('click', () => handlers.onCameraToggle());
  slider.addEventListener('input', () => handlers.onWarpSet(sliderToWarp(Number(slider.value))));
  backdrop.querySelector('.sse-close')!.addEventListener('click', () => api.close());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) api.close();
  });

  let open = false;
  const api: SettingsPanel = {
    open(): void {
      open = true;
      backdrop.classList.add('open');
    },
    close(): void {
      open = false;
      backdrop.classList.remove('open');
    },
    toggle(): void {
      if (open) api.close();
      else api.open();
    },
    isOpen(): boolean {
      return open;
    },
    update(state): void {
      pauseBtn.textContent = state.paused ? 'Resume (T)' : 'Pause (T)';
      scaleBtn.textContent = `Scale: ${state.scaleMode === 'true' ? 'True' : 'Compressed'} (V)`;
      cameraBtn.textContent = `Camera: ${state.cameraMode === 'chase' ? 'Chase' : 'Free orbit'} (C)`;
      chipButtons.forEach((chip, i) => chip.classList.toggle('on', WARP_LADDER[i] === state.warp));
      const sliderPos = warpToSlider(state.warp);
      if (Number(slider.value) !== sliderPos && document.activeElement !== slider) {
        slider.value = String(sliderPos);
      }
      sliderVal.textContent = formatWarp(state.warp);
    },
  };
  button.addEventListener('click', () => api.toggle());
  return api;
}

