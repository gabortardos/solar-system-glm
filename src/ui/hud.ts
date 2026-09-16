/**
 * UI layer — minimal navigation HUD (DOM overlay).
 * Readouts only: never touches the WebGL canvas; pointer-events pass through.
 * All math lives in format.ts (pure) — this module just owns DOM elements.
 */

import type { Vec3 } from '../sim/vec';
import {
  bankDeg,
  formatDistance,
  formatDateUtc,
  formatSpeed,
  formatWarp,
  headingDeg,
  pitchDeg,
  type SceneUnitsMode,
} from './format';

export interface HudState {
  readonly speed: number;
  readonly regime: string;
  readonly throttle01: number;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly scaleMode: SceneUnitsMode;
  readonly cameraMode: string;
  readonly sunDistanceAu: number;
  readonly nearestName: string;
  readonly nearestDistance: string;
  readonly warp: number;
  readonly paused: boolean;
  readonly simDate: Date;
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
.sse-flight{top:16px;left:16px;min-width:190px}
.sse-time{top:16px;right:16px;text-align:right}
.sse-nav{bottom:16px;left:16px}
.sse-hint{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
  color:#8fa8d8;letter-spacing:.4px;background:rgba(8,12,26,.5);padding:6px 14px;
  border-radius:999px;border:1px solid rgba(120,160,255,.16)}
.sse-label{font-size:10px;letter-spacing:2px;color:#7f9cd8;margin-bottom:2px}
.sse-speed{font-size:26px;font-weight:600;color:#eaf2ff;line-height:1.1}
.sse-regime{display:inline-block;margin-top:4px;padding:1px 8px;border-radius:999px;
  font-size:10px;letter-spacing:1.5px;border:1px solid currentColor}
.sse-regime.orbital{color:#7fd8ff}.sse-regime.cruise{color:#ffc46b}.sse-regime.warp{color:#ff7bd5}
.sse-throttle{margin-top:8px;height:6px;border-radius:3px;background:rgba(120,160,255,.15);overflow:hidden}
.sse-throttle-fill{height:100%;width:0%;background:linear-gradient(90deg,#3f7fff,#7fd8ff)}
.sse-angles{margin-top:8px;color:#a9c2ef;white-space:nowrap}
.sse-date{font-size:14px;color:#eaf2ff}
.sse-warp{margin-top:4px;color:#a9c2ef}
.sse-paused{display:none;margin-top:4px;color:#ff9d7a;letter-spacing:2px;font-weight:600}
.sse-paused.on{display:block;animation:sse-blink 1.1s steps(2) infinite}
@keyframes sse-blink{50%{opacity:.25}}
.sse-chips{margin-top:6px;color:#8fa8d8}
.sse-row{display:flex;justify-content:space-between;gap:18px;color:#a9c2ef;margin-top:3px}
.sse-row b{color:#eaf2ff;font-weight:600}
`;

function signed(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(0)}°`;
}

export function createHud(container: HTMLElement): Hud {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'sse-hud';
  root.innerHTML = `
    <div class="sse-block sse-flight">
      <div class="sse-label">SPEED</div>
      <div class="sse-speed">—</div>
      <span class="sse-regime orbital">ORBITAL</span>
      <div class="sse-throttle"><div class="sse-throttle-fill"></div></div>
      <div class="sse-angles">HDG 000° · PIT +0° · BNK +0°</div>
    </div>
    <div class="sse-block sse-time">
      <div class="sse-label">MISSION TIME</div>
      <div class="sse-date">—</div>
      <div class="sse-warp">1×</div>
      <div class="sse-paused">PAUSED</div>
      <div class="sse-chips"><span data-chip="scale"></span> · <span data-chip="cam"></span></div>
    </div>
    <div class="sse-block sse-nav">
      <div class="sse-row"><span>NEAREST</span><b data-nav="nearest">—</b></div>
      <div class="sse-row"><span>SUN</span><b data-nav="sun">—</b></div>
    </div>
    <div class="sse-hint">H Help · C Camera · T Pause · N/M Time warp · V Scale</div>`;
  container.appendChild(root);

  const speedEl = root.querySelector<HTMLElement>('.sse-speed')!;
  const regimeEl = root.querySelector<HTMLElement>('.sse-regime')!;
  const fillEl = root.querySelector<HTMLElement>('.sse-throttle-fill')!;
  const anglesEl = root.querySelector<HTMLElement>('.sse-angles')!;
  const dateEl = root.querySelector<HTMLElement>('.sse-date')!;
  const warpEl = root.querySelector<HTMLElement>('.sse-warp')!;
  const pausedEl = root.querySelector<HTMLElement>('.sse-paused')!;
  const scaleChip = root.querySelector<HTMLElement>('[data-chip="scale"]')!;
  const camChip = root.querySelector<HTMLElement>('[data-chip="cam"]')!;
  const nearestEl = root.querySelector<HTMLElement>('[data-nav="nearest"]')!;
  const sunEl = root.querySelector<HTMLElement>('[data-nav="sun"]')!;

  return {
    update(state): void {
      speedEl.textContent = formatSpeed(state.speed, state.scaleMode);
      regimeEl.textContent = state.regime.toUpperCase();
      regimeEl.className = `sse-regime ${state.regime}`;
      fillEl.style.width = `${Math.round(state.throttle01 * 100)}%`;
      anglesEl.textContent =
        `HDG ${headingDeg(state.forward).toFixed(0).padStart(3, '0')}°` +
        ` · PIT ${signed(pitchDeg(state.forward))} · BNK ${signed(bankDeg(state.right))}`;
      dateEl.textContent = formatDateUtc(state.simDate);
      warpEl.textContent = `WARP ${formatWarp(state.warp)}`;
      pausedEl.className = `sse-paused${state.paused ? ' on' : ''}`;
      scaleChip.textContent = `SCALE ${state.scaleMode.toUpperCase()}`;
      camChip.textContent = `CAM ${state.cameraMode.toUpperCase()}`;
      nearestEl.textContent = `${state.nearestName} · ${state.nearestDistance}`;
      sunEl.textContent = `${state.sunDistanceAu.toFixed(3)} AU`;
    },
  };
}

export { formatDistance };
