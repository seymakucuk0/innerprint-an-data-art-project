import { useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  ShaderMaterial,
} from "three";
import type { Day } from "../types";
import { DEFAULT_SPIRAL, spiralPoint, spiralNormal } from "../spiral/path";
import { fillSignatureGaps, weatherAnchor } from "../spiral/colors";

type Props = { days: Day[] };

/**
 * The wall along the spiral path. For each day we build a small vertical
 * quad ('a slice'). Each slice carries:
 *   - bottom-anchor color (album signature)
 *   - top-anchor color (weather)
 *   - corridor width (eventually drives geometry; v0 keeps width constant)
 * Vertices store two colors; a tiny shader linearly interpolates them
 * along Y to form Damonxart-style smooth verticals, and the slices share
 * vertices along X so day-N → day-N+1 also blends (no hard seams).
 */
export function SpiralWall({ days }: Props) {
  const { geometry, material } = useMemo(() => buildSpiralWall(days), [days]);
  return (
    <mesh geometry={geometry} material={material} castShadow={false} receiveShadow={false} />
  );
}

function buildSpiralWall(days: Day[]) {
  const N = days.length;
  const wallHeight = 4.2;
  // smooth-filled bottom anchors (per day)
  const bottomHex = fillSignatureGaps(days);
  const topHex = days.map((d) => weatherAnchor(d));

  // 2 vertices per day (bottom + top) — share between adjacent days for smooth blend
  const positions = new Float32Array(N * 2 * 3);
  const bottomColors = new Float32Array(N * 2 * 3);
  const topColors = new Float32Array(N * 2 * 3);
  const ys = new Float32Array(N * 2); // 0 (bottom) or 1 (top) used by shader

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const { pos } = spiralPoint(t, DEFAULT_SPIRAL);

    const bot = new Color(bottomHex[i]);
    const top = new Color(topHex[i]);

    // bottom vertex
    const bi = i * 2;
    positions[bi * 3 + 0] = pos.x;
    positions[bi * 3 + 1] = 0;
    positions[bi * 3 + 2] = pos.y;
    bottomColors[bi * 3 + 0] = bot.r;
    bottomColors[bi * 3 + 1] = bot.g;
    bottomColors[bi * 3 + 2] = bot.b;
    topColors[bi * 3 + 0] = top.r;
    topColors[bi * 3 + 1] = top.g;
    topColors[bi * 3 + 2] = top.b;
    ys[bi] = 0;

    // top vertex
    const ti = i * 2 + 1;
    positions[ti * 3 + 0] = pos.x;
    positions[ti * 3 + 1] = wallHeight;
    positions[ti * 3 + 2] = pos.y;
    bottomColors[ti * 3 + 0] = bot.r;
    bottomColors[ti * 3 + 1] = bot.g;
    bottomColors[ti * 3 + 2] = bot.b;
    topColors[ti * 3 + 0] = top.r;
    topColors[ti * 3 + 1] = top.g;
    topColors[ti * 3 + 2] = top.b;
    ys[ti] = 1;
  }

  // triangles between consecutive days
  const indices: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    // two-sided handled by material side=DoubleSide
    indices.push(a, b, c);
    indices.push(b, d, c);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aBottom", new BufferAttribute(bottomColors, 3));
  geometry.setAttribute("aTop", new BufferAttribute(topColors, 3));
  geometry.setAttribute("aY", new BufferAttribute(ys, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new ShaderMaterial({
    side: DoubleSide,
    transparent: false,
    vertexShader: /* glsl */ `
      attribute vec3 aBottom;
      attribute vec3 aTop;
      attribute float aY;
      varying vec3 vBottom;
      varying vec3 vTop;
      varying float vY;
      void main() {
        vBottom = aBottom;
        vTop = aTop;
        vY = aY;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vBottom;
      varying vec3 vTop;
      varying float vY;
      // ease curve so the gradient breathes near the middle rather than
      // looking like a pure linear strip
      float ease(float x) {
        return smoothstep(0.0, 1.0, x);
      }
      void main() {
        float t = ease(vY);
        vec3 col = mix(vBottom, vTop, t);
        // emissive feel — slight tonemap so colors stay rich at low light
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  return { geometry, material };
}
