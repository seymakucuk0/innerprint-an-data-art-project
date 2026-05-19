# innerprint — the spiral within

A data art installation that turns ~8 months of one person's daily traces
(Spotify listening, step counts, Istanbul weather, screen time) into a
**walkable fingerprint-shaped spiral** rendered in 3D.

> This is not a dashboard. It is a place you can walk inside of.

The structure references a real fingerprint's spiral pattern: a single
entry on the outer edge, a single path to the centre. Each segment of the
spiral corresponds to a day; corridor width, wall height, colour, light
and ambient sound are all derived from the data of that day.

Two perspectives:

- **From outside** — a sculptural object you can orbit and inspect.
- **From inside** — arrow keys to walk the corridor, with the environment
  shifting in response to the data of the region you're in.

The 3D form will also be STL-exportable so the spiral can be printed.

---

## Data window

`2025-08-26 → 2026-05-18` · **266 days**

| stream | rows | provenance |
|---|---:|---|
| Steps (Apple Health) | 260 | real |
| Weather (Open-Meteo Istanbul archive) | 266 | real |
| Spotify (daily aggregates from streaming history) | 254 | real |
| Screen Time | 30 real / 236 mock | iOS Screen Time screenshots (real, 2026-04-19→2026-05-18) + a narrative-shaped mock for the earlier 236 days |

Provenance per day is recorded in [`data/mock_metadata.json`](data/mock_metadata.json).

### Why mock screen time?

iOS Screen Time only started tracking on this device in mid-April 2026,
so the earlier ~7 months had no recorded values. Rather than leave the
spiral hollow there, the mock follows a deliberately shaped narrative
that matches the lived experience of the period:

- **2025-08-26 → 2025-12-05** — high plateau. Final-year project work,
  long screen days, fall midterms and a project crunch in late November.
- **2025-12-06 → 2026-02-28** — valley. Winter break, holidays, a
  noticeably slower January.
- **2026-03-01 → 2026-04-18** — rising ramp. The two-three month build-up
  to the real-data window.
- **2026-04-19 → 2026-05-18** — real values transcribed from screenshots
  (daily totals + Productivity / Social / Entertainment categories).

Mock days have `screen_source = "mock"`; real days have `screen_source = "real"`.

---

## Repo layout

```
innerprint-an-data-art-project/
├── data/
│   ├── processed/                  # the data the art will consume
│   │   ├── steps.csv
│   │   ├── spotify.csv
│   │   ├── weather.csv
│   │   ├── screentime.csv
│   │   └── innerprint_daily.csv    # merged wide table — the source of truth
│   ├── raw/                        # original exports (gitignored)
│   └── mock_metadata.json          # which days/columns are mock vs real
├── scripts/
│   ├── backfill_weather.py         # Open-Meteo archive → weather.csv
│   ├── generate_screentime.py      # mock + screenshot transcription
│   └── merge_innerprint.py         # join all streams → innerprint_daily.csv
├── art/                            # React + react-three-fiber + Tone.js (coming)
└── README.md
```

## Reproducing the data

```bash
python3 scripts/backfill_weather.py
python3 scripts/generate_screentime.py
python3 scripts/merge_innerprint.py
```

All three are deterministic (the mock screen-time generator is seeded).

---

## What's next

- [x] Lock the 8-month dataset (this commit)
- [ ] Map each daily row to a spiral segment: corridor width, wall height,
      colour, light, ambient sound
- [ ] React + Three.js (react-three-fiber) shell with orbit + walk modes
- [ ] Tone.js soundscape that morphs as you walk between regions
- [ ] STL export of the spiral mesh
