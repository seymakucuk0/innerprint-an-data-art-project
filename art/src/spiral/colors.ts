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

function mixHex(a: string, b: string, t: number): string {
  return "#" + new Color(a).clone().lerp(new Color(b), clamp01(t)).getHexString();
}

function smoothstep(x: number): number {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

/**
 * Derive the upper anchor color from weather.
 *
 * - Sun shines through pale **sky-blue → warm gold** based on TEMPERATURE.
 *   A clear 7°C January morning reads icy-blue with a touch of warmth;
 *   a clear 24°C May afternoon reads full amber gold.
 * - SUN AMOUNT then blends that "sunny color" against an overcast
 *   grey-blue baseline.
 * - Rain → near-pure grey, deeper with rain mm.
 * - Snow → icy white-blue.
 *
 * All mixes are RGB lerp (Color.lerp) so we don't pass through green on
 * the way between cool-sky and warm-gold.
 */
// Vivid anchors. Sunny days punch yellow / sky-blue, overcast holds grey,
// heavy rain collapses to near-black storm, snow is bright ice.
const ANCHOR = {
  sunnyHot: "#F4C022",   // vivid saturated gold
  sunnyCool: "#5FB0E5",  // proper bright sky blue
  overcast: "#8A98A6",   // unsaturated cool grey
  rainLight: "#6E7177",  // mid stone grey
  rainHeavy: "#0E0F12",  // storm: near-black
  snowLight: "#E5F0F5",  // bright ice
  snowHeavy: "#7AB0CC",  // denser ice
} as const;

export function weatherAnchor(d: Day): string {
  const t = d.temp_mean_c ?? 14;
  const sun = d.sunshine_hours ?? 0;
  const rain = d.rain_mm ?? 0;
  const snow = d.snowfall_cm ?? 0;

  if (snow > 0.2) {
    return mixHex(ANCHOR.snowLight, ANCHOR.snowHeavy, snow / 4);
  }
  if (rain > 0.3) {
    return mixHex(ANCHOR.rainLight, ANCHOR.rainHeavy, rain / 12);
  }

  // No precipitation. Temperature picks where on the sky/gold ramp we sit;
  // sun amount then blends that into / out of the overcast baseline.
  const tNorm = clamp01((t - 5) / 20);          // 5°C cold → 25°C hot
  const sunnyColor = mixHex(ANCHOR.sunnyCool, ANCHOR.sunnyHot, tNorm);

  const sNorm = clamp01(sun / 11);              // 11h = fully sunny
  return mixHex(ANCHOR.overcast, sunnyColor, smoothstep(sNorm));
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
