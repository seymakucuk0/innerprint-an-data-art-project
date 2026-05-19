import { useEffect, useRef } from "react";
import type { Day } from "../types";

type SpotifyHud = {
  configured: boolean;
  authed: boolean;
  status: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onPlay: () => void;             // play from chorus (smart)
  onPlayFromStart: () => void;    // play from start
  onToggle: () => void;
};

type Props = {
  mode: "orbit" | "walk";
  currentDay: Day | null;
  dayIndex: number;
  totalDays: number;
  days: Day[] | null;
  onJump: (dateIso: string) => void;
  spotify: SpotifyHud;
};

export function HUD({ mode, currentDay, dayIndex, totalDays, days, onJump, spotify }: Props) {
  const dateRef = useRef<HTMLInputElement>(null);
  const firstDate = days?.[0]?.date ?? "2025-08-26";
  const lastDate = days?.[days.length - 1]?.date ?? "2026-05-18";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 'J' = focus the jump field. If typing in the field, ignore other hotkeys.
      const active = document.activeElement as HTMLElement | null;
      const inField = active?.tagName === "INPUT";
      if (e.key.toLowerCase() === "j" && !inField) {
        e.preventDefault();
        dateRef.current?.focus();
        dateRef.current?.showPicker?.();
      }
      if (e.key === "Escape" && inField) {
        (active as HTMLInputElement).blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        style={{
          position: "absolute",
          left: 24,
          top: 20,
          letterSpacing: 1.3,
          fontSize: 12,
          opacity: 0.55,
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        innerprint — the spiral within
        <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, letterSpacing: 0.6 }}>
          2025-08-26 → 2026-05-18 · 266 days
        </div>
      </header>

      <div
        style={{
          position: "absolute",
          right: 24,
          top: 20,
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          opacity: 0.55,
          textAlign: "right",
          pointerEvents: "none",
          lineHeight: 1.7,
        }}
      >
        <div>
          mode <span style={{ opacity: 0.9, marginLeft: 6 }}>{mode}</span>
        </div>
        <div style={{ opacity: 0.5, marginTop: 2 }}>
          press <b style={{ opacity: 0.9 }}>v</b> to switch
        </div>
        {mode === "walk" && (
          <div style={{ opacity: 0.5, marginTop: 6 }}>
            ↑ / ↓ &nbsp;walk &nbsp;·&nbsp; ← / → &nbsp;glance
          </div>
        )}
        <div style={{ opacity: 0.5, marginTop: 6 }}>
          <b style={{ opacity: 0.9 }}>j</b> &nbsp;jump to date
        </div>
        {spotify.authed && (
          <>
            <div style={{ opacity: 0.5, marginTop: 2 }}>
              <b style={{ opacity: 0.9 }}>p</b> &nbsp;play from chorus
            </div>
            <div style={{ opacity: 0.5 }}>
              <b style={{ opacity: 0.9 }}>shift + p</b> &nbsp;from start
            </div>
          </>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "#f5e9d8",
          opacity: 0.78,
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {!spotify.configured ? (
          <span style={{ opacity: 0.45 }}>spotify: set client id</span>
        ) : !spotify.authed ? (
          <button
            onClick={spotify.onLogin}
            style={{
              background: "transparent",
              border: "1px solid rgba(245, 233, 216, 0.25)",
              color: "#f5e9d8",
              padding: "5px 10px",
              borderRadius: 2,
              fontFamily: "inherit",
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            ▶ connect spotify
          </button>
        ) : (
          <>
            <button
              onClick={(e) =>
                e.shiftKey ? spotify.onPlayFromStart() : spotify.onPlay()
              }
              title="click → play from chorus · shift+click → from start"
              style={{
                background: "rgba(245, 233, 216, 0.08)",
                border: "1px solid rgba(245, 233, 216, 0.35)",
                color: "#f5e9d8",
                padding: "5px 12px",
                borderRadius: 2,
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              ▶ play this day
            </button>
            <button
              onClick={spotify.onToggle}
              title="toggle play / pause"
              style={{
                background: "transparent",
                border: "1px solid rgba(245, 233, 216, 0.2)",
                color: "#f5e9d8",
                padding: "5px 9px",
                borderRadius: 2,
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: 1.2,
                cursor: "pointer",
              }}
            >
              ⏸
            </button>
            <button
              onClick={spotify.onLogout}
              title="disconnect"
              style={{
                background: "transparent",
                border: "none",
                color: "#f5e9d8",
                opacity: 0.45,
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              disconnect
            </button>
          </>
        )}
        {spotify.status && (
          <span style={{ opacity: 0.55, fontSize: 10, marginLeft: 6 }}>
            {spotify.status}
          </span>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          right: 24,
          bottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
          pointerEvents: "auto",
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          opacity: 0.78,
          color: "#f5e9d8",
        }}
      >
        <span style={{ opacity: 0.55 }}>jump →</span>
        <input
          ref={dateRef}
          type="date"
          min={firstDate}
          max={lastDate}
          defaultValue={currentDay?.date ?? firstDate}
          onChange={(e) => {
            if (e.target.value) onJump(e.target.value);
          }}
          style={{
            background: "transparent",
            color: "#f5e9d8",
            border: "1px solid rgba(245, 233, 216, 0.25)",
            borderRadius: 2,
            padding: "4px 8px",
            fontFamily: "inherit",
            fontSize: 11,
            letterSpacing: 1.2,
            colorScheme: "dark",
            outline: "none",
          }}
        />
      </div>

      {currentDay && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 36,
            transform: "translateX(-50%)",
            textAlign: "center",
            pointerEvents: "none",
            color: "#f8eedb",
            letterSpacing: 1.4,
            textTransform: "uppercase",
            maxWidth: "70vw",
            textShadow: "0 0 18px rgba(0, 0, 0, 0.55)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 500 }}>
            {currentDay.weekday}
          </div>
          <div
            style={{
              fontSize: 34,
              letterSpacing: 5,
              marginTop: 6,
              fontWeight: 600,
              opacity: 0.96,
            }}
          >
            {currentDay.date}
          </div>
          {currentDay.top_song ? (
            <div
              style={{
                fontSize: 18,
                marginTop: 14,
                opacity: 0.95,
                letterSpacing: 0.5,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {currentDay.top_song}
              <span style={{ opacity: 0.65, fontWeight: 400 }}>
                {"  ·  "}
                {currentDay.top_song_artist ?? "—"}
              </span>
            </div>
          ) : (
            <div
              style={{
                fontSize: 13,
                marginTop: 14,
                opacity: 0.45,
                letterSpacing: 0.6,
                textTransform: "none",
                fontStyle: "italic",
              }}
            >
              no streams this day
            </div>
          )}
          {(currentDay.top_song_album || currentDay.top_album) && (
            <div
              style={{
                fontSize: 12,
                marginTop: 6,
                fontStyle: "italic",
                opacity: 0.7,
                letterSpacing: 0.6,
                textTransform: "none",
              }}
            >
              from {currentDay.top_song_album || currentDay.top_album}
              {currentDay.album_signature_artist
                ? ` — ${currentDay.album_signature_artist}`
                : ""}
              {currentDay.top_song_plays
                ? ` · ${currentDay.top_song_plays} plays`
                : ""}
            </div>
          )}
          <div
            style={{
              fontSize: 10,
              marginTop: 10,
              opacity: 0.5,
              letterSpacing: 1.2,
            }}
          >
            day {dayIndex + 1} / {totalDays}
          </div>
        </div>
      )}
    </>
  );
}
