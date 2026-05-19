import { Color } from "three";
import type { Day } from "../types";

export function hexToColor(hex: string | null | undefined, fallback = "#3a2240"): Color {
  return new Color(hex ?? fallback);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hslToHex(h: number, s: number, l: number): string {
  // h in [0, 360], s/l in [0, 1]
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h / 60) % 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) => Math.round(255 * (v + m)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Derive the upper anchor color from weather. Direct, literal mapping
 * agreed with the user: sun → yellow/amber, rain → grey (deeper with
 * amount), snow → ice white-blue, overcast no-rain → cool grey-blue,
 * partly cloudy → smooth blend between the sunny and overcast ends.
 *
 * No discrete tiers — every input is folded through smooth interpolations
 * so adjacent days never produce a hard step.
 */
export function weatherAnchor(d: Day): string {
  const t = d.temp_mean_c ?? 14;
  const sun = d.sunshine_hours ?? 0;
  const rain = d.rain_mm ?? 0;
  const snow = d.snowfall_cm ?? 0;

  // Snow path: icy white-blue. Lighter the less snow there is.
  if (snow > 0.2) {
    const sNorm = clamp01(snow / 4);
    const hue = 200;
    const sat = lerp(0.20, 0.32, sNorm);
    const light = lerp(0.80, 0.60, sNorm);
    return hslToHex(hue, sat, light);
  }

  // Rain path: near-pure grey, deeper grey with more rain. A faint cool
  // tilt (hue 220) keeps the grey from looking dead — still atmospheric.
  if (rain > 0.3) {
    const rNorm = clamp01(rain / 12);
    const hue = 220;
    const sat = lerp(0.05, 0.02, rNorm);
    const light = lerp(0.60, 0.28, rNorm);
    return hslToHex(hue, sat, light);
  }

  // No precipitation. Sunshine drives a smooth yellow ↔ grey-blue blend.
  // sunshine_hours: 0..14 typical; 11 ~= "very sunny day".
  const sNorm = clamp01(sun / 11);

  if (sNorm >= 0.62) {
    // sunny zone — golden amber, hotter day shifts toward warmer gold
    const k = (sNorm - 0.62) / 0.38; // 0..1 within zone
    const hue = lerp(52, 42, clamp01((t - 8) / 20));
    const sat = lerp(0.55, 0.78, k);
    const light = lerp(0.55, 0.66, k);
    return hslToHex(hue, sat, light);
  }

  if (sNorm <= 0.22) {
    // overcast (no rain, no sun) — cool pale grey-blue, breathable
    const k = sNorm / 0.22;
    const hue = 222;
    const sat = lerp(0.06, 0.09, k);
    const light = lerp(0.52, 0.58, k);
    return hslToHex(hue, sat, light);
  }

  // partly cloudy / variable — smooth blend between overcast and sunny
  const k = (sNorm - 0.22) / 0.40;
  // hue glides from cool grey-blue (222) to warm gold (52)
  const hue = lerp(222, 52, k);
  const sat = lerp(0.09, 0.55, k);
  const light = lerp(0.58, 0.55, k);
  return hslToHex(hue, sat, light);
}

/**
 * Lerp-fill missing album signature colors so the spiral never has a void.
 * Walks forward and backward to find the nearest valid hex on each side
 * and blends by distance.
 */
export function fillSignatureGaps(days: Day[]): string[] {
  const n = days.length;
  const out: string[] = new Array(n);
  const before: (number | null)[] = new Array(n).fill(null);
  const after: (number | null)[] = new Array(n).fill(null);

  let last: number | null = null;
  for (let i = 0; i < n; i++) {
    if (days[i].album_signature_hex) last = i;
    before[i] = last;
  }
  last = null;
  for (let i = n - 1; i >= 0; i--) {
    if (days[i].album_signature_hex) last = i;
    after[i] = last;
  }

  for (let i = 0; i < n; i++) {
    if (days[i].album_signature_hex) {
      out[i] = days[i].album_signature_hex!;
      continue;
    }
    const b = before[i];
    const a = after[i];
    if (b !== null && a !== null) {
      const t = (i - b) / (a - b);
      const c1 = new Color(days[b].album_signature_hex!);
      const c2 = new Color(days[a].album_signature_hex!);
      out[i] = "#" + c1.clone().lerp(c2, t).getHexString();
    } else if (b !== null) {
      out[i] = days[b].album_signature_hex!;
    } else if (a !== null) {
      out[i] = days[a].album_signature_hex!;
    } else {
      out[i] = "#3a2240";
    }
  }
  return out;
}
