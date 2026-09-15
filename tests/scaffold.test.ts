import { describe, expect, it } from 'vitest';
import { Engine } from '../src/core/engine';
import { CATALOG_SEED } from '../src/data/catalog';
import type { OrbitalElements } from '../src/sim/orbit';
import type { ShipState } from '../src/gameplay/ship';
import type { LlmProvider } from '../src/knowledge/provider';
import type { OverlayPanel } from '../src/ui/overlay';

describe('Step 1 — foundation scaffold', () => {
  it('boots the engine kernel stub', () => {
    const engine = new Engine();
    expect(engine.version).toContain('step1');
    expect(engine.updatables).toEqual([]);
  });

  it('ships a schema-valid catalog seed', () => {
    expect(CATALOG_SEED.length).toBeGreaterThanOrEqual(2);
    const ids = new Set<string>();
    for (const body of CATALOG_SEED) {
      expect(body.id, 'body id must be non-empty').toBeTruthy();
      expect(ids.has(body.id), `duplicate id ${body.id}`).toBe(false);
      ids.add(body.id);
      expect(body.radiusKm, `${body.id} radius must be positive`).toBeGreaterThan(0);
      expect(body.summary.length, `${body.id} needs a summary`).toBeGreaterThan(0);
    }
  });

  it('declares the layer contracts later steps build on', () => {
    const elements: OrbitalElements = {
      semiMajorAxisAu: 1,
      eccentricity: 0.0167,
      inclinationDeg: 0,
      periodDays: 365.256,
    };
    const ship: ShipState = { regime: 'orbital', speedMetersPerSecond: 0 };
    const panel: OverlayPanel = { show: () => undefined, hide: () => undefined };
    const provider: LlmProvider = { answer: async () => 'ok' };

    expect(elements.periodDays).toBeCloseTo(365.256, 3);
    expect(ship.regime).toBe('orbital');
    expect(panel).toBeTruthy();
    expect(provider).toBeTruthy();
  });
});
