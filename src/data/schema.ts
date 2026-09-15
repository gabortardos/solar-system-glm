/**
 * Pure data layer — celestial catalog schema.
 * RULE: no imports from any other layer; no rendering concepts ever appear here.
 */

export type CelestialKind =
  | 'star'
  | 'planet'
  | 'dwarf-planet'
  | 'moon'
  | 'asteroid'
  | 'comet'
  | 'belt';

/** Keplerian elements for one body's orbit around its parent. Approximate J2000 values. */
export interface OrbitRecord {
  readonly semiMajorAxisAu: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly periodDays: number;
  /** Mean anomaly at epoch, degrees. Optional (defaults to 0 in propagation). */
  readonly meanAnomalyDegAtEpoch?: number;
  readonly longitudeOfAscendingNodeDeg?: number;
  readonly argumentOfPeriapsisDeg?: number;
}

/** Statistical description for belt regions (no single orbit). */
export interface BeltRecord {
  readonly innerRadiusAu: number;
  readonly outerRadiusAu: number;
  readonly estimatedObjects: number;
}

export interface CelestialBodyRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: CelestialKind;
  /** Parent body id (a moon's planet, a planet's star); null only for the Sun. */
  readonly parentId: string | null;
  /** Mean radius, kilometres. Required for all kinds except 'belt'. */
  readonly radiusKm?: number;
  readonly summary: string;
  readonly facts: readonly string[];
  /** Base tint for procedural rendering. */
  readonly colorHex: string;
  readonly orbit?: OrbitRecord;
  readonly belt?: BeltRecord;
  /** Sidereal rotation; negative values mark retrograde spin. */
  readonly rotationPeriodHours?: number;
  readonly massKg?: number;
}
