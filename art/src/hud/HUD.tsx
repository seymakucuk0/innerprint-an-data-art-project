import { useEffect, useRef } from "react";
import type { Day } from "../types";

type Props = {
  mode: "orbit" | "walk";
  currentDay: Day | null;
  dayIndex: number;
  totalDays: number;
  days: Day[] | null;
  onJump: (dateIso: string) => void;
};

export function HUD({ mode, currentDay, dayIndex, totalDays, days, onJump }: Props) {
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

      {mode === "walk" && currentDay && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 28,
            transform: "translateX(-50%)",
            textAlign: "center",
            pointerEvents: "none",
            color: "#f5e9d8",
            opacity: 0.78,
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.6 }}>{currentDay.weekday}</div>
          <div style={{ fontSize: 22, letterSpacing: 3, marginTop: 4 }}>
            {currentDay.date}
          </div>
          {currentDay.top_song && (
            <div
              style={{
                fontSize: 13,
                marginTop: 10,
                opacity: 0.78,
                letterSpacing: 0.4,
                textTransform: "none",
              }}
            >
              {currentDay.top_song}
              <span style={{ opacity: 0.55 }}> · {currentDay.top_song_artist ?? "—"}</span>
            </div>
          )}
          {(currentDay.top_song_album || currentDay.top_album) && (
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                fontStyle: "italic",
                opacity: 0.55,
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
              marginTop: 6,
              opacity: 0.45,
              letterSpacing: 1.0,
            }}
          >
            day {dayIndex + 1} / {totalDays}
          </div>
        </div>
      )}
    </>
  );
}
