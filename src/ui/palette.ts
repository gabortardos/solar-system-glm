/**
 * UI layer — body search palette (K).
 * Top-center command bar: type to filter, ↑/↓ + Enter (or click) to focus a
 * body, the ✈ button warps the ship there. Matching logic lives in search.ts.
 */

import { CELESTIAL_CATALOG } from '../data/catalog';
import { buildSearchEntries, matchBodies, type SearchEntry } from './search';

export interface PaletteHandlers {
  onSelect(bodyId: string): void;
  onTravel(bodyId: string): void;
}

export interface SearchPalette {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

const CSS = `
.sse-pal-backdrop{position:fixed;inset:0;z-index:30;background:rgba(2,4,12,.45);
  display:none;justify-content:center;padding-top:12vh}
.sse-pal-backdrop.open{display:flex}
.sse-pal{width:min(460px,92vw);height:fit-content;border-radius:12px;overflow:hidden;
  background:rgba(10,14,30,.95);border:1px solid rgba(120,160,255,.3);color:#cfe3ff;
  font-family:system-ui,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.6);align-self:flex-start}
.sse-pal input{width:100%;box-sizing:border-box;padding:13px 16px;font-size:15px;color:#eaf2ff;
  background:none;border:none;border-bottom:1px solid rgba(120,160,255,.2);outline:none}
.sse-pal input::placeholder{color:#6f88bb}
.sse-pal-list{list-style:none;margin:0;padding:6px;max-height:330px;overflow:auto}
.sse-pal-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;
  cursor:pointer}
.sse-pal-row.on{background:rgba(127,216,255,.12)}
.sse-pal-name{color:#eaf2ff;font-size:14px}
.sse-pal-sub{color:#7f9cd8;font-size:11px}
.sse-pal-fly{margin-left:auto;flex:none;padding:4px 9px;border-radius:7px;font-size:11px;
  border:1px solid rgba(127,216,255,.35);background:rgba(127,216,255,.08);color:#cfe3ff;
  cursor:pointer}
.sse-pal-fly:hover{border-color:#7fd8ff;background:rgba(127,216,255,.18)}
.sse-pal-empty{padding:12px;color:#6f88bb;font-size:12px}
`;

export function createSearchPalette(container: HTMLElement, handlers: PaletteHandlers): SearchPalette {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const entries = buildSearchEntries(CELESTIAL_CATALOG);

  const backdrop = document.createElement('div');
  backdrop.className = 'sse-pal-backdrop';
  backdrop.innerHTML = `
    <div class="sse-pal">
      <input type="text" placeholder="Search bodies — Enter to focus, ✈ to fly there" autocomplete="off" spellcheck="false" />
      <ul class="sse-pal-list"></ul>
    </div>`;
  container.appendChild(backdrop);

  const input = backdrop.querySelector<HTMLInputElement>('input')!;
  const listEl = backdrop.querySelector<HTMLElement>('.sse-pal-list')!;

  let results: readonly SearchEntry[] = [];
  let active = 0;
  let open = false;

  function renderList(): void {
    listEl.innerHTML = '';
    if (results.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'sse-pal-empty';
      empty.textContent = 'No matching bodies.';
      listEl.appendChild(empty);
      return;
    }
    results.forEach((entry, i) => {
      const li = document.createElement('li');
      li.className = `sse-pal-row${i === active ? ' on' : ''}`;
      const name = document.createElement('span');
      name.className = 'sse-pal-name';
      name.textContent = entry.name;
      const sub = document.createElement('span');
      sub.className = 'sse-pal-sub';
      sub.textContent = entry.parentName !== '' ? `${entry.kind} · ${entry.parentName}` : entry.kind;
      const fly = document.createElement('button');
      fly.className = 'sse-pal-fly';
      fly.type = 'button';
      fly.textContent = '✈ fly';
      fly.addEventListener('click', (e) => {
        e.stopPropagation();
        api.close();
        handlers.onTravel(entry.id);
      });
      li.append(name, sub, fly);
      li.addEventListener('click', () => {
        api.close();
        handlers.onSelect(entry.id);
      });
      listEl.appendChild(li);
    });
  }

  function refresh(): void {
    results = matchBodies(input.value, entries);
    active = 0;
    renderList();
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[active];
      if (pick !== undefined) {
        api.close();
        handlers.onSelect(pick.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      api.close();
    }
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) api.close();
  });

  const api: SearchPalette = {
    open(): void {
      open = true;
      backdrop.classList.add('open');
      input.value = '';
      refresh();
      input.focus();
    },
    close(): void {
      open = false;
      backdrop.classList.remove('open');
      input.blur();
    },
    toggle(): void {
      if (open) api.close();
      else api.open();
    },
    isOpen(): boolean {
      return open;
    },
  };
  return api;
}
