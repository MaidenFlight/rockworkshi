"""Transcribes the bass, drums and vocals from a song's stems into its chord chart file.

Usage: python scripts/transcribe-parts.py <stems folder> charts/<song>.json
Needs ffmpeg on the PATH, and numpy and scipy. Stems are matched by file name, as in
songs:upload. Timing comes from the bars already in the chart, so make the chart first.

A machine's first draft: every part it writes is marked as a draft, which the player tells
students. Have someone who plays the part check it by ear, then remove "draft" from the file.
Save it with: npm run songs:chart -- charts/<song>.json
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import stft

SR = 22050
HOP = 256
STEPS_PER_BAR = 16
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR = [0, 2, 4, 5, 7, 9, 11]


def find_stem(folder, words):
    for name in sorted(os.listdir(folder)):
        if name.lower().endswith(".mp3") and any(w in name.lower() for w in words):
            return os.path.join(folder, name)
    raise SystemExit(f"No stem matching {words} in {folder}")


def load(path):
    out = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32)


def yin(x, fmin, fmax, window, threshold):
    """Pitch per hop in MIDI (NaN when unpitched), and a level per hop."""
    lo, hi = int(SR / fmax), int(SR / fmin) + 1
    frames = max(0, (len(x) - window - hi) // HOP)
    midi = np.full(frames, np.nan)
    level = np.zeros(frames)
    size = 2 * (window + hi)
    for i in range(frames):
        seg = x[i * HOP : i * HOP + window + hi]
        level[i] = np.sqrt(np.mean(seg[:window] ** 2))
        if level[i] < 1e-3:
            continue
        # The difference function from an FFT autocorrelation.
        f = np.fft.rfft(seg, size)
        ac = np.fft.irfft(f * np.conj(np.fft.rfft(seg[:window], size)))[: hi + 1]
        energy = np.cumsum(seg**2)
        e0 = energy[window - 1]
        et = energy[window - 1 : window + hi] - np.concatenate(([0.0], energy[: hi]))
        d = np.maximum(e0 + et - 2 * ac, 0)
        cum = np.cumsum(d[1:]) + 1e-12
        cmnd = np.concatenate(([1.0], d[1:] * np.arange(1, len(d)) / cum))
        below = np.where(cmnd[lo:hi] < threshold)[0]
        if not len(below):
            continue
        t = lo + below[0]
        while t + 1 < hi and cmnd[t + 1] < cmnd[t]:
            t += 1
        # Parabolic refinement of the period.
        a, b, c = cmnd[t - 1], cmnd[t], cmnd[t + 1]
        shift = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) else 0
        midi[i] = 69 + 12 * np.log2(SR / (t + shift) / 440)
    return midi, level


def amplitude_at(seg, midi):
    freq = 440 * 2 ** ((midi - 69) / 12)
    t = np.arange(len(seg)) / SR
    return abs(np.sum(seg * np.hanning(len(seg)) * np.exp(-2j * np.pi * freq * t))) / len(seg)


class Song:
    """The chart's bars as a grid of steps, and which bars play the same role."""

    def __init__(self, chart):
        self.bars = [(s["name"], i, b) for s in chart["sections"] for i, b in enumerate(s["bars"])]
        times = [b["time"] for _, _, b in self.bars] + [chart["end"]]
        self.times = times
        steps = []
        for a, b in zip(times[:-1], times[1:]):
            steps += [a + (b - a) * i / STEPS_PER_BAR for i in range(STEPS_PER_BAR)]
        steps.append(times[-1])
        self.steps = np.array(steps)
        roots = [c["name"].split("/")[0] for _, _, b in self.bars for c in b["chords"]]
        self.key = self.find_key(roots)

    @staticmethod
    def find_key(chords):
        def fits(tonic):
            scale = {(tonic + n) % 12 for n in MAJOR}
            return sum(NAMES.index(c.rstrip("m")) in scale for c in chords) + chords.count(NAMES[tonic])

        return max(range(12), key=fits)

    def in_key(self, midi):
        return (midi - self.key) % 12 in MAJOR

    def family(self, k):
        name, _, bar = self.bars[k]
        return (name.split(" ")[0], "/".join(c["name"] for c in bar["chords"]))

    def voters(self):
        groups = {}
        for k in range(len(self.bars)):
            groups.setdefault(self.family(k), []).append(k)
        return groups


def merge_steps(slots, song, attacks=None, attack_needed=4.0):
    """Joins steps of the same pitch into one note, unless it's clearly played again."""
    out = []
    for i, pitch in enumerate(slots):
        if pitch is None:
            continue
        last = out[-1] if out else None
        again = attacks is not None and attacks[i] >= attack_needed
        if last and last["end"] == i and last["midi"] == pitch and not again:
            last["end"] = i + 1
        else:
            out.append({"start": i, "end": i + 1, "midi": pitch})
    steps = song.steps
    return [
        {"time": round(float(steps[n["start"]]), 3), "len": round(float(steps[n["end"]] - steps[n["start"]]), 3), "midi": n["midi"]}
        for n in out
    ]


def transcribe_bass(x, song):
    steps = song.steps
    midi, level = yin(x, 36, 330, 2048, 0.25)
    db = 20 * np.log10(level + 1e-4)
    rise = np.zeros(len(db))
    rise[4:] = np.maximum(db[4:] - db[:-4], 0)
    fr = SR / HOP
    quiet = np.percentile(level[level > 1e-3], 30) * 0.5
    slots, attacks = [], []
    for i in range(len(steps) - 1):
        a = min(int(steps[i] * fr), len(midi) - 1)
        b = min(max(int(steps[i + 1] * fr), a + 1), len(midi))
        # Skip the attack itself, where the pitch isn't settled yet.
        span = midi[a + (b - a) // 3 : b]
        span = span[~np.isnan(span)]
        pitch = int(round(np.median(span))) if len(span) >= 2 and np.median(level[a:b]) > quiet else None
        if pitch is not None:
            # A note with hardly any energy at its own pitch was read an octave too low.
            seg = x[int(steps[i] * SR) : int(steps[i + 1] * SR)]
            while len(seg) > 256 and amplitude_at(seg, pitch) < 0.2 * amplitude_at(seg, pitch + 12) and pitch < 48:
                pitch += 12
        slots.append(pitch)
        attacks.append(rise[max(0, a - 3) : min(len(rise), a + 5)].max())

    # A note out of key is usually a slide or an unsettled attack. Where bars playing the same
    # role agree on an in-key note for that step, use it. Otherwise hold the previous note.
    voters = song.voters()
    for k in range(len(song.bars)):
        for s in range(STEPS_PER_BAR):
            i = k * STEPS_PER_BAR + s
            if slots[i] is None or song.in_key(slots[i]):
                continue
            votes = [slots[v * STEPS_PER_BAR + s] for v in voters[song.family(k)] if v != k]
            votes = [p for p in votes if p is not None and song.in_key(p)]
            if votes and votes.count(max(set(votes), key=votes.count)) >= max(2, len(votes) // 2):
                slots[i] = max(set(votes), key=votes.count)
            else:
                slots[i] = slots[i - 1] if i else None
    return merge_steps(slots, song, attacks, attack_needed=4.0)


def transcribe_vocals(x, song):
    steps = song.steps
    midi, level = yin(x, 110, 900, 1024, 0.25)
    fr = SR / HOP
    voiced = level[level > 1e-3]
    quiet = np.percentile(voiced, 30)
    midi = np.where(level > quiet * 0.5, midi, np.nan)
    filled = np.where(np.isnan(midi), 0.0, midi)
    smooth = median_filter(filled, size=9)
    smooth[smooth < 1] = np.nan
    # Each sung syllable starts with a jump in level, which tells repeated notes apart.
    db = 20 * np.log10(level + 1e-4)
    jump = np.zeros(len(db))
    jump[3:] = np.maximum(db[3:] - db[:-3], 0)
    raw, attacks = [], []
    for i in range(len(steps) - 1):
        a = min(int(steps[i] * fr), len(smooth) - 1)
        b = min(max(int(steps[i + 1] * fr), a + 1), len(smooth))
        span = smooth[a:b]
        got = span[~np.isnan(span)]
        raw.append(float(np.median(got)) if len(got) >= max(2, 0.5 * len(span)) else None)
        attacks.append(jump[max(0, a - 2) : min(len(jump), a + 4)].max())

    # Octave slips: bring each step within reach of the phrase around it, then the singer's range.
    known = [p for p in raw if p is not None]
    centre = float(np.median(known))
    folded = []
    for i, p in enumerate(raw):
        if p is None:
            folded.append(None)
            continue
        near = [q for q in raw[max(0, i - 8) : i + 9] if q is not None]
        local = float(np.median(near))
        while p - local > 8:
            p -= 12
        while local - p > 8:
            p += 12
        folded.append(p)
    # Then into the range the part mostly sits in. The outer notes are the slips.
    settled = [p for p in folded if p is not None]
    low, high = np.percentile(settled, 5) - 3, np.percentile(settled, 95) + 1
    for i, p in enumerate(folded):
        if p is None:
            continue
        while p > high and p - 12 >= low:
            p -= 12
        while p < low and p + 12 <= high:
            p += 12
        folded[i] = p

    # To the nearest note of the key. Fogerty's slides and blue notes fall between, and a learner
    # needs the note he's heading for. Marked as simplified on the page.
    scale = sorted(n for n in range(36, 90) if song.in_key(n))
    slots = [None if p is None else min(scale, key=lambda n: abs(n - p)) for p in folded]

    # A one-step note is a scoop into the next note, or a tail off the last one.
    for i in range(len(slots)):
        p = slots[i]
        if p is None:
            continue
        before = slots[i - 1] if i else None
        after = slots[i + 1] if i + 1 < len(slots) else None
        if p != before and p != after:
            if after is not None and abs(after - p) <= 4:
                slots[i] = after
            elif before is not None and abs(before - p) <= 4:
                slots[i] = before
            else:
                slots[i] = None
    # Close one-step breaths inside a held note.
    for i in range(1, len(slots) - 1):
        if slots[i] is None and slots[i - 1] is not None and slots[i - 1] == slots[i + 1]:
            slots[i] = slots[i - 1]
    return merge_steps(slots, song, attacks, attack_needed=5.0)


def transcribe_drums(x, song):
    steps = song.steps
    hop = 128
    f, _, z = stft(x, SR, nperseg=1024, noverlap=1024 - hop, boundary=None)
    power = np.abs(z)
    fr = SR / hop

    def rise(lo, hi):
        env = np.sqrt((power[(f >= lo) & (f < hi)] ** 2).sum(axis=0))
        vals = []
        for s in steps[:-1]:
            a = int(s * fr)
            if a >= len(env):
                vals.append(0.0)
                continue
            vals.append(max(0.0, env[a : a + 8].max() - env[max(0, a - 6) : max(1, a - 1)].mean()))
        vals = np.array(vals)
        return vals / np.percentile(vals, 99)

    # Measured on this kind of stem: kick is the only thing in the sub band, the snare is strong
    # across the mids where the kick is only half as loud, and hats are all that's left up top.
    sub, lomid, himid, top = rise(30, 90), rise(180, 500), rise(1500, 5000), rise(6500, 11000)
    kick = sub >= 0.45
    # A hit with no kick under it needs less to count as a snare.
    snare = ((lomid >= 0.6) & (himid >= 0.55)) | ((sub < 0.45) & (lomid >= 0.4) & (himid >= 0.4))
    hat = top >= 0.07

    # Cymbal wash hides some hat hits. A section that plays a steady hat on a step plays it
    # throughout, so fill those in, and ignore stray high hits away from the eighth notes.
    families = {}
    for k, (name, _, _) in enumerate(song.bars):
        families.setdefault(name, []).append(k)
    for bars in families.values():
        for s in range(STEPS_PER_BAR):
            where = [k * STEPS_PER_BAR + s for k in bars]
            if s % 2:
                hat[where] = False
            elif hat[where].mean() >= 0.4:
                # Only in bars where the kit is actually being played, not over a final ring.
                for k in bars:
                    played = kick[k * STEPS_PER_BAR : (k + 1) * STEPS_PER_BAR].sum() + snare[k * STEPS_PER_BAR : (k + 1) * STEPS_PER_BAR].sum()
                    hat[k * STEPS_PER_BAR + s] = played >= 3

    hits = []
    for i in range(len(steps) - 1):
        t = round(float(steps[i]), 3)
        if hat[i]:
            hits.append({"time": t, "drum": "hat"})
        if kick[i]:
            hits.append({"time": t, "drum": "kick"})
        if snare[i]:
            hits.append({"time": t, "drum": "snare"})
    return hits


def name_of(midi):
    return f"{NAMES[midi % 12]}{midi // 12 - 1}"


def report(song, parts):
    t = song.times

    def in_bar(items, k):
        return [n for n in items if t[k] - 0.001 <= n["time"] < t[k + 1] - 0.001]

    def line(items, k):
        return " ".join(name_of(n["midi"]) for n in in_bar(items, k))

    for title, part in (("BASS", "Bass"), ("VOCALS", "Vocals")):
        print(f"\n{title} by bar")
        for k, (s, i, b) in enumerate(song.bars):
            print(f"{s[:8]:<8} {i + 1:>2} {'/'.join(c['name'] for c in b['chords']):<9} {line(parts[part]['notes'], k)}")
    print("\nDRUMS by bar (16 steps; K kick, S snare, h hat, o half-open hat, c crash, B kick and snare)")
    for k, (s, i, b) in enumerate(song.bars):
        row = ["."] * STEPS_PER_BAR
        for h in in_bar(parts["Drums"]["hits"], k):
            step = min(int(round((h["time"] - t[k]) / (t[k + 1] - t[k]) * STEPS_PER_BAR)), STEPS_PER_BAR - 1)
            mark = {"kick": "K", "snare": "S", "hat": "h", "open": "o", "crash": "c"}[h["drum"]]
            if mark in "hoc":
                row[step] = mark if row[step] == "." else row[step]
            else:
                row[step] = mark if row[step] in (".", "h", "o", "c") else "B"
        print(f"{s[:8]:<8} {i + 1:>2} {''.join(row)}")

    # Checks that don't depend on the transcription's own method.
    notes = parts["Bass"]["notes"]
    chord_starts = [(c["time"], c["name"]) for _, _, b in song.bars for c in b["chords"]]
    root_ok = root_all = 0
    for time, name in chord_starts:
        root = NAMES.index(name.split("/")[-1].rstrip("m"))
        here = [n for n in notes if abs(n["time"] - time) < 0.06]
        if here:
            root_all += 1
            root_ok += here[0]["midi"] % 12 == root
    print(f"\nbass plays the chart's bass note when a chord starts: {root_ok}/{root_all}")
    v = parts["Vocals"]["notes"]
    print(f"vocal notes: {len(v)}, range {name_of(min(n['midi'] for n in v))} to {name_of(max(n['midi'] for n in v))}")

    def sequence(section, first, count):
        idx = [k for k, (s, i, _) in enumerate(song.bars) if s == section and first <= i < first + count]
        return [name_of(n["midi"]) for k in idx for n in in_bar(v, k)]

    pairs = [("Chorus 1", 0, "Chorus 1", 4), ("Chorus 1", 0, "Chorus 2", 0), ("Chorus 2", 0, "Chorus 3", 0), ("Verse 1", 0, "Verse 2", 0), ("Verse 1", 8, "Verse 2", 8)]
    from difflib import SequenceMatcher

    for a, ai, b, bi in pairs:
        n = 8 if a.startswith("Verse") else 4
        r = SequenceMatcher(None, sequence(a, ai, n), sequence(b, bi, n)).ratio()
        print(f"melody match {a} bar {ai + 1} vs {b} bar {bi + 1}: {r:.0%}")
    drums = parts["Drums"]["hits"]
    for section, want in (("Verse", {"kick": (0, 6, 8), "snare": (4, 12)}), ("Chorus", {"kick": (0, 6, 8), "snare": (4, 12)})):
        idx = [k for k, (s, _, _) in enumerate(song.bars) if s.startswith(section)]
        for drum, places in want.items():
            found = total = 0
            for k in idx:
                got = {int(round((h["time"] - t[k]) / (t[k + 1] - t[k]) * STEPS_PER_BAR)) for h in in_bar(drums, k) if h["drum"] == drum}
                total += len(places)
                found += sum(p in got for p in places)
            print(f"{section} {drum} on steps {places}: {found}/{total}")


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    folder, chart_path = sys.argv[1], sys.argv[2]
    with open(chart_path, encoding="utf-8") as f:
        chart = json.load(f)
    song = Song(chart)
    parts = {
        "Bass": {"draft": True, "notes": transcribe_bass(load(find_stem(folder, ["bass"])), song)},
        "Drums": {"draft": True, "hits": transcribe_drums(load(find_stem(folder, ["drum"])), song)},
        "Vocals": {"draft": True, "notes": transcribe_vocals(load(find_stem(folder, ["vocal"])), song)},
    }
    # A part that's no longer a draft has been checked or written by a person: keep it.
    for name, part in (chart.get("parts") or {}).items():
        if not part.get("draft", True):
            print(f"Keeping the checked {name} part.")
            parts[name] = part
    chart["parts"] = parts
    with open(chart_path, "w", encoding="utf-8", newline="") as f:
        json.dump(chart, f, indent=1)
        f.write("\n")
    print("key", NAMES[song.key], {k: len(v.get("notes", v.get("hits"))) for k, v in parts.items()})
    report(song, parts)


if __name__ == "__main__":
    main()
