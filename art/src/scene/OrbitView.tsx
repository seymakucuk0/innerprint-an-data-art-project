import { useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

type Props = { active: boolean };

export function OrbitView({ active }: Props) {
  const { camera } = useThree();

  useEffect(() => {
    if (!active) return;
    camera.position.set(0, 28, 32);
    camera.lookAt(0, 0, 0);
  }, [active, camera]);

  if (!active) return null;
  return (
    <OrbitControls
      enablePan={false}
      target={[0, 1, 0]}
      minDistance={10}
      maxDistance={80}
      autoRotate
      autoRotateSpeed={0.25}
      enableDamping
      dampingFactor={0.08}
    />
  );
}
