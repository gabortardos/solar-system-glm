/**
 * UI layer — minimal explorer HUD (DOM overlay).
 * Readouts only: never touches the WebGL canvas; pointer-events pass through.
 * All math lives in format.ts (pure) — this module just owns DOM elements.
 */

import { formatDateUtc, formatWarp, type SceneUnitsMode } from './format';

export interface HudState {
  readonly scaleMode: SceneUnitsMode;
  readonly warp: number;
  readonly paused: boolean;
  readonly simDate: Date;
  readonly focusName: string | null;
  /** Formatted scene-space distance from the camera eye to the focused body. */
  readonly focusDistance: string;
  /** Focused body's current heliocentric distance, AU. */
  readonly sunDistanceAu: number;
}

export interface Hud {
  update(state: HudState): void;
}

const CSS = `
.sse-hud{position:fixed;inset:0;pointer-events:none;z-index:10;color:#cfe3ff;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;user-select:none}
.sse-hud .sse-block{position:absolute;padding:10px 14px;border-radius:10px;
  background:rgba(8,12,26,.66);border:1px solid rgba(120,160,255,.22);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.sse-time{top:16px;right:16px;text-align:right}
.sse-nav{bottom:16px;left:16px}
.sse-hint{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
  color:#8fa8d8;letter-spacing:.4px;background:rgba(8,12,26,.5);padding:6px 14px;
  border-radius:999px;border:1px solid rgba(120,160,255,.16);white-space:nowrap}
.sse-label{font-size:10px;letter-spacing:2px;color:#7f9cd8;margin-bottom:2px}
.sse-date{font-size:14px;color:#eaf2ff}
.sse-warp{margin-top:4px;color:#a9c2ef}
.sse-paused{display:none;margin-top:4px;color:#ff9d7a;letter-spacing:2px;font-weight:600}
.sse-paused.on{display:block;animation:sse-blink 1.1s steps(2) infinite}
@keyframes sse-blink{50%{opacity:.25}}
.sse-chips{margin-top:6px;color:#8fa8d8}
.sse-row{display:flex;justify-content:space-between;gap:18px;color:#a9c2ef;margin-top:3px}
.sse-row b{color:#eaf2ff;font-weight:600}
`;

export function createHud(container: HTMLElement): Hud {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'sse-hud';
  root.innerHTML = `
    <div class="sse-block sse-time">
      <div class="sse-label">MISSION TIME</div>
      <div class="sse-date">—</div>
      <div class="sse-warp">1×</div>
      <div class="sse-paused">PAUSED</div>
      <div class="sse-chips"><span data-chip="scale"></span></div>
    </div>
    <div class="sse-block sse-nav">
      <div class="sse-row"><span>FOCUS</span><b data-nav="focus">—</b></div>
      <div class="sse-row"><span>CAMERA</span><b data-nav="cam">—</b></div>
      <div class="sse-row"><span>SUN</span><b data-nav="sun">—</b></div>
    </div>
    <div class="sse-hint">Drag orbit · Pinch/Scroll zoom · G Focus · K Search · T Pause · N/M Time · V Scale · H Help</div>`;
  container.appendChild(root);

  const dateEl = root.querySelector<HTMLElement>('.sse-date')!;
  const warpEl = root.querySelector<HTMLElement>('.sse-warp')!;
  const pausedEl = root.querySelector<HTMLElement>('.sse-paused')!;
  const scaleChip = root.querySelector<HTMLElement>('[data-chip="scale"]')!;
  const sunEl = root.querySelector<HTMLElement>('[data-nav="sun"]')!;
  const camEl = root.querySelector<HTMLElement>('[data-nav="cam"]')!;
  const focusEl = root.querySelector<HTMLElement>('[data-nav="focus"]')!;

  return {
    update(state): void {
      dateEl.textContent = formatDateUtc(state.simDate);
      warpEl.textContent = `WARP ${formatWarp(state.warp)}`;
      pausedEl.className = `sse-paused${state.paused ? ' on' : ''}`;
      scaleChip.textContent = `SCALE ${state.scaleMode.toUpperCase()}`;
      sunEl.textContent = `${state.sunDistanceAu.toFixed(3)} AU`;
      camEl.textContent = state.focusDistance;
      focusEl.textContent = state.focusName ?? '—';
    },
  };
}
