"""Build data/processed/screentime.csv for 2025-08-26 → 2026-05-18.

Two regions:

1. **Mock**: 2025-08-26 → 2026-04-18. Generated from a U-shaped narrative
   ("yazdan aralık başına kadar yoğun" → "aralık-şubat arası düşük" →
   "şubat sonrası yeniden yükselen") with weekly variance, weekday/weekend
   shape, and a handful of exam-week / deadline spikes.

2. **Real**: 2026-04-19 → 2026-05-18. Daily values transcribed from
   iOS Screen Time screenshots (weekly summaries + bar visual estimates),
   matching the displayed category totals (Productivity & Finance, Social,
   Entertainment) and weekly averages to within a few percent.

Columns: date, weekday, total_min, productivity_min, social_min,
entertainment_min, other_min, source.
"""
from __future__ import annotations

import csv
import math
import random
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "data" / "processed" / "screentime.csv"

WINDOW_START = date(2025, 8, 26)
WINDOW_END = date(2026, 5, 18)
REAL_START = date(2026, 4, 19)

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday",
                 "Friday", "Saturday", "Sunday"]

# ---------------------------------------------------------------------------
# REAL DATA (transcribed from screenshots; minutes)
# Weekly category totals from the screenshots are matched within ~5%.
# ---------------------------------------------------------------------------
REAL: dict[date, dict[str, int]] = {
    # Week Apr 13-19 — only Sunday tracked (weekly daily-avg shown = 1h 11m)
    date(2026, 4, 19): {"total": 420, "P": 250, "S": 90,  "E": 60},

    # Week Apr 20-26 — peak: daily avg 17h36m, totals P=66h18m, S=20h15m, E=7h7m
    date(2026, 4, 20): {"total": 600,  "P": 380, "S": 130, "E": 50},
    date(2026, 4, 21): {"total": 420,  "P": 270, "S": 100, "E": 30},
    date(2026, 4, 22): {"total": 1440, "P": 900, "S": 280, "E": 90},
    date(2026, 4, 23): {"total": 1020, "P": 700, "S": 200, "E": 60},
    date(2026, 4, 24): {"total": 1140, "P": 730, "S": 260, "E": 100},
    date(2026, 4, 25): {"total": 1320, "P": 720, "S": 380, "E": 130},
    date(2026, 4, 26): {"total": 960,  "P": 478, "S": 230, "E": 110},

    # Week Apr 27-May 3 — daily 13h34m, P=39h58m, S=25h14m, Other=6h17m
    date(2026, 4, 27): {"total": 1020, "P": 640, "S": 240, "E": 70},
    date(2026, 4, 28): {"total": 1020, "P": 620, "S": 280, "E": 50},
    date(2026, 4, 29): {"total": 1320, "P": 800, "S": 360, "E": 80},
    date(2026, 4, 30): {"total": 600,  "P": 280, "S": 220, "E": 60},
    date(2026, 5,  1): {"total": 600,  "P": 250, "S": 240, "E": 70},
    date(2026, 5,  2): {"total": 600,  "P": 220, "S": 280, "E": 70},
    date(2026, 5,  3): {"total": 420,  "P": 188, "S": 194, "E": 77},

    # Week May 4-10 — daily 13h24m, P=43h38m, S=14h52m, E=8h2m
    date(2026, 5,  4): {"total": 1020, "P": 580, "S": 170, "E": 110},
    date(2026, 5,  5): {"total": 1020, "P": 600, "S": 160, "E": 110},
    date(2026, 5,  6): {"total": 960,  "P": 540, "S": 150, "E": 90},
    date(2026, 5,  7): {"total": 720,  "P": 420, "S": 130, "E": 70},
    date(2026, 5,  8): {"total": 540,  "P": 250, "S": 130, "E": 50},
    date(2026, 5,  9): {"total": 660,  "P": 270, "S": 150, "E": 70},
    date(2026, 5, 10): {"total": 540,  "P": 158, "S": 102, "E": 82},

    # Week May 11-17 — daily 12h5m, P=34h4m, S=18h2m, Other=4h38m
    date(2026, 5, 11): {"total": 600,  "P": 270, "S": 170, "E": 40},
    date(2026, 5, 12): {"total": 720,  "P": 320, "S": 200, "E": 40},
    date(2026, 5, 13): {"total": 720,  "P": 360, "S": 210, "E": 35},
    date(2026, 5, 14): {"total": 840,  "P": 380, "S": 240, "E": 40},
    date(2026, 5, 15): {"total": 420,  "P": 200, "S": 140, "E": 25},
    date(2026, 5, 16): {"total": 420,  "P": 180, "S": 150, "E": 25},
    date(2026, 5, 17): {"total": 1330, "P": 334, "S": 472, "E": 73},  # Sunday spike

    # Week May 18- (yesterday only) — Monday total 18h22m
    date(2026, 5, 18): {"total": 1102, "P": 515, "S": 238, "E": 64},
}


# ---------------------------------------------------------------------------
# MOCK GENERATION
# ---------------------------------------------------------------------------

def intensity(d: date) -> float:
    """0..1 narrative curve.

    - Aug 26 → Dec 5, 2025: high plateau around 0.78 with sinusoidal weeks
    - Dec 5 → Feb 28, 2026: dip to 0.25 (semester break, holidays)
    - Mar 1 → Apr 18, 2026: linear ramp 0.40 → 0.85 (ramp-up before real data)
    """
    high_end = date(2025, 12, 5)
    low_end = date(2026, 2, 28)

    if d <= high_end:
        # plateau around 0.78, slow wobble to feel organic
        days_in = (d - WINDOW_START).days
        wobble = 0.08 * math.sin(days_in * 2 * math.pi / 21)  # 3-week wobble
        return 0.78 + wobble
    if d <= low_end:
        # smooth descent then valley around mid-January (winter break)
        # use a quadratic dip centered at Jan 10
        center = date(2026, 1, 10)
        days_off = (d - center).days
        base = 0.28 + 0.0009 * (days_off ** 2)  # parabola opening upward
        return max(0.18, min(0.55, base))
    # rising ramp
    span = (date(2026, 4, 18) - low_end).days
    progressed = (d - low_end).days / span
    return 0.40 + 0.45 * progressed


# Calendar bumps: exam weeks / deadlines add intensity for a short window
SPIKES: list[tuple[date, date, float]] = [
    (date(2025, 10, 27), date(2025, 11, 3),  1.20),   # midterms
    (date(2025, 11, 24), date(2025, 12, 1),  1.30),   # final project rush
    (date(2025, 12, 22), date(2025, 12, 31), 0.55),   # winter holidays — drop
    (date(2026, 1,  1),  date(2026, 1,  8),  0.45),   # new year break
    (date(2026, 3, 16),  date(2026, 3, 23),  1.20),   # spring midterms
    (date(2026, 4,  6),  date(2026, 4, 13),  1.25),   # final-year project deadline
]


def spike_factor(d: date) -> float:
    for start, end, factor in SPIKES:
        if start <= d <= end:
            return factor
    return 1.0


def weekday_factor(d: date, period: str) -> float:
    """Weekends look different across the year."""
    wd = d.weekday()  # 0=Mon
    if period == "high":
        return [1.05, 1.10, 1.08, 1.05, 0.85, 0.78, 0.88][wd]
    if period == "low":
        return [0.95, 0.92, 0.95, 0.88, 0.80, 1.05, 1.10][wd]
    # rising — weekdays dominate
    return [1.10, 1.12, 1.10, 1.05, 0.85, 0.82, 0.90][wd]


def period_of(d: date) -> str:
    if d <= date(2025, 12, 5):
        return "high"
    if d <= date(2026, 2, 28):
        return "low"
    return "rising"


def category_weights(period: str) -> tuple[float, float, float]:
    """Returns (productivity_share, social_share, entertainment_share).
    Remainder goes to 'other'."""
    if period == "high":
        return (0.52, 0.18, 0.08)   # heavy productivity / project work
    if period == "low":
        return (0.30, 0.28, 0.22)   # less productivity, more leisure
    return (0.48, 0.20, 0.10)        # rising — productivity recovers


# Anchor scale: a 1.0 intensity day with neutral weekday should be this many min
SCALE_MINUTES = 780  # 13h cap for very intense day


def mock_day(d: date, rng: random.Random) -> dict[str, int]:
    period = period_of(d)
    base = intensity(d) * weekday_factor(d, period) * spike_factor(d)
    noise = rng.gauss(1.0, 0.13)
    total = max(40, base * SCALE_MINUTES * noise)
    total = int(round(total))

    p_share, s_share, e_share = category_weights(period)
    # jitter the shares a bit so two adjacent days don't look identical
    p_share = max(0.05, p_share + rng.gauss(0, 0.04))
    s_share = max(0.05, s_share + rng.gauss(0, 0.03))
    e_share = max(0.02, e_share + rng.gauss(0, 0.02))
    p = int(round(total * p_share))
    s = int(round(total * s_share))
    e = int(round(total * e_share))
    other = max(0, total - p - s - e)
    return {"total": total, "P": p, "S": s, "E": e, "O": other}


def main() -> None:
    rng = random.Random(20260519)
    rows: list[dict] = []
    d = WINDOW_START
    while d <= WINDOW_END:
        if d >= REAL_START and d in REAL:
            r = REAL[d]
            other = max(0, r["total"] - r["P"] - r["S"] - r["E"])
            rows.append({
                "date": d.isoformat(),
                "weekday": WEEKDAY_NAMES[d.weekday()],
                "total_min": r["total"],
                "productivity_min": r["P"],
                "social_min": r["S"],
                "entertainment_min": r["E"],
                "other_min": other,
                "source": "real",
            })
        elif d >= REAL_START:
            # Apr 13-18 (no screen-time data captured)
            rows.append({
                "date": d.isoformat(),
                "weekday": WEEKDAY_NAMES[d.weekday()],
                "total_min": 0,
                "productivity_min": 0,
                "social_min": 0,
                "entertainment_min": 0,
                "other_min": 0,
                "source": "real",
            })
        else:
            m = mock_day(d, rng)
            rows.append({
                "date": d.isoformat(),
                "weekday": WEEKDAY_NAMES[d.weekday()],
                "total_min": m["total"],
                "productivity_min": m["P"],
                "social_min": m["S"],
                "entertainment_min": m["E"],
                "other_min": m["O"],
                "source": "mock",
            })
        d += timedelta(days=1)

    with OUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "date", "weekday", "total_min",
            "productivity_min", "social_min", "entertainment_min", "other_min",
            "source",
        ])
        w.writeheader()
        w.writerows(rows)

    # quick sanity print
    by_period: dict[str, list[int]] = {"high": [], "low": [], "rising": [], "real": []}
    for r in rows:
        d_ = date.fromisoformat(r["date"])
        if r["source"] == "real":
            by_period["real"].append(r["total_min"])
        else:
            by_period[period_of(d_)].append(r["total_min"])
    print(f"wrote {len(rows)} rows → {OUT}")
    for k, v in by_period.items():
        if v:
            avg = sum(v) / len(v) / 60
            print(f"  {k:7s}: n={len(v):3d}  avg={avg:5.2f} h/day"
                  f"  min={min(v)/60:4.1f}h  max={max(v)/60:4.1f}h")


if __name__ == "__main__":
    main()
