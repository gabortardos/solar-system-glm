/**
 * UI layer — time-warp selection logic (pure).
 * The user-facing "natural movement speed of the solar system" setting:
 * a preset ladder plus a logarithmic slider mapping, both clamped to the
 * kernel's [1×, 1,000,000×] range.
 */

export const MIN_WARP = 1;
export const MAX_WARP = 1_000_000;

/** 1×, 10×, 1 min/s, 10 min/s, 1 h/s, 6 h/s, 1 d/s, 1 wk/s, ~11.6 d/s. */
export const WARP_LADDER: readonly number[] = [
  1, 10, 60, 600, 3_600, 21_600, 86_400, 604_800, 1_000_000,
];

/** Step to the next (direction = +1) or previous (direction = -1) rung; clamps at the ends. */
export function nextWarp(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    for (const rung of WARP_LADDER) {
      if (rung > current + 1e-9) return rung;
    }
    return MAX_WARP;
  }
  for (let i = WARP_LADDER.length - 1; i >= 0; i--) {
    const rung = WARP_LADDER[i]!;
    if (rung < current - 1e-9) return rung;
  }
  return MIN_WARP;
}

const SLIDER_MAX = 1_000;

/** Warp factor -> slider position 0..1000 (log10 scale over six decades). */
export function warpToSlider(warp: number): number {
  const clamped = Math.min(MAX_WARP, Math.max(MIN_WARP, warp));
  return Math.round((Math.log10(clamped) / 6) * SLIDER_MAX);
}

/** Slider position 0..1000 -> warp factor (exponent steps whole decades). */
export function sliderToWarp(slider: number): number {
  const t = Math.min(SLIDER_MAX, Math.max(0, slider)) / SLIDER_MAX;
  return Math.round(10 ** (t * 6));
}
