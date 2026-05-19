import { Canvas } from "@react-three/fiber";
import { Scene } from "./scene/Scene";

export function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 14, 22], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>
      <header
        style={{
          position: "absolute",
          left: 24,
          top: 20,
          letterSpacing: 1.3,
          fontSize: 12,
          opacity: 0.6,
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        innerprint — the spiral within
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, letterSpacing: 0.6 }}>
          2025-08-26 → 2026-05-18 · 266 days
        </div>
      </header>
    </div>
  );
}
