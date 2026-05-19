import type { Day } from "../types";

type Props = {
  mode: "orbit" | "walk";
  currentDay: Day | null;
  dayIndex: number;
  totalDays: number;
};

export function HUD({ mode, currentDay, dayIndex, totalDays }: Props) {
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
          {currentDay.top_album && (
            <div
              style={{
                fontSize: 11,
                marginTop: 10,
                fontStyle: "italic",
                opacity: 0.65,
                letterSpacing: 0.6,
                textTransform: "none",
              }}
            >
              {currentDay.top_album} — {currentDay.top_artist ?? "—"}
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
