import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture guard: mechanically enforces "visualization ⟂ data" layering.
 * If anyone adds an illegal cross-layer import, this suite fails the validation gate.
 */

const SRC = resolve(process.cwd(), 'src');

/** Layer -> project layers it is allowed to import. */
const ALLOWED: Record<string, string[]> = {
  core: [],
  data: [],
  sim: ['core', 'data'],
  render: ['core', 'data', 'sim'],
  gameplay: ['core', 'data', 'sim'],
  knowledge: ['core', 'data'],
  ui: ['core', 'data', 'sim', 'knowledge'],
};

const LAYERS = Object.keys(ALLOWED);

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function layerOf(file: string): string | null {
  const top = relative(SRC, file).split(/[\\/]/)[0]!;
  return LAYERS.includes(top) ? top : null;
}

function importsOf(source: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)from\s+['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(re)) specs.push(m[1]!);
  return specs;
}

function targetLayerOf(fromFile: string, spec: string): string | null {
  const target = relative(SRC, resolve(fromFile, '..', spec)).split(/[\\/]/)[0]!;
  return LAYERS.includes(target) ? target : null;
}

describe('architecture — visualization ⟂ data separation', () => {
  const files = listTsFiles(SRC);

  it('source tree exists with all seven declared layers', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const layer of LAYERS) {
      expect(
        files.some((f) => layerOf(f) === layer),
        `layer "${layer}" must exist in src/`,
      ).toBe(true);
    }
  });

  for (const file of files) {
    const layer = layerOf(file);
    if (layer === null) continue; // composition root (main.ts) is exempt
    const rel = relative(process.cwd(), file);
    const specs = importsOf(readFileSync(file, 'utf8'));

    it(`${rel} respects layer boundaries`, () => {
      for (const spec of specs) {
        if (spec.startsWith('.')) {
          const target = targetLayerOf(file, spec);
          // Intra-layer imports (core -> core, render -> render, ...) are always allowed.
          if (target !== null && target !== layer) {
            expect(
              ALLOWED[layer]!,
              `${rel} (layer "${layer}") must not import layer "${target}"`,
            ).toContain(target);
          }
        } else if (spec === 'three') {
          expect(
            layer,
            `${rel} may not import three — only the render layer may`,
          ).toBe('render');
        }
      }
    });
  }
});

describe('composition root — the render loop must draw', () => {
  // Regression pin for the black-screen pivot bug: the engine ticks frames, but
  // only an explicit scene.render() inside the registered renderer puts pixels
  // on the canvas. If this ever disappears again, the app boots to blackness.
  const mainSrc = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');

  it('main.ts draws every frame via scene.render()', () => {
    expect(mainSrc, 'render loop must call scene.render()').toMatch(
      /\bscene\.render\(\)/,
    );
  });

  it('main.ts sizes the renderer before the first frame', () => {
    expect(mainSrc, 'boot must call scene.resize()').toMatch(/\bscene\.resize\(\)/);
  });
});
