import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./scene/Scene";
import { HUD } from "./hud/HUD";
import type { Day } from "./types";
import { hasClientId, login, logout, resolveToken } from "./spotify/auth";
import {
  ensurePlayer,
  playUri,
  searchTrackUri,
  togglePlayPause,
} from "./spotify/player";

type Mode = "orbit" | "walk";

export function App() {
  const [mode, setMode] = useState<Mode>("orbit");
  const [days, setDays] = useState<Day[] | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [dayCount, setDayCount] = useState(0);

  // Shared with WalkController. When a number, the walker eases s toward
  // it and then clears it. Null = no pending jump.
  const gotoRef = useRef<number | null>(null);

  // Spotify state
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = spotifyToken;

  // load data once at top level so the HUD has access too
  useEffect(() => {
    fetch("/data/innerprint_daily.json")
      .then((r) => r.json())
      .then((j) => setDays(j.days));
  }, []);

  // pick up an auth redirect or cached token on first paint
  useEffect(() => {
    resolveToken().then((t) => setSpotifyToken(t));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (document.activeElement as HTMLElement | null)?.tagName === "INPUT";
      if (inField) return;
      if (e.key.toLowerCase() === "v") {
        setMode((m) => (m === "orbit" ? "walk" : "orbit"));
      }
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        void playCurrentDay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, dayIndex, spotifyToken]);

  const onDayChange = useCallback((i: number) => setDayIndex(i), []);

  const onJump = useCallback(
    (iso: string) => {
      if (!days || days.length === 0) return;
      const idx = days.findIndex((d) => d.date === iso);
      if (idx < 0) return;
      gotoRef.current = idx / (days.length - 1);
      // jumps are most expressive from inside the spiral
      setMode("walk");
    },
    [days],
  );

  async function playCurrentDay() {
    if (!spotifyToken) {
      setSpotifyStatus("login required");
      return;
    }
    const day = days?.[dayIndex];
    const artist = day?.top_song_artist ?? day?.top_artist;
    const track = day?.top_song;
    if (!artist || !track) {
      setSpotifyStatus("no song for this day");
      return;
    }
    try {
      setSpotifyStatus("loading…");
      await ensurePlayer(() => tokenRef.current);
      const uri = await searchTrackUri(spotifyToken, artist, track);
      if (!uri) {
        setSpotifyStatus(`couldn't find "${track}"`);
        return;
      }
      const ok = await playUri(spotifyToken, uri);
      setSpotifyStatus(ok ? `▶ ${track}` : "play failed");
    } catch (e) {
      setSpotifyStatus(String((e as Error).message ?? e));
    }
  }

  function disconnectSpotify() {
    logout();
    setSpotifyToken(null);
    setSpotifyStatus(null);
  }

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
          gotoRef={gotoRef}
        />
      </Canvas>
      <HUD
        mode={mode}
        currentDay={days && dayCount > 0 ? days[dayIndex] : null}
        dayIndex={dayIndex}
        totalDays={dayCount}
        days={days}
        onJump={onJump}
        spotify={{
          configured: hasClientId(),
          authed: Boolean(spotifyToken),
          status: spotifyStatus,
          onLogin: () => void login(),
          onLogout: disconnectSpotify,
          onPlay: () => void playCurrentDay(),
          onToggle: () => void togglePlayPause(),
        }}
      />
    </div>
  );
}
