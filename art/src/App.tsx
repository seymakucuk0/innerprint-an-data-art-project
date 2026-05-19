import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./scene/Scene";
import { HUD } from "./hud/HUD";
import type { Day } from "./types";

type Mode = "orbit" | "walk";

export function App() {
  const [mode, setMode] = useState<Mode>("orbit");
  const [days, setDays] = useState<Day[] | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [dayCount, setDayCount] = useState(0);

  // load data once at top level so the HUD has access too
  useEffect(() => {
    fetch("/data/innerprint_daily.json")
      .then((r) => r.json())
      .then((j) => setDays(j.days));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "v") {
        setMode((m) => (m === "orbit" ? "walk" : "orbit"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDayChange = useCallback((i: number) => setDayIndex(i), []);

  const cameraInitial: [number, number, number] =
    mode === "walk" ? [18, 1.62, 0] : [0, 28, 32];

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        camera={{ position: cameraInitial, fov: mode === "walk" ? 72 : 45 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Scene
          mode={mode}
          onDayChange={onDayChange}
          setReady={() => {}}
          setDayCount={setDayCount}
        />
      </Canvas>
      <HUD
        mode={mode}
        currentDay={days && dayCount > 0 ? days[dayIndex] : null}
        dayIndex={dayIndex}
        totalDays={dayCount}
      />
    </div>
  );
}
