import { useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  ShaderMaterial,
} from "three";
import type { Day } from "../types";
import {
  CORRIDOR_WIDTH,
  DEFAULT_SPIRAL,
  WALL_HEIGHT,
  spiralNormal,
  spiralPoint,
} from "../spiral/path";
import { fillSignatureGaps, weatherAnchor } from "../spiral/colors";

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

  return (
    <group>
      <mesh geometry={built.outerWall} material={built.wallMaterial} />
      <mesh geometry={built.innerWall} material={built.wallMaterial} />
      <mesh geometry={built.floor} material={built.floorMaterial} />
    </group>
  );
}

function buildCorridor(days: Day[]) {
  const N = days.length;
  const halfW = CORRIDOR_WIDTH / 2;
  const bottomHex = fillSignatureGaps(days);
  const topHex = days.map((d) => weatherAnchor(d));

  const outerPos = new Float32Array(N * 2 * 3);
  const innerPos = new Float32Array(N * 2 * 3);
  const floorPos = new Float32Array(N * 2 * 3);

  const bottomColors = new Float32Array(N * 2 * 3);
  const topColors = new Float32Array(N * 2 * 3);
  const ys = new Float32Array(N * 2);

  // floor attributes (only one vertical, so just bottom anchor reused for "color")
  const floorColors = new Float32Array(N * 2 * 3);
  const floorBright = new Float32Array(N * 2); // 0..1, set by step count

  const stepsArr = days.map((d) => d.steps ?? 0);
  const stepsMax = Math.max(1, ...stepsArr);

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const { pos } = spiralPoint(t, DEFAULT_SPIRAL);
    const n = spiralNormal(t, DEFAULT_SPIRAL);

    const ox = pos.x + n.x * halfW;
    const oz = pos.y + n.y * halfW;
    const ix = pos.x - n.x * halfW;
    const iz = pos.y - n.y * halfW;

    // outer wall: bottom then top
    outerPos[i * 6 + 0] = ox;
    outerPos[i * 6 + 1] = 0;
    outerPos[i * 6 + 2] = oz;
    outerPos[i * 6 + 3] = ox;
    outerPos[i * 6 + 4] = WALL_HEIGHT;
    outerPos[i * 6 + 5] = oz;

    // inner wall: bottom then top
    innerPos[i * 6 + 0] = ix;
    innerPos[i * 6 + 1] = 0;
    innerPos[i * 6 + 2] = iz;
    innerPos[i * 6 + 3] = ix;
    innerPos[i * 6 + 4] = WALL_HEIGHT;
    innerPos[i * 6 + 5] = iz;

    // floor: outer edge then inner edge (at y = 0.001 to avoid z-fight)
    floorPos[i * 6 + 0] = ox;
    floorPos[i * 6 + 1] = 0.001;
    floorPos[i * 6 + 2] = oz;
    floorPos[i * 6 + 3] = ix;
    floorPos[i * 6 + 4] = 0.001;
    floorPos[i * 6 + 5] = iz;

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

  const wallMaterial = new ShaderMaterial({
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
      void main() {
        float t = smoothstep(0.0, 1.0, vY);
        // slight luminance lift at the very bottom and top so the gradient feels
        // glowy rather than flat — Damonxart "frozen light" hint
        float lift = 1.0 + 0.05 * (1.0 - 4.0 * vY * (1.0 - vY));
        vec3 col = mix(vBottom, vTop, t) * lift;
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

  return {
    outerWall: makeWall(outerPos),
    innerWall: makeWall(innerPos),
    floor: floorGeom,
    wallMaterial,
    floorMaterial,
  };
}
