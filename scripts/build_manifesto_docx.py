"""Generate innerprint_manifesto.docx — compact English data-art brief.

Sections: overview, data inventory, annotation table, decision notes,
structure + mechanics, controls, repo link. Functional language; no
manifesto theatrics.
"""
from __future__ import annotations

from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "innerprint_manifesto.docx"
REPO_URL = "https://github.com/seymakucuk0/innerprint-an-data-art-project"

BODY_FONT = "Iowan Old Style"


def _shade(cell, hex_color: str) -> None:
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = BODY_FONT
        run.font.color.rgb = RGBColor(0x14, 0x10, 0x1A)
        run.font.size = Pt(18 if level == 0 else 13 if level == 1 else 11)


def para(doc, text, size=10.5, after=4):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = BODY_FONT
    run.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(after)
    return p


def bullet(doc, text, size=10):
    p = doc.add_paragraph(style="List Bullet")
    run = p.add_run(text)
    run.font.name = BODY_FONT
    run.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(2)


def table(doc, headers, rows, col_widths=None):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.style = "Light Grid Accent 1"

    if col_widths:
        for i, w in enumerate(col_widths):
            for cell in t.columns[i].cells:
                cell.width = Cm(w)

    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        _shade(cell, "1A1020")
        cell.text = ""
        p = cell.paragraphs[0]
        run = p.add_run(h.upper())
        run.font.name = BODY_FONT
        run.font.size = Pt(8.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0xF5, 0xE9, 0xD8)
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)

    for r, row in enumerate(rows, start=1):
        for c, txt in enumerate(row):
            cell = t.rows[r].cells[c]
            cell.text = ""
            p = cell.paragraphs[0]
            run = p.add_run(txt)
            run.font.name = BODY_FONT
            run.font.size = Pt(9)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)


def hyperlink(paragraph, url, text):
    part = paragraph.part
    r_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    h = OxmlElement("w:hyperlink")
    h.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "3A4FB8")
    rPr.append(color)
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rPr.append(u)
    rf = OxmlElement("w:rFonts")
    rf.set(qn("w:ascii"), BODY_FONT)
    rPr.append(rf)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), "21")
    rPr.append(sz)
    run.append(rPr)
    t = OxmlElement("w:t")
    t.text = text
    run.append(t)
    h.append(run)
    paragraph._p.append(h)


def build():
    doc = Document()

    sec = doc.sections[0]
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(2.2)
    sec.top_margin = Cm(1.8)
    sec.bottom_margin = Cm(1.8)

    # title
    tp = doc.add_paragraph()
    tp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    t = tp.add_run("innerprint — the spiral within")
    t.font.name = BODY_FONT
    t.font.size = Pt(22)
    t.font.color.rgb = RGBColor(0x14, 0x10, 0x1A)

    sp = doc.add_paragraph()
    s = sp.add_run("Şeymanur Küçük  ·  2026  ·  data art installation")
    s.font.name = BODY_FONT
    s.font.size = Pt(10)
    s.font.color.rgb = RGBColor(0x70, 0x60, 0x70)
    sp.paragraph_format.space_after = Pt(10)

    # overview
    heading(doc, "Overview", 1)
    para(doc,
        "266 days of personal data — Spotify listening, Istanbul weather, "
        "Apple Health steps, iOS Screen Time — rendered as a walkable "
        "fingerprint spiral. One entry on the outer edge, one path to the "
        "centre. Each day is one segment of the wall. Time runs from "
        "outside (2025-08-26) inward to the centre (today). "
        "Aesthetic reference: Damon Xart's gradient corridors."
    )

    # data inventory
    heading(doc, "Data inventory (2025-08-26 → 2026-05-18, 266 days)", 1)
    bullet(doc, "Spotify — 16,874 streams in window; daily aggregates + per-day top track and its album.")
    bullet(doc, "Weather — Istanbul daily archive (temperature, rain, snow, sunshine) from Open-Meteo.")
    bullet(doc, "Steps — daily totals from Apple Health export.")
    bullet(doc, "Screen Time — iOS Screen Time real values 2026-04-19 → 2026-05-18 (30 days), narrative mock for the earlier 236 days; provenance recorded in data/mock_metadata.json.")

    # annotation table
    heading(doc, "Data annotation", 1)
    para(doc,
        "Each daily row produces one segment of the spiral. The wall is a "
        "vertical gradient between two anchors (bottom = album; top = sky). "
        "The corridor's shape, the floor's luminosity, and the heavy-screen "
        "darkening / glitch layer all key off other fields."
    )

    rows = [
        [
            "Top song's album signature colour",
            "spotify_history.csv → most-played track of the day → album → curated hex",
            "Bottom anchor (warm)",
            "The day's musical identity",
        ],
        [
            "Temperature, sun, rain, snow",
            "Open-Meteo Istanbul archive",
            "Top anchor + ceiling",
            "What the sky looked like",
        ],
        [
            "Sunshine hours",
            "Open-Meteo",
            "Top anchor brightness",
            "How much light reached the corridor",
        ],
        [
            "Screen time, total minutes",
            "iOS Screen Time + mock for prior months",
            "Corridor width + wall height + darkening + glitch",
            "Pressure and agitation from devices",
        ],
        [
            "Screen time, sub-categories",
            "iOS Screen Time (productivity / social / entertainment / other)",
            "HUD bar chart (top-left)",
            "How the day's screen time was spent",
        ],
        [
            "Daily steps",
            "Apple Health export",
            "Floor luminosity + ±10% corridor width",
            "Bodily presence in the world",
        ],
        [
            "Late-night streams",
            "spotify_history.csv (hour of day)",
            "Reserved — ceiling darkness, next iteration",
            "Nocturnal listening",
        ],
    ]
    table(
        doc,
        headers=["Data", "Source", "Applied as", "Expresses"],
        rows=rows,
        col_widths=[4.0, 5.0, 4.0, 4.0],
    )

    # decision notes
    heading(doc, "Decision notes", 1)
    bullet(doc,
        "Album signature colour. Not the cover's dominant pixel — the colour a fan "
        "associates with the album. 134 unique albums; signatures picked by 5 parallel "
        "AI agents inspecting cover art + music knowledge (RAM → metallic gold, "
        "OK Computer → ice-blue, The Strokes' New Abnormal → magenta)."
    )
    bullet(doc,
        "Weather colour map. Literal: hot sunny → amber, cool sunny → sky-blue, "
        "overcast → grey-blue, rainy → grey, heavy rain → near-black, snow → ice-blue. "
        "All transitions RGB-lerped so hues never pass through green."
    )
    bullet(doc,
        "Screen-time mapping. The dominant driver. Drives geometry (corridor width "
        "1.24 m → 3.20 m, wall height 2.8 m → 4.9 m), brightness (up to −44% on peak "
        "days), and motion (±32% jitter + occasional black-out bursts). Quiet days "
        "the wall breathes; heavy days it darkens and twitches."
    )
    bullet(doc,
        "Step mapping. Floor-only effect. Active days pool light beneath you in the "
        "album's colour; sedentary days leave the floor near-black. A ±10% width "
        "modifier reinforces the bodily reading without competing with screen time."
    )
    bullet(doc,
        "Mock screen time. Only because iOS Screen Time didn't track the earlier 7.5 "
        "months. Shape follows the lived arc — high Aug–Dec (project crunch), valley "
        "Dec–Feb (winter break), rising ramp Feb–Apr. Deterministic, seeded, reproducible."
    )

    # structure
    heading(doc, "Structure and mechanics", 1)
    bullet(doc, "Archimedean spiral: 5 turns, outer radius 18 m, inner radius 2.5 m, 0.18 m organic wobble for fingerprint-like irregularity.")
    bullet(doc, "Two walls (2 m corridor base width), floor, ceiling. Per-day vertex attributes feed all visual layers.")
    bullet(doc, "Walk camera at 1.62 m eye height; orbit camera for sculptural view. V key toggles.")
    bullet(doc, "Stack: React 18 + react-three-fiber + Three.js + Vite. Custom GLSL shaders for the wall layers.")
    bullet(doc, "Audio: Spotify Web Playback SDK (PKCE flow). The current day's top track is searched, then started at its loudest section via audio-analysis (defaults to chorus).")

    # controls
    heading(doc, "Controls", 2)
    table(
        doc,
        headers=["Key", "Action"],
        rows=[
            ["V", "toggle orbit / walk"],
            ["↑ ↓  /  W  S", "walk forward / back along time"],
            ["← →  /  A  D", "glance sideways"],
            ["J", "jump to a specific date"],
            ["P", "play current day's song from chorus"],
            ["Shift + P", "play from the start"],
        ],
        col_widths=[3.5, 12.0],
    )

    # repo
    heading(doc, "Repository", 1)
    lp = doc.add_paragraph()
    hyperlink(lp, REPO_URL, REPO_URL)
    lp.paragraph_format.space_after = Pt(4)

    bullet(doc, "data/processed/ — daily joined table (innerprint_daily.csv / .json), per-source CSVs, album signature palette")
    bullet(doc, "data/agent_batches/ — AI agent inputs and outputs for the album signature colour pass")
    bullet(doc, "scripts/ — weather backfill, screen-time mock, top-song aggregation, merge, this manifesto generator")
    bullet(doc, "art/ — Vite + React + Three.js application")
    bullet(doc, ".github/workflows/deploy.yml — GitHub Pages auto-deploy")

    doc.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
