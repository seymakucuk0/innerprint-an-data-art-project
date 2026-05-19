"""Merge steps / spotify / weather / screentime into one daily CSV.

Output:
  data/processed/innerprint_daily.csv   — wide table, one row per day
  data/mock_metadata.json               — provenance per column per day
"""
from __future__ import annotations

import csv
import json
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PROC = REPO / "data" / "processed"

WINDOW_START = date(2025, 8, 26)
WINDOW_END = date(2026, 5, 18)

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday",
                 "Friday", "Saturday", "Sunday"]


def load(path: Path) -> dict[str, dict]:
    with path.open() as f:
        return {r["date"]: r for r in csv.DictReader(f)}


def load_signature_palette() -> dict[str, dict]:
    """Map album name → {signature_hex, artist} so consumers can read both."""
    path = REPO / "data" / "album_signature_palette.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    return {
        a["album"]: {"signature_hex": a["signature_hex"], "artist": a["artist"]}
        for a in data["albums"]
    }


def main() -> None:
    steps = load(PROC / "steps.csv")
    spotify = load(PROC / "spotify.csv")
    weather = load(PROC / "weather.csv")
    screen = load(PROC / "screentime.csv")
    signature = load_signature_palette()
    top_song = load(PROC / "top_song.csv") if (PROC / "top_song.csv").exists() else {}

    # Columns we want in the merged file, in this order
    out_cols = [
        "date", "weekday",
        # steps
        "steps", "steps_source",
        # weather
        "temp_max_c", "temp_min_c", "temp_mean_c",
        "feels_max_c", "feels_min_c",
        "precipitation_mm", "rain_mm", "snowfall_cm",
        "wind_max_kmh", "wind_gusts_kmh", "sunshine_hours",
        "weather_code", "weather_label",
        # spotify (subset; full detail stays in spotify.csv)
        "total_plays", "minutes_listened", "unique_tracks", "unique_artists",
        "top_artist", "top_artist_minutes", "top_album",
        "top_song", "top_song_artist", "top_song_album", "top_song_plays",
        "album_signature_artist", "album_signature_hex", "signature_source",
        "library_match_ratio", "discovery_streams",
        "late_night_streams", "morning_streams", "search_count",
        "podcast_minutes", "dominant_color_hex",
        # screen time
        "screen_total_min", "screen_productivity_min", "screen_social_min",
        "screen_entertainment_min", "screen_other_min", "screen_source",
    ]

    provenance: dict[str, dict] = {}
    rows: list[dict] = []

    d = WINDOW_START
    while d <= WINDOW_END:
        key = d.isoformat()
        out: dict = {c: "" for c in out_cols}
        out["date"] = key
        out["weekday"] = WEEKDAY_NAMES[d.weekday()]
        sources: dict[str, str] = {}

        s = steps.get(key)
        if s:
            out["steps"] = s["steps"]
            out["steps_source"] = s.get("primary_source", "")
            sources["steps"] = "real"

        w = weather.get(key)
        if w:
            for c in ("temp_max_c", "temp_min_c", "temp_mean_c",
                      "feels_max_c", "feels_min_c",
                      "precipitation_mm", "rain_mm", "snowfall_cm",
                      "wind_max_kmh", "wind_gusts_kmh", "sunshine_hours",
                      "weather_code", "weather_label"):
                out[c] = w.get(c, "")
            sources["weather"] = "real"

        sp = spotify.get(key)
        if sp:
            for c in ("total_plays", "minutes_listened", "unique_tracks",
                      "unique_artists", "top_artist", "top_artist_minutes",
                      "top_album", "library_match_ratio", "discovery_streams",
                      "late_night_streams", "morning_streams", "search_count",
                      "podcast_minutes", "dominant_color_hex"):
                out[c] = sp.get(c, "")
            sources["spotify"] = "real"

        # The signature color follows: (1) the album of the song played the
        # most that day, then (2) the album with the most total minutes
        # that day, then (3) nothing (will be lerp-filled in the art layer).
        ts = top_song.get(key)
        if ts:
            out["top_song"] = ts.get("top_song", "")
            out["top_song_artist"] = ts.get("top_song_artist", "")
            out["top_song_album"] = ts.get("top_song_album", "")
            out["top_song_plays"] = ts.get("top_song_plays", "")
        ts_album = (ts.get("top_song_album", "").strip() if ts else "")
        top_album = (sp.get("top_album", "").strip() if sp else "")
        if ts_album and ts_album in signature:
            out["album_signature_hex"] = signature[ts_album]["signature_hex"]
            out["album_signature_artist"] = signature[ts_album]["artist"]
            out["signature_source"] = "top_song"
        elif top_album and top_album in signature:
            out["album_signature_hex"] = signature[top_album]["signature_hex"]
            out["album_signature_artist"] = signature[top_album]["artist"]
            out["signature_source"] = "top_album"

        sc = screen.get(key)
        if sc:
            out["screen_total_min"] = sc["total_min"]
            out["screen_productivity_min"] = sc["productivity_min"]
            out["screen_social_min"] = sc["social_min"]
            out["screen_entertainment_min"] = sc["entertainment_min"]
            out["screen_other_min"] = sc["other_min"]
            out["screen_source"] = sc["source"]
            sources["screentime"] = sc["source"]

        rows.append(out)
        provenance[key] = sources
        d += timedelta(days=1)

    out_path = PROC / "innerprint_daily.csv"
    with out_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_cols)
        w.writeheader()
        w.writerows(rows)

    # Also emit a JSON version for the browser to load directly
    json_path = PROC / "innerprint_daily.json"
    typed_rows: list[dict] = []
    int_cols = {"steps", "total_plays", "counted_streams", "unique_tracks",
                "unique_artists", "top_artist_minutes", "discovery_streams",
                "late_night_streams", "morning_streams", "search_count",
                "podcast_minutes", "screen_total_min", "screen_productivity_min",
                "screen_social_min", "screen_entertainment_min", "screen_other_min",
                "weather_code", "top_track_plays", "color_sequence_count",
                "top_song_plays"}
    float_cols = {"temp_max_c", "temp_min_c", "temp_mean_c", "feels_max_c",
                  "feels_min_c", "precipitation_mm", "rain_mm", "snowfall_cm",
                  "wind_max_kmh", "wind_gusts_kmh", "sunshine_hours",
                  "minutes_listened", "top_artist_minutes", "top_album_minutes",
                  "library_match_ratio", "top_artist_share", "top_album_share"}
    for r in rows:
        t: dict = {}
        for k, v in r.items():
            if v == "":
                t[k] = None
            elif k in int_cols:
                try:
                    t[k] = int(float(v))
                except Exception:
                    t[k] = None
            elif k in float_cols:
                try:
                    t[k] = float(v)
                except Exception:
                    t[k] = None
            else:
                t[k] = v
        typed_rows.append(t)
    json_path.write_text(json.dumps({
        "window": {"start": WINDOW_START.isoformat(),
                   "end": WINDOW_END.isoformat()},
        "days": typed_rows,
    }, ensure_ascii=False))

    meta_path = REPO / "data" / "mock_metadata.json"
    summary: dict[str, dict[str, int]] = {}
    for src_map in provenance.values():
        for k, v in src_map.items():
            summary.setdefault(k, {}).setdefault(v, 0)
            summary[k][v] += 1
    meta_path.write_text(json.dumps({
        "window": {"start": WINDOW_START.isoformat(),
                   "end": WINDOW_END.isoformat(),
                   "days": len(rows)},
        "summary": summary,
        "by_day": provenance,
    }, indent=2, ensure_ascii=False))

    print(f"wrote {len(rows)} rows → {out_path}")
    print(f"wrote provenance → {meta_path}")
    print("source summary:")
    for k, v in summary.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
