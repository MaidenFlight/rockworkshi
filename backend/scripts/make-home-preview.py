"""Builds the homepage's silent player preview from a song's chart and its local stems.

Usage: python scripts/make-home-preview.py <chart.json> <stems folder> <section> <first bar> <bars> <out.json>
  e.g. python scripts/make-home-preview.py charts/have-you-ever-seen-the-rain.json \\
         "../Music/Song1_CCR_Have_you_ever_seen_the_Rain" "Chorus 1" 1 8 ../frontend/lib/preview/rain-chorus.json

Writes a few bars of the chart (chords, plus any finished bass and drum parts) with times starting
at 0, and a waveform outline for each stem over the same bars. No audio is written: the outlines
are loudness only, so the preview stays silent and the stems never leave this machine.
Needs ffmpeg on the PATH.
"""

import array
import json
import pathlib
import re
import subprocess
import sys

BUCKETS = 480  # min/max pairs per lane, plenty for a lane under 1200px wide
RATE = 11025
PARTS = ["Vocals", "Guitar", "Keys", "Bass", "Drums"]


def part_from_file_name(name):
    # Mirrors partFromFileName in src/lib/songTracks.js.
    name = name.lower()
    if not re.search(r"only|isolated|stem", name):
        return None
    for pattern, part in [(r"vocal|voice", "Vocals"), (r"guitar", "Guitar"), (r"key|piano|organ|synth", "Keys"), (r"bass", "Bass"), (r"drum", "Drums")]:
        if re.search(pattern, name):
            return part
    return None


def outline(path, start, seconds):
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-ss", f"{start:.3f}", "-t", f"{seconds:.3f}", "-i", str(path),
         "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    samples = array.array("f", raw)
    per = max(1, len(samples) // BUCKETS)
    data = []
    for b in range(0, len(samples), per):
        chunk = samples[b:b + per]
        data += [round(min(0.0, min(chunk)), 2), round(max(0.0, max(chunk)), 2)]
    return {"count": len(data) // 2, "seconds": round(seconds, 3), "data": data}


def main():
    chart_path, stems_dir, section_name, first_bar, bar_count, out_path = sys.argv[1:7]
    first_bar, bar_count = int(first_bar), int(bar_count)
    chart = json.loads(pathlib.Path(chart_path).read_text(encoding="utf8"))

    index = next(i for i, s in enumerate(chart["sections"]) if s["name"] == section_name)
    section = chart["sections"][index]
    bars = section["bars"][first_bar - 1:first_bar - 1 + bar_count]
    assert len(bars) == bar_count, "the section doesn't have that many bars"
    start = bars[0]["time"]
    after = section["bars"][first_bar - 1 + bar_count] if first_bar - 1 + bar_count < len(section["bars"]) else None
    end = after["time"] if after else (chart["sections"][index + 1]["bars"][0]["time"] if index + 1 < len(chart["sections"]) else chart["end"])
    seconds = end - start
    t = lambda v: round(v - start, 3)

    excerpt = {
        "end": t(end),
        "sections": [{
            "name": re.sub(r"\s+\d+$", "", section_name),
            "bars": [{"time": t(b["time"]), "chords": [{"name": c["name"], "time": t(c["time"])} for c in b["chords"]]} for b in bars],
        }],
        "parts": {},
    }
    # Only finished parts, and never the vocal line: a draft isn't something to show the public.
    parts = chart.get("parts", {})
    bass = parts.get("Bass")
    if bass and not bass.get("draft"):
        notes = []
        for n in bass["notes"]:
            if start - 0.01 <= n["time"] < end:
                note = {**n, "time": t(n["time"]), "len": round(min(n["len"], end - n["time"]), 3)}
                notes.append(note)
        excerpt["parts"]["Bass"] = {"draft": False, "notes": notes}
    drums = parts.get("Drums")
    if drums and not drums.get("draft"):
        hits = [{**h, "time": t(h["time"])} for h in drums["hits"] if start - 0.01 <= h["time"] < end]
        swells = [{"time": t(max(c["time"], start)), "end": t(min(c["end"], end))} for c in drums.get("crescendos", []) if c["end"] > start and c["time"] < end]
        excerpt["parts"]["Drums"] = {"draft": False, "hits": hits, **({"crescendos": swells} if swells else {})}

    lanes = {}
    for stem in sorted(pathlib.Path(stems_dir).iterdir()):
        part = part_from_file_name(stem.name)
        if part and stem.suffix.lower() in (".mp3", ".wav", ".m4a", ".flac"):
            lanes[part] = outline(stem, start, seconds)
    lanes = {p: lanes[p] for p in PARTS if p in lanes}

    out = {
        "title": chart.get("title"),
        "artist": chart.get("artist"),
        "excerpt": f"{section_name}, bars {first_bar} to {first_bar + bar_count - 1}",
        "chart": excerpt,
        "lanes": lanes,
    }
    out_file = pathlib.Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(out, separators=(",", ":")), encoding="utf8")
    print(f"{out_file}: {seconds:.2f}s, lanes {list(lanes)}, parts {list(excerpt['parts'])}, {out_file.stat().st_size} bytes")


if __name__ == "__main__":
    main()
