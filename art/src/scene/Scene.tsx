import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useInnerprintData } from "../data/useInnerprintData";
import { SpiralWall } from "./SpiralWall";

export function Scene() {
  const { data, error } = useInnerprintData();

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="red" />
      </mesh>
    );
  }
  if (!data) return null;

  return (
    <Suspense fallback={null}>
      <color attach="background" args={["#0a0512"]} />
      <fog attach="fog" args={["#0a0512", 18, 60]} />
      <ambientLight intensity={0.15} />
      <hemisphereLight args={["#2a3568", "#1a0820", 0.3]} />

      <SpiralWall days={data.days} />

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={45}
        autoRotate
        autoRotateSpeed={0.35}
      />

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.2} luminanceSmoothing={0.4} />
      </EffectComposer>
    </Suspense>
  );
}
