import { Suspense } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useInnerprintData } from "../data/useInnerprintData";
import { SpiralCorridor } from "./SpiralCorridor";
import { OrbitView } from "./OrbitView";
import { WalkController } from "./WalkController";

type Props = {
  mode: "orbit" | "walk";
  onDayChange: (dayIndex: number) => void;
  setReady: (ready: boolean) => void;
  setDayCount: (n: number) => void;
  gotoRef: React.MutableRefObject<number | null>;
};

export function Scene({ mode, onDayChange, setReady, setDayCount, gotoRef }: Props) {
  const { data } = useInnerprintData();

  if (!data) return null;
  // signal upward that data is ready (once)
  if (!(window as any).__readySignal) {
    (window as any).__readySignal = true;
    setReady(true);
    setDayCount(data.days.length);
  }

  return (
    <Suspense fallback={null}>
      <color attach="background" args={["#0a0512"]} />
      <fog attach="fog" args={["#0a0512", 14, 70]} />
      <ambientLight intensity={0.12} />
      <hemisphereLight args={["#22335a", "#160620", 0.25]} />

      <SpiralCorridor days={data.days} />

      <OrbitView active={mode === "orbit"} />
      <WalkController
        active={mode === "walk"}
        dayCount={data.days.length}
        onDayChange={onDayChange}
        gotoRef={gotoRef}
      />

      <EffectComposer>
        <Bloom intensity={0.55} luminanceThreshold={0.18} luminanceSmoothing={0.45} />
      </EffectComposer>
    </Suspense>
  );
}
