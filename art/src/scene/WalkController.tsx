import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { DEFAULT_SPIRAL, spiralPoint } from "../spiral/path";

type Props = {
  active: boolean;
  dayCount: number;
  onDayChange: (dayIndex: number) => void;
  gotoRef: React.MutableRefObject<number | null>;
};

/**
 * Keyboard-driven walk along the spiral path.
 *
 * Forward / back along the spiral (Up + Down, or W + S). Mouse-free; the
 * camera always looks down the tangent. Left / Right (or A / D) rotate the
 * view slightly so you can glance at the wall on either side without
 * leaving the spiral parameter.
 *
 * Position is parameterised by s ∈ [0, 1]: s = 0 is the outermost loop
 * (2025-08-26); s = 1 is the centre (yesterday). One press of Up moves
 * you a fraction further into your own year.
 */
export function WalkController({ active, dayCount, onDayChange, gotoRef }: Props) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const s = useRef(0.0);
  const velocity = useRef(0); // smooth acceleration along spiral
  const heading = useRef(0); // small look-direction offset in radians
  const lastDay = useRef(-1);
  const tmp = useRef(new Vector3());
  const tmpLook = useRef(new Vector3());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // when entering walk mode, snap to spiral entrance
  useEffect(() => {
    if (!active) return;
    s.current = 0.001;
    velocity.current = 0;
    heading.current = 0;
    placeCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function placeCamera() {
    const { pos, tangent } = spiralPoint(s.current, DEFAULT_SPIRAL);
    // tangent at s=0 already points "into" the spiral as we increase s
    const px = pos.x;
    const pz = pos.y;
    camera.position.set(px, 1.62, pz);
    const lookX = px + Math.cos(heading.current) * tangent.x - Math.sin(heading.current) * tangent.y;
    const lookZ = pz + Math.sin(heading.current) * tangent.x + Math.cos(heading.current) * tangent.y;
    tmpLook.current.set(lookX, 1.62, lookZ);
    camera.lookAt(tmpLook.current);
  }

  useFrame((_, delta) => {
    if (!active) return;
    const k = keys.current;

    // If a jump target is pending, ease toward it and ignore manual input
    // until we arrive. ~1.4 s of half-life so even long jumps feel calm.
    const target = gotoRef.current;
    if (target !== null) {
      const diff = target - s.current;
      if (Math.abs(diff) < 0.0005) {
        s.current = target;
        gotoRef.current = null;
        velocity.current = 0;
      } else {
        s.current += diff * (1 - Math.pow(0.18, delta));
      }
      placeCamera();
      const dayIdx = Math.min(dayCount - 1, Math.floor(s.current * (dayCount - 1)));
      if (dayIdx !== lastDay.current) {
        lastDay.current = dayIdx;
        onDayChange(dayIdx);
      }
      return;
    }

    const fwd = (k["arrowup"] ? 1 : 0) + (k["w"] ? 1 : 0);
    const back = (k["arrowdown"] ? 1 : 0) + (k["s"] ? 1 : 0);
    const left = (k["arrowleft"] ? 1 : 0) + (k["a"] ? 1 : 0);
    const right = (k["arrowright"] ? 1 : 0) + (k["d"] ? 1 : 0);

    // step rate: ~one day per 0.6s when held → traverse 266 days in ~160s
    const accel = (fwd - back) * 0.7;     // s-units / sec²
    velocity.current += accel * delta;
    velocity.current *= Math.pow(0.06, delta); // damping
    s.current += velocity.current * delta * 0.012;
    s.current = Math.max(0, Math.min(0.9999, s.current));

    // heading rotates with left/right; clamped so you can't fully turn around
    heading.current += (right - left) * delta * 0.9;
    heading.current = Math.max(-0.9, Math.min(0.9, heading.current));
    // gentle return-to-center when no input
    if (!left && !right) heading.current *= Math.pow(0.4, delta);

    placeCamera();

    const dayIdx = Math.min(dayCount - 1, Math.floor(s.current * (dayCount - 1)));
    if (dayIdx !== lastDay.current) {
      lastDay.current = dayIdx;
      onDayChange(dayIdx);
    }
  });

  return null;
}
