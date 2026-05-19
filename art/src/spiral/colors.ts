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
 * Derive the upper "sky" anchor color from weather. Damonxart-style cool tops.
 * Cold → indigo, mild → blue, warm → teal. Rain mutes it; sun lifts it.
 */
export function weatherAnchor(d: Day): string {
  const t = d.temp_mean_c ?? 14;
  const sun = d.sunshine_hours ?? 6;
  const rain = d.rain_mm ?? 0;
  const snow = d.snowfall_cm ?? 0;

  // hue: 8°C → 265 (indigo), 28°C → 188 (teal)
  const hue = lerp(265, 188, clamp01((t - 8) / 20));

  // base saturation: rain/snow desaturate it
  const wet = clamp01(rain / 6 + snow / 4);
  const sat = lerp(0.55, 0.20, wet);

  // lightness rises with sunshine; falls if heavily wet
  let light = 0.28 + 0.08 * clamp01(sun / 12);
  light = lerp(light, light * 0.7, wet);

  return hslToHex(hue, sat, clamp01(light));
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
