import { describe, expect, it } from 'vitest';
import { Engine } from '../src/core/engine';
import { CELESTIAL_CATALOG, validateCatalog } from '../src/data/catalog';
import type { OrbitalElements } from '../src/sim/orbit';
import type { ShipState } from '../src/gameplay/ship';
import type { LlmProvider } from '../src/knowledge/provider';
import type { OverlayPanel } from '../src/ui/overlay';

describe('Step 1 — foundation scaffold', () => {
  it('boots the engine kernel', () => {
    const engine = new Engine();
    expect(engine.version).toContain('step2');
    expect(engine.events).toBeTruthy();
    expect(engine.time).toBeTruthy();
    expect(engine.loop).toBeTruthy();
    expect(engine.services).toBeTruthy();
  });

  it('ships a schema-valid full catalog', () => {
    expect(CELESTIAL_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(validateCatalog(CELESTIAL_CATALOG)).toEqual([]);
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
