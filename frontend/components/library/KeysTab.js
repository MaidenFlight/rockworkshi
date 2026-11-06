"use client";

import { useEffect, useState } from "react";
import { RootPicker, Seg, Speaker, StopMark } from "./Pickers";
import { mod12, simpleVoicing, chordIdOf } from "@/lib/library";
import { playProgression, stopAll } from "@/lib/audio/referenceTones";
import s from "./library.module.css";

// The chords of a key, the progressions everyone plays, and the twelve-bar blues, all in any key.
// Every chord opens in the Chords tab, voiced for the member's own instrument.
export default function KeysTab({ overview, keyName, onKey, onChord }) {
  const [tonic, mode] = parseKey(keyName);
  const key = overview.keys.find((k) => k.tonic === tonic && k.mode === mode);
  const [sevenths, setSevenths] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [lit, setLit] = useState(-1);

  useEffect(() => stopAll, []);

  const play = (id, ids, beats = 2) => {
    if (playing === id) {
      stopAll();
      setPlaying(null);
      setLit(-1);
      return;
    }
    setPlaying(id);
    playProgression(
      ids.map((c) => simpleVoicing(c, overview.qualities)),
      {
        bpm: 96,
        beats,
        onChord: setLit,
        onEnd: () => {
          setPlaying(null);
          setLit(-1);
        },
      }
    );
  };

  const songsWith = (progressionId) =>
    overview.songs.filter((song) => song.key?.tonic === tonic && song.key?.mode === mode && song.progressions.some((p) => p.id === progressionId));
  const songsAnyKey = (progressionId) => overview.songs.filter((song) => song.progressions.some((p) => p.id === progressionId));

  const progressions = overview.progressions.filter((p) => p.mode === mode);
  const blues = bluesIn(key, mode);

  return (
    <div>
      <div className={s.toolbar}>
        <div>
          <span className={s.label} style={{ margin: 0 }}>
            Major or minor
          </span>
          <Seg
            label="Major or minor"
            options={[
              { id: "major", label: "Major" },
              { id: "minor", label: "Minor" },
            ]}
            value={mode}
            onChange={(m) => onKey(`${tonic}-${m}`)}
          />
        </div>
        <div>
          <span className={s.label} style={{ margin: 0 }}>
            Chords
          </span>
          <Seg
            label="Chords"
            options={[
              { id: "triads", label: "Three-note" },
              { id: "sevenths", label: "7th chords" },
            ]}
            value={sevenths ? "sevenths" : "triads"}
            onChange={(v) => setSevenths(v === "sevenths")}
          />
        </div>
      </div>
      <span className={s.label}>Key</span>
      <RootPicker roots={overview.roots} value={tonic} onChange={(pc) => onKey(`${pc}-${mode}`)} label="Key" />

      <header className={s.head}>
        <div>
          <h2 className={s.name}>The key of {key.name}</h2>
          <p className={s.about}>
            These seven chords are built from the {key.name} scale, one on each note. The numeral is each chord&apos;s place in the key: capitals are major, small letters minor, ° diminished. Songs in any key use the same numbers, which is how a band can move a song to a new key in seconds.
          </p>
        </div>
      </header>

      <div className={s.keyGrid}>
        {key.chords.map((c) => {
          const [id, name] = sevenths ? c.seventh : c.triad;
          return (
            <button key={c.numeral} type="button" className={s.degree} onClick={() => onChord(id)} aria-label={`${c.numeral}: ${name}. Open in Chords`}>
              <span className={s.numeral}>{c.numeral}</span>
              <span className={s.degreeName}>{name}</span>
            </button>
          );
        })}
      </div>

      <span className={s.label}>Progressions to know</span>
      <ul className={s.list}>
        {progressions.map((p) => {
          const ids = p.steps.map(([step, quality]) => chordIdOf(mod12(tonic + step), quality));
          const names = ids.map((id) => nameOf(id, overview, key));
          const here = songsWith(p.id);
          const elsewhere = songsAnyKey(p.id).filter((song) => !here.includes(song));
          return (
            <li key={p.id} className={s.item}>
              <div className={s.itemHead}>
                {/* Not uppercased: a numeral's case is the chord's quality (vi minor, VI major). */}
                <h3 className={s.itemTitle} style={{ textTransform: "none" }}>
                  {p.name}
                </h3>
                <button type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={playing === p.id} onClick={() => play(p.id, ids)}>
                  {playing === p.id ? <StopMark /> : <Speaker />} {playing === p.id ? "Stop" : "Hear it"}
                </button>
              </div>
              <div className={s.row} style={{ marginBottom: 10 }}>
                {ids.map((id, i) => (
                  <button key={i} type="button" className={s.chordChip} aria-pressed={playing === p.id && lit === i} onClick={() => onChord(id)}>
                    <span className={s.chordChipName}>{names[i]}</span>
                    <span className={s.chordChipSub}>{p.name.split("–")[i]}</span>
                  </button>
                ))}
              </div>
              <p className={s.about} style={{ margin: 0 }}>
                {p.about}
              </p>
              {[...here, ...elsewhere].length > 0 && (
                <p className={s.muted} style={{ margin: "8px 0 0" }}>
                  In our songs:{" "}
                  {[...here, ...elsewhere]
                    .map((song) => {
                      const found = song.progressions.find((x) => x.id === p.id);
                      const where = found.section ? `, ${found.section.toLowerCase()}` : "";
                      return `${song.title} (${song.key.name}${where})`;
                    })
                    .join("; ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {mode === "major" && (
        <>
          <span className={s.label} style={{ marginTop: 32 }}>
            The twelve-bar blues
          </span>
          <div className={s.itemHead}>
            <p className={s.about} style={{ margin: 0 }}>
              Twelve bars of the I, IV and V chords, all played as 7th chords. Rock and roll, blues and a hundred jam sessions run on it.
            </p>
            <button type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={playing === "blues"} onClick={() => play("blues", blues.map((b) => b.id), 4)}>
              {playing === "blues" ? <StopMark /> : <Speaker />} {playing === "blues" ? "Stop" : "Hear it"}
            </button>
          </div>
          <div className={s.bars} style={{ marginTop: 12 }}>
            {blues.map((b, i) => (
              <div key={i} className={`${s.bar} ${playing === "blues" && lit === i ? s.barLit : ""}`}>
                {b.name}
                <span className={s.barNumeral}>{overview.twelveBar[i]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function parseKey(value) {
  const m = /^(\d+)-(major|minor)$/.exec(value || "");
  return m ? [Number(m[1]) % 12, m[2]] : [0, "major"];
}

// A chord's name: from the key's own list when it's in the key, otherwise built from the root.
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SHARPS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
function nameOf(id, overview, key) {
  for (const c of key.chords) {
    if (c.triad[0] === id) return c.triad[1];
    if (c.seventh[0] === id) return c.seventh[1];
  }
  const [root, quality] = id.split(":");
  const q = overview.qualities.find((x) => x.id === quality);
  const minorish = q.intervals.some((i) => i.interval === "b3");
  return (minorish ? SHARPS : FLATS)[Number(root)] + q.suffix;
}

function bluesIn(key, mode) {
  if (mode !== "major") return [];
  const I = key.chords[0].triad[0].split(":")[0];
  const IV = key.chords[3].triad[0].split(":")[0];
  const V = key.chords[4].triad[0].split(":")[0];
  const name = (root) => `${FLATS[Number(root)]}7`;
  const by = { I7: I, IV7: IV, V7: V };
  return ["I7", "I7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"].map((n) => ({ id: `${by[n]}:7`, name: name(by[n]) }));
}
