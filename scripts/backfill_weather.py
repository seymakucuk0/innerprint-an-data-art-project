"""Fetch Istanbul daily weather from Open-Meteo archive and merge into weather.csv.

Fills the gaps at the edges of the existing weather window
(2025-08-26 → 2025-08-31 and 2026-05-01 → 2026-05-19) so the file
covers the full 8-month innerprint window.
"""
from __future__ import annotations

import csv
import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WEATHER_CSV = REPO / "data" / "processed" / "weather.csv"

WINDOW_START = "2025-08-26"
WINDOW_END = "2026-05-19"

LAT, LON = 41.0082, 28.9784  # Istanbul

WEATHER_CODE_LABELS = {
    0: "clear", 1: "mostly_clear", 2: "partly_cloudy", 3: "overcast",
    45: "fog", 48: "rime_fog",
    51: "drizzle_light", 53: "drizzle", 55: "drizzle_dense",
    56: "freezing_drizzle_light", 57: "freezing_drizzle_dense",
    61: "rain_light", 63: "rain", 65: "rain_heavy",
    66: "freezing_rain_light", 67: "freezing_rain_heavy",
    71: "snow_light", 73: "snow", 75: "snow_heavy", 77: "snow_grains",
    80: "showers_light", 81: "showers", 82: "showers_violent",
    85: "snow_showers_light", 86: "snow_showers_heavy",
    95: "thunderstorm", 96: "thunderstorm_hail_light", 99: "thunderstorm_hail_heavy",
}

FIELDS = [
    "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
    "apparent_temperature_max", "apparent_temperature_min",
    "precipitation_sum", "rain_sum", "snowfall_sum",
    "wind_speed_10m_max", "wind_gusts_10m_max", "sunshine_duration",
    "weather_code",
]

CSV_COLUMNS = [
    "date", "temp_max_c", "temp_min_c", "temp_mean_c",
    "feels_max_c", "feels_min_c",
    "precipitation_mm", "rain_mm", "snowfall_cm",
    "wind_max_kmh", "wind_gusts_kmh", "sunshine_hours",
    "weather_code", "weather_label",
]


def fetch_range(start: str, end: str) -> list[dict]:
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={LAT}&longitude={LON}"
        f"&start_date={start}&end_date={end}"
        f"&daily={','.join(FIELDS)}"
        "&timezone=Europe%2FIstanbul"
    )
    raw = subprocess.check_output(["curl", "-fsSL", url], timeout=60)
    payload = json.loads(raw)
    daily = payload["daily"]
    rows: list[dict] = []
    for i, d in enumerate(daily["time"]):
        sunshine_s = daily["sunshine_duration"][i]
        snowfall_cm = daily["snowfall_sum"][i]
        code = daily["weather_code"][i] or 0
        rows.append({
            "date": d,
            "temp_max_c": daily["temperature_2m_max"][i],
            "temp_min_c": daily["temperature_2m_min"][i],
            "temp_mean_c": daily["temperature_2m_mean"][i],
            "feels_max_c": daily["apparent_temperature_max"][i],
            "feels_min_c": daily["apparent_temperature_min"][i],
            "precipitation_mm": daily["precipitation_sum"][i],
            "rain_mm": daily["rain_sum"][i],
            "snowfall_cm": round((snowfall_cm or 0), 2),
            "wind_max_kmh": daily["wind_speed_10m_max"][i],
            "wind_gusts_kmh": daily["wind_gusts_10m_max"][i],
            "sunshine_hours": round((sunshine_s or 0) / 3600, 2),
            "weather_code": code,
            "weather_label": WEATHER_CODE_LABELS.get(code, f"code_{code}"),
        })
    return rows


def load_existing() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    if not WEATHER_CSV.exists():
        return rows
    with WEATHER_CSV.open() as f:
        for r in csv.DictReader(f):
            rows[r["date"]] = r
    return rows


def main() -> None:
    existing = load_existing()
    print(f"existing weather rows: {len(existing)}")
    # Re-fetch full window to keep it tidy; archive API gives stable historical data.
    fetched = fetch_range(WINDOW_START, WINDOW_END)
    print(f"fetched {len(fetched)} rows for {WINDOW_START}..{WINDOW_END}")

    merged: dict[str, dict] = {}
    for r in fetched:
        merged[r["date"]] = {k: (r[k] if r[k] is not None else "") for k in CSV_COLUMNS}
    # keep any pre-existing rows that fetch may have missed (defensive)
    for date_str, row in existing.items():
        if date_str not in merged and WINDOW_START <= date_str <= WINDOW_END:
            merged[date_str] = row

    with WEATHER_CSV.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for date_str in sorted(merged):
            w.writerow(merged[date_str])
    print(f"wrote {len(merged)} rows to {WEATHER_CSV}")


if __name__ == "__main__":
    main()
