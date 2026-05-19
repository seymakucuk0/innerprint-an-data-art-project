import { Vector2 } from "three";

export type SpiralOptions = {
  turns: number;        // total revolutions
  outerRadius: number;  // outermost radius (day 0)
  innerRadius: number;  // central radius (last day)
  organicAmp: number;   // small radial wobble amplitude
  organicFreq: number;  // wobble frequency in radians
};

export const DEFAULT_SPIRAL: SpiralOptions = {
  turns: 5,
  outerRadius: 18,
  innerRadius: 2.5,
  organicAmp: 0.18,
  organicFreq: 7.0,
};

export const CORRIDOR_WIDTH = 2.0;   // base; later modulated by screen time
export const WALL_HEIGHT = 3.5;
export const FLOOR_INSET = 0.02;     // slight gap so floor doesn't z-fight

/**
 * For a normalized parameter t ∈ [0, 1], return the 2D center point on the
 * Archimedean spiral plus its tangent direction. t = 0 is the outermost
 * (oldest day); t = 1 is the centre (most recent day).
 */
export function spiralPoint(t: number, opt: SpiralOptions = DEFAULT_SPIRAL): {
  pos: Vector2;
  tangent: Vector2;
  radius: number;
  theta: number;
} {
  const { turns, outerRadius, innerRadius, organicAmp, organicFreq } = opt;
  const theta = t * turns * 2 * Math.PI;
  let radius = outerRadius + (innerRadius - outerRadius) * t;
  // a small organic wobble — looks like fingerprint ridges, not pure geometry
  radius += organicAmp * Math.sin(organicFreq * theta + 0.7);

  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);

  // analytic tangent of r(θ)·(cosθ, sinθ): (r'·cosθ − r·sinθ, r'·sinθ + r·cosθ)
  const dRadius_dTheta =
    ((innerRadius - outerRadius) / (turns * 2 * Math.PI)) +
    organicAmp * organicFreq * Math.cos(organicFreq * theta + 0.7);
  const tx = dRadius_dTheta * Math.cos(theta) - radius * Math.sin(theta);
  const ty = dRadius_dTheta * Math.sin(theta) + radius * Math.cos(theta);
  const tn = Math.hypot(tx, ty) || 1;

  return {
    pos: new Vector2(x, y),
    tangent: new Vector2(tx / tn, ty / tn),
    radius,
    theta,
  };
}

/**
 * Outward-facing normal to the spiral (perpendicular to tangent, pointing
 * radially outward).
 */
export function spiralNormal(t: number, opt: SpiralOptions = DEFAULT_SPIRAL): Vector2 {
  const { tangent } = spiralPoint(t, opt);
  // rotate -90° → outward facing for a CCW spiral
  return new Vector2(tangent.y, -tangent.x);
}
