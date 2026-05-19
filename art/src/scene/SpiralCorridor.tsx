import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  ShaderMaterial,
} from "three";
import type { Day } from "../types";
import { DEFAULT_SPIRAL, spiralNormal, spiralPoint } from "../spiral/path";
import { fillSignatureGaps, weatherAnchor } from "../spiral/colors";

// Screen time → corridor width + wall height.
//
// Intent (matches the user-locked mapping): heavy-screen days compress
// you — narrow corridor, tall walls. Light-screen days open up. Below
// HALF_WIDTH_MIN the corridor would stop being walkable, so we clamp.
const SCREEN_NORM_MIN = 90;     // ≈ 1.5 h  → fully open
const SCREEN_NORM_MAX = 840;    // ≈ 14 h   → fully compressed
const HALF_WIDTH_OPEN = 1.60;   // 3.20 m corridor (open day)
const HALF_WIDTH_TIGHT = 0.46;  // 0.92 m corridor (single-file, claustrophobic)
const WALL_H_OPEN = 2.8;
const WALL_H_TIGHT = 4.9;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function screenIntensity(min: number | null): number {
  const v = min ?? SCREEN_NORM_MIN;
  return clamp01((v - SCREEN_NORM_MIN) / (SCREEN_NORM_MAX - SCREEN_NORM_MIN));
}

function smoothSeries(values: number[], radius = 1): number[] {
  const n = values.length;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      sum += values[j];
      count += 1;
    }
    out[i] = sum / count;
  }
  return out;
}

type Props = { days: Day[] };

/**
 * Two-walled spiral corridor + floor strip between them.
 *
 * For each day we sample the spiral path at one position and store:
 *   center point + outward normal + bottom anchor (album) + top anchor (weather).
 * The two walls are extruded perpendicular to the path at ±halfWidth.
 * Both walls share the same vertical gradient shader so a fan inside the
 * corridor sees matching colors on either side.
 */
export function SpiralCorridor({ days }: Props) {
  const built = useMemo(() => buildCorridor(days), [days]);
  const t0 = useRef(performance.now() / 1000);

  // Drive the wall shader's uTime every frame so the screen-time flicker
  // amplitude can do its high-freq shimmer per-segment.
  useFrame(() => {
    const t = performance.now() / 1000 - t0.current;
    built.wallMaterial.uniforms.uTime.value = t;
  });

  return (
    <group>
      <mesh geometry={built.outerWall} material={built.wallMaterial} />
      <mesh geometry={built.innerWall} material={built.wallMaterial} />
      <mesh geometry={built.floor} material={built.floorMaterial} />
      <mesh geometry={built.ceiling} material={built.ceilingMaterial} />
    </group>
  );
}

function buildCorridor(days: Day[]) {
  const N = days.length;

  // Per-day intensity (screen time), smoothed so jagged day-to-day swings
  // don't crash the corridor open/closed.
  const intensityRaw = days.map((d) => screenIntensity(d.screen_total_min));
  const intensity = smoothSeries(intensityRaw, 1);

  // Step modifier: ±10% on top of the screen-time-driven width. High-step
  // days widen slightly (the body was out in the world); low-step days
  // narrow slightly (the body stayed put). Smoothed the same way.
  const STEP_NORM = 12000; // ~12k = active student day
  const stepRaw = days.map((d) =>
    clamp01((d.steps ?? 0) / STEP_NORM),
  );
  const stepNorm = smoothSeries(stepRaw, 1);

  const halfWidths = intensity.map((x, i) => {
    const base = lerp(HALF_WIDTH_OPEN, HALF_WIDTH_TIGHT, x);
    const stepMod = lerp(0.90, 1.10, stepNorm[i]);
    return Math.max(0.42, base * stepMod);
  });
  const wallHeights = intensity.map((x) => lerp(WALL_H_OPEN, WALL_H_TIGHT, x));

  const bottomHex = fillSignatureGaps(days);
  const topHex = days.map((d) => weatherAnchor(d));

  const outerPos = new Float32Array(N * 2 * 3);
  const innerPos = new Float32Array(N * 2 * 3);
  const floorPos = new Float32Array(N * 2 * 3);
  const ceilingPos = new Float32Array(N * 2 * 3);

  const bottomColors = new Float32Array(N * 2 * 3);
  const topColors = new Float32Array(N * 2 * 3);
  const ys = new Float32Array(N * 2);
  const screenIntensities = new Float32Array(N * 2);  // per-vertex 0..1 flicker driver

  // floor attributes (only one vertical, so just bottom anchor reused for "color")
  const floorColors = new Float32Array(N * 2 * 3);
  const floorBright = new Float32Array(N * 2); // 0..1, set by step count

  // ceiling carries the top anchor (weather) — looking up is looking at sky
  const ceilingColors = new Float32Array(N * 2 * 3);

  const stepsArr = days.map((d) => d.steps ?? 0);
  const stepsMax = Math.max(1, ...stepsArr);

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const { pos } = spiralPoint(t, DEFAULT_SPIRAL);
    const n = spiralNormal(t, DEFAULT_SPIRAL);

    const halfW = halfWidths[i];
    const wallH = wallHeights[i];

    const ox = pos.x + n.x * halfW;
    const oz = pos.y + n.y * halfW;
    const ix = pos.x - n.x * halfW;
    const iz = pos.y - n.y * halfW;

    // outer wall: bottom then top
    outerPos[i * 6 + 0] = ox;
    outerPos[i * 6 + 1] = 0;
    outerPos[i * 6 + 2] = oz;
    outerPos[i * 6 + 3] = ox;
    outerPos[i * 6 + 4] = wallH;
    outerPos[i * 6 + 5] = oz;

    // inner wall: bottom then top
    innerPos[i * 6 + 0] = ix;
    innerPos[i * 6 + 1] = 0;
    innerPos[i * 6 + 2] = iz;
    innerPos[i * 6 + 3] = ix;
    innerPos[i * 6 + 4] = wallH;
    innerPos[i * 6 + 5] = iz;

    // floor: outer edge then inner edge (at y = 0.001 to avoid z-fight)
    floorPos[i * 6 + 0] = ox;
    floorPos[i * 6 + 1] = 0.001;
    floorPos[i * 6 + 2] = oz;
    floorPos[i * 6 + 3] = ix;
    floorPos[i * 6 + 4] = 0.001;
    floorPos[i * 6 + 5] = iz;

    // ceiling: same XZ but at the wall top (slightly under to avoid z-fight)
    ceilingPos[i * 6 + 0] = ox;
    ceilingPos[i * 6 + 1] = wallH - 0.001;
    ceilingPos[i * 6 + 2] = oz;
    ceilingPos[i * 6 + 3] = ix;
    ceilingPos[i * 6 + 4] = wallH - 0.001;
    ceilingPos[i * 6 + 5] = iz;

    const bot = new Color(bottomHex[i]);
    const top = new Color(topHex[i]);
    const stepNorm = Math.pow(stepsArr[i] / stepsMax, 0.7); // ease emphasis

    for (let v = 0; v < 2; v++) {
      const idx = (i * 2 + v) * 3;
      bottomColors[idx + 0] = bot.r;
      bottomColors[idx + 1] = bot.g;
      bottomColors[idx + 2] = bot.b;
      topColors[idx + 0] = top.r;
      topColors[idx + 1] = top.g;
      topColors[idx + 2] = top.b;
      ys[i * 2 + v] = v; // 0 bottom, 1 top
      floorColors[idx + 0] = bot.r;
      floorColors[idx + 1] = bot.g;
      floorColors[idx + 2] = bot.b;
      floorBright[i * 2 + v] = stepNorm;
      ceilingColors[idx + 0] = top.r;
      ceilingColors[idx + 1] = top.g;
      ceilingColors[idx + 2] = top.b;
      screenIntensities[i * 2 + v] = intensity[i]; // smoothed 0..1
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }

  function makeWall(positions: Float32Array): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("aBottom", new BufferAttribute(bottomColors, 3));
    g.setAttribute("aTop", new BufferAttribute(topColors, 3));
    g.setAttribute("aY", new BufferAttribute(ys, 1));
    g.setAttribute("aScreen", new BufferAttribute(screenIntensities, 1));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  // floor is a flat strip; reuse position-only indices
  const floorGeom = new BufferGeometry();
  floorGeom.setAttribute("position", new BufferAttribute(floorPos, 3));
  floorGeom.setAttribute("aColor", new BufferAttribute(floorColors, 3));
  floorGeom.setAttribute("aBright", new BufferAttribute(floorBright, 1));
  floorGeom.setIndex(indices);
  floorGeom.computeVertexNormals();

  const ceilingGeom = new BufferGeometry();
  ceilingGeom.setAttribute("position", new BufferAttribute(ceilingPos, 3));
  ceilingGeom.setAttribute("aColor", new BufferAttribute(ceilingColors, 3));
  ceilingGeom.setIndex(indices);
  ceilingGeom.computeVertexNormals();

  const wallMaterial = new ShaderMaterial({
    side: DoubleSide,
    transparent: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aBottom;
      attribute vec3 aTop;
      attribute float aY;
      attribute float aScreen;
      varying vec3 vBottom;
      varying vec3 vTop;
      varying float vY;
      varying float vScreen;
      varying vec3 vWorld;
      void main() {
        vBottom = aBottom;
        vTop = aTop;
        vY = aY;
        vScreen = aScreen;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      varying vec3 vBottom;
      varying vec3 vTop;
      varying float vY;
      varying float vScreen;
      varying vec3 vWorld;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        float seed = vWorld.x * 0.18 + vWorld.z * 0.14;
        float freedom = 1.0 - vScreen;

        // Gradient with gentle breathing on light-screen days.
        float breathe = sin(uTime * 0.45 + seed * 1.3) * 0.08 * freedom;
        float tt = smoothstep(0.0, 1.0, clamp(vY + breathe, 0.0, 1.0));
        vec3 col = mix(vBottom, vTop, tt);

        // Static lift across the wall middle.
        float lift = 1.0 + 0.05 * (1.0 - 4.0 * vY * (1.0 - vY));

        // Soft luminance flow on light days, dies on heavy ones.
        float w1 = sin(uTime * 0.85 + seed * 1.7 + vY * 3.0);
        float w2 = sin(uTime * 0.42 + seed * 0.7 - vY * 1.4);
        float flow = 1.0 + (w1 + w2) * 0.5 * (0.03 + 0.10 * freedom);

        col *= lift * flow;

        // ── Heavy-screen darkening + glitch ─────────────────────────────
        // 'heavy' kicks in past mid-intensity and ramps to 1 at peak.
        float heavy = smoothstep(0.50, 1.00, vScreen);

        // Two-band hash desync — anxious, electrical.
        float hSeed = floor(vWorld.x * 1.6) + floor(vWorld.z * 1.6) * 19.0;
        float gFast = hash(vec2(hSeed,           floor(uTime * 28.0)));
        float gSlow = hash(vec2(hSeed * 0.4,     floor(uTime * 7.0)));
        float glitch = mix(gFast, gSlow, 0.6);

        // Constant dimming + jittery dimming on heavy days (~20% softer
        // than the first pass).
        float dim    = 1.0 - heavy * 0.44;
        float jitter = 1.0 + heavy * 0.32 * (glitch - 0.5) * 2.0;
        col *= dim * jitter;

        // Occasional darker bursts — random patches drop further.
        float burst = hash(vec2(hSeed * 0.18, floor(uTime * 2.3)));
        float blackout = smoothstep(0.92, 1.00, burst) * heavy;
        col *= 1.0 - blackout * 0.56;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const floorMaterial = new ShaderMaterial({
    side: DoubleSide,
    transparent: false,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aBright;
      varying vec3 vColor;
      varying float vBright;
      void main() {
        vColor = aColor;
        vBright = aBright;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      varying float vBright;
      void main() {
        // floor is mostly dark plum; the album color glows up only when many
        // steps were taken that day. Low-step days stay near-black so the
        // corridor reads as a pool of light under foot only on lively days.
        vec3 base = vec3(0.03, 0.02, 0.05);
        vec3 col = base + vColor * (0.18 + 1.1 * vBright);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const ceilingMaterial = new ShaderMaterial({
    side: DoubleSide,
    transparent: false,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      void main() {
        // Ceiling = sky. Emit the top anchor a touch brighter so it reads
        // as a glowing canopy rather than a flat panel.
        gl_FragColor = vec4(vColor * 1.12, 1.0);
      }
    `,
  });

  return {
    outerWall: makeWall(outerPos),
    innerWall: makeWall(innerPos),
    floor: floorGeom,
    ceiling: ceilingGeom,
    wallMaterial,
    floorMaterial,
    ceilingMaterial,
  };
}
