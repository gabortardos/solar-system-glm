/**
 * UI layer — dynamic information overlay for the focused body.
 * DOM overlay only; catalog data comes straight from the data layer.
 * `show(bodyId, live?)` rebuilds when the body changes and refreshes live
 * readouts cheaply on every call, so the 10 Hz HUD tick can feed it.
 */

import { getCelestial } from '../data/catalog';
import {
  formatMassKg,
  formatPeriodDays,
  formatRadiusKm,
  formatRotationHours,
  kindLabel,
} from './format';

export interface OverlayLive {
  /** Body's current heliocentric distance, AU. */
  readonly sunDistanceAu: number;
  /** Formatted scene-space distance from the camera eye to the body. */
  readonly cameraDistance: string;
}

export interface OverlayHandlers {
  onFocus(bodyId: string): void;
}

export interface OverlayPanel {
  show(bodyId: string, live?: OverlayLive): void;
  hide(): void;
}

const CSS = `
.sse-overlay{position:fixed;top:96px;right:16px;z-index:11;width:300px;max-height:calc(100vh - 130px);
  overflow:auto;border-radius:12px;background:rgba(10,14,30,.88);color:#cfe3ff;
  border:1px solid rgba(120,160,255,.26);font-family:system-ui,sans-serif;font-size:12px;
  box-shadow:0 14px 44px rgba(0,0,0,.5);display:none}
.sse-overlay.open{display:block}
.sse-ov-head{display:flex;align-items:center;gap:10px;padding:12px 14px;
  border-bottom:1px solid rgba(120,160,255,.18)}
.sse-ov-dot{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 8px currentColor}
.sse-ov-name{font-size:16px;font-weight:600;color:#eaf2ff}
.sse-ov-kind{margin-left:auto;font-size:10px;letter-spacing:1.5px;color:#7f9cd8;
  text-transform:uppercase}
.sse-ov-body{padding:10px 14px 14px}
.sse-ov-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0;color:#a9c2ef}
.sse-ov-row b{color:#eaf2ff;font-weight:600;text-align:right}
.sse-ov-summary{margin:10px 0;color:#c4d6f5;line-height:1.45}
.sse-ov-facts{margin:8px 0 0;padding:8px 0 0;border-top:1px solid rgba(120,160,255,.15);
  list-style:none}
.sse-ov-facts li{padding:2px 0;color:#8fa8d8}
.sse-ov-facts li::before{content:'▸ ';color:#3f7fff}
.sse-ov-focus{margin-top:12px;width:100%;padding:8px;border-radius:8px;cursor:pointer;
  border:1px solid rgba(127,216,255,.4);background:rgba(127,216,255,.1);color:#eaf2ff;
  font-size:12px;letter-spacing:.5px}
.sse-ov-focus:hover{background:rgba(127,216,255,.2);border-color:#7fd8ff}
.sse-ov-close{position:absolute;top:8px;right:10px;background:none;border:none;color:#6f88bb;
  cursor:pointer;font-size:14px;display:none}
.sse-overlay.open .sse-ov-close{display:block}
`;

export function createInfoOverlay(container: HTMLElement, handlers: OverlayHandlers): OverlayPanel {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'sse-overlay';
  root.innerHTML = `
    <button class="sse-ov-close" type="button" aria-label="Close info">✕</button>
    <div class="sse-ov-body">
      <div class="sse-ov-head">
        <span class="sse-ov-dot"></span>
        <span class="sse-ov-name"></span>
        <span class="sse-ov-kind"></span>
      </div>
      <div class="sse-ov-rows"></div>
      <p class="sse-ov-summary"></p>
      <ul class="sse-ov-facts"></ul>
      <button class="sse-ov-focus" type="button">◎ Focus this body</button>
    </div>`;
  container.appendChild(root);

  const nameEl = root.querySelector<HTMLElement>('.sse-ov-name')!;
  const kindEl = root.querySelector<HTMLElement>('.sse-ov-kind')!;
  const dotEl = root.querySelector<HTMLElement>('.sse-ov-dot')!;
  const rowsEl = root.querySelector<HTMLElement>('.sse-ov-rows')!;
  const summaryEl = root.querySelector<HTMLElement>('.sse-ov-summary')!;
  const factsEl = root.querySelector<HTMLElement>('.sse-ov-facts')!;
  const focusBtn = root.querySelector<HTMLButtonElement>('.sse-ov-focus')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('.sse-ov-close')!;

  let currentId: string | null = null;
  let sunEl: HTMLElement | null = null;
  let camEl: HTMLElement | null = null;

  function row(label: string, value: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'sse-ov-row';
    div.innerHTML = `<span>${label}</span><b></b>`;
    div.querySelector('b')!.textContent = value;
    return div;
  }

  function rebuild(bodyId: string): void {
    const record = getCelestial(bodyId);
    if (!record) return;
    currentId = bodyId;

    nameEl.textContent = record.name;
    kindEl.textContent = kindLabel(record.kind);
    dotEl.style.color = record.colorHex;
    dotEl.style.background = record.colorHex;

    rowsEl.innerHTML = '';
    const parent = record.parentId !== null ? getCelestial(record.parentId) : undefined;
    rowsEl.append(row('Orbits', parent?.name ?? '—'));
    rowsEl.append(row('Mean radius', formatRadiusKm(record.radiusKm)));
    if (record.massKg !== undefined) rowsEl.append(row('Mass', formatMassKg(record.massKg)));
    if (record.orbit !== undefined) {
      rowsEl.append(row('Orbital period', formatPeriodDays(record.orbit.periodDays)));
      rowsEl.append(row('Orbit radius', `${record.orbit.semiMajorAxisAu.toFixed(3)} AU`));
    }
    if (record.rotationPeriodHours !== undefined) {
      const hours = record.rotationPeriodHours;
      rowsEl.append(
        row('Rotation', `${formatRotationHours(hours)}${hours < 0 ? ' (retro)' : ''}`),
      );
    }
    const sunRow = row('Sun distance', '—');
    rowsEl.append(sunRow);
    sunEl = sunRow.querySelector('b')!;
    const camRow = row('Cam distance', '—');
    rowsEl.append(camRow);
    camEl = camRow.querySelector('b')!;

    summaryEl.textContent = record.summary;
    factsEl.innerHTML = '';
    for (const fact of record.facts) {
      const li = document.createElement('li');
      li.textContent = fact;
      factsEl.appendChild(li);
    }
    focusBtn.onclick = (): void => handlers.onFocus(bodyId);
  }

  closeBtn.addEventListener('click', () => api.hide());

  const api: OverlayPanel = {
    show(bodyId, live): void {
      if (currentId !== bodyId) rebuild(bodyId);
      root.classList.add('open');
      if (live !== undefined) {
        if (sunEl !== null) sunEl.textContent = `${live.sunDistanceAu.toFixed(3)} AU`;
        if (camEl !== null) camEl.textContent = live.cameraDistance;
      }
    },
    hide(): void {
      root.classList.remove('open');
    },
  };
  return api;
}

