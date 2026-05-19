"""Compute, per day, the SINGLE most-played song and the album that song
lives on.

This differs from spotify_daily.csv's `top_album` (= album with the most
total minutes across all its tracks that day). User wants the album of
THE one song they replayed the most.

Output: data/processed/top_song.csv with columns
  date, top_song, top_song_artist, top_song_album, top_song_plays
and a tiny stats summary printed at the end.
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
HISTORY = Path("/Users/seymakucuk/Desktop/apple_health_export/spotify_history.csv")
OUT = REPO / "data" / "processed" / "top_song.csv"

WINDOW_START = date(2025, 8, 26)
WINDOW_END = date(2026, 5, 18)


def main() -> None:
    rows: list[dict] = []
    with HISTORY.open() as f:
        for r in csv.DictReader(f):
            try:
                d = date.fromisoformat(r["date"])
            except Exception:
                continue
            if WINDOW_START <= d <= WINDOW_END:
                rows.append(r)
    print(f"streams in window: {len(rows)}")

    # 62% of streams have empty album field in the raw export.
    # Reconstruct a (artist, track) → most-likely-album lookup from streams
    # that DO carry an album value.
    candidate_albums: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for r in rows:
        if r["album"]:
            candidate_albums[(r["artist"], r["track"])][r["album"]] += 1
    track_to_album: dict[tuple[str, str], str] = {
        k: c.most_common(1)[0][0] for k, c in candidate_albums.items()
    }
    print(f"track→album resolutions from in-window streams: {len(track_to_album)}")

    # Fall back to full-history scan (including pre-window) for any track
    # we couldn't resolve from the window alone.
    full_candidate: dict[tuple[str, str], Counter] = defaultdict(Counter)
    with HISTORY.open() as f:
        for r in csv.DictReader(f):
            if r["album"]:
                full_candidate[(r["artist"], r["track"])][r["album"]] += 1
    for k, c in full_candidate.items():
        track_to_album.setdefault(k, c.most_common(1)[0][0])
    print(f"track→album resolutions after full-history fallback: {len(track_to_album)}")

    # Per day: count plays of each (artist, track), find the top one.
    by_day: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        try:
            if int(r["counted_stream"]) != 1:
                continue
        except Exception:
            continue
        by_day[r["date"]][(r["artist"], r["track"])] += 1

    out: list[dict] = []
    for day_iso in sorted(by_day):
        top_pair, plays = by_day[day_iso].most_common(1)[0]
        artist, track = top_pair
        album = track_to_album.get(top_pair, "")
        out.append({
            "date": day_iso,
            "top_song": track,
            "top_song_artist": artist,
            "top_song_album": album,
            "top_song_plays": plays,
        })

    with OUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "date", "top_song", "top_song_artist", "top_song_album", "top_song_plays"
        ])
        w.writeheader()
        w.writerows(out)
    print(f"wrote {len(out)} rows → {OUT}")

    # Stats: how many of these top_song_albums are NEW vs current signature palette?
    palette_albums = set()
    palette_path = REPO / "data" / "album_signature_palette.json"
    if palette_path.exists():
        palette_albums = {a["album"] for a in json.loads(palette_path.read_text())["albums"]}

    unique_top_albums = Counter(r["top_song_album"] for r in out if r["top_song_album"])
    missing_album_days = sum(1 for r in out if not r["top_song_album"])
    new_albums = [a for a in unique_top_albums if a not in palette_albums]

    print(f"\nunique top_song_album in window: {len(unique_top_albums)}")
    print(f"days with no album resolvable: {missing_album_days}")
    print(f"already in palette: {sum(1 for a in unique_top_albums if a in palette_albums)}")
    print(f"NEW albums (need signature): {len(new_albums)}")

    if new_albums:
        print(f"\nNew albums (sorted by days as top-song-album):")
        for a in sorted(new_albums, key=lambda a: -unique_top_albums[a])[:30]:
            print(f"  {unique_top_albums[a]:3d}  {a}")


if __name__ == "__main__":
    main()
