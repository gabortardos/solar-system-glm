/**
 * UI layer — pure readout formatting for the HUD.
 * No DOM here so every helper is headless-testable.
 */

import type { Vec3 } from '../sim/vec';

/** Plain-string mirror of the render layer's ScaleMode (UI may not import render). */
export type SceneUnitsMode = 'compressed' | 'true';

/** Compass bearing of the nose in the scene frame: +Z = 0°, +X = 90°. */
export function headingDeg(forward: Vec3): number {
  const deg = (Math.atan2(forward.x, forward.z) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Nose elevation relative to the ecliptic plane, degrees (up = positive). */
export function pitchDeg(forward: Vec3): number {
  const len = Math.hypot(forward.x, forward.y, forward.z) || 1;
  return (Math.asin(Math.min(1, Math.max(-1, forward.y / len))) * 180) / Math.PI;
}

/** Bank angle: right wing below the ecliptic = positive (roll right). */
export function bankDeg(right: Vec3): number {
  const len = Math.hypot(right.x, right.y, right.z) || 1;
  return -(Math.asin(Math.min(1, Math.max(-1, right.y / len))) * 180) / Math.PI;
}

function trim(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/** Scene units are arbitrary in compressed mode but equal AU in true mode. */
export function formatSpeed(speed: number, mode: SceneUnitsMode): string {
  return `${trim(speed)} ${mode === 'true' ? 'AU/s' : 'u/s'}`;
}

export function formatDistance(units: number, mode: SceneUnitsMode): string {
  return `${trim(units)} ${mode === 'true' ? 'AU' : 'u'}`;
}

/** Human-friendly time-warp label: "1×", "10×", "1 min/s", "3.2 d/s", ... */
export function formatWarp(scale: number): string {
  if (scale < 60) return `${Math.round(scale)}×`;
  if (scale < 3_600) return `${nice(scale / 60)} min/s`;
  if (scale < 86_400) return `${nice(scale / 3_600)} h/s`;
  if (scale < 2_629_746) return `${nice(scale / 86_400)} d/s`;
  return `${nice(scale / 2_629_746)} mo/s`;
}

function nice(value: number): string {
  return value >= 10 ? `${Math.round(value)}` : value.toFixed(1);
}

/** "2026-09-15 19:42 UTC" */
export function formatDateUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Human label for a catalog kind. */
export function kindLabel(kind: string): string {
  switch (kind) {
    case 'star':
      return 'Star';
    case 'planet':
      return 'Planet';
    case 'dwarf-planet':
      return 'Dwarf planet';
    case 'moon':
      return 'Moon';
    case 'asteroid':
      return 'Asteroid';
    case 'comet':
      return 'Comet';
    case 'belt':
      return 'Belt';
    default:
      return kind;
  }
}

/** Orbital period: days below a year, years at/above it. */
export function formatPeriodDays(days: number): string {
  return days >= 365.25 ? `${(days / 365.25).toFixed(2)} yr` : `${days.toFixed(1)} d`;
}

/** Rotation period in hours, shown as days past 48h. */
export function formatRotationHours(hours: number): string {
  return Math.abs(hours) >= 48 ? `${(hours / 24).toFixed(1)} d` : `${hours.toFixed(1)} h`;
}

/** Mass in scientific notation: "5.97 × 10^24 kg". */
export function formatMassKg(kg: number): string {
  if (!(kg > 0)) return '—';
  const exponent = Math.floor(Math.log10(kg));
  const mantissa = kg / 10 ** exponent;
  return `${mantissa.toFixed(2)} × 10^${exponent} kg`;
}

/** Mean radius with thousands separators. */
export function formatRadiusKm(km: number | undefined): string {
  return km === undefined ? '—' : `${km.toLocaleString('en-US')} km`;
}
