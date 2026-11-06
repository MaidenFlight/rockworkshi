"use client";

import { useEffect, useMemo, useState } from "react";
import ChordBox from "./ChordBox";
import Fretboard from "./Fretboard";
import Keyboard from "./Keyboard";
import { Notes, PlayedIn, RootPicker, Seg, Speaker } from "./Pickers";
import { intervalsOf, noteName, parseChordId, spellings, useLibrary } from "@/lib/library";
import { playChord, playSequence, stopAll } from "@/lib/audio/referenceTones";
import s from "./library.module.css";

const TIERS = [
  { id: "essentials", name: "Start with" },
  { id: "next", name: "Next" },
  { id: "colour", name: "Colour" },
  { id: "tension", name: "Tension" },
];

const LABELS = {
  fretted: [
    { id: "fingers", label: "Fingers" },
    { id: "notes", label: "Notes" },
    { id: "intervals", label: "Intervals" },
  ],
  bass: [
    { id: "intervals", label: "Intervals" },
    { id: "notes", label: "Notes" },
  ],
};

const HARMONY_NAMES = { b3: "minor 3rd", 3: "3rd", 4: "4th", 2: "2nd", b5: "flat 5th", 5: "5th", "#5": "sharp 5th", 6: "6th", bb7: "diminished 7th", b7: "flat 7th", 7: "major 7th", 9: "9th", "#9": "sharp 9th" };

const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export default function ChordsTab({ overview, chordId, onChord, scope }) {
  const { kind, roots, qualities } = overview;
  const wanted = parseChordId(chordId) || { root: 0, quality: "maj", bass: null };
  const { data: forRoot, error } = useLibrary(`/chords/${wanted.root}`, scope);
  const [label, setLabel] = useState(kind === "bass" ? "intervals" : "fingers");

  useEffect(() => stopAll, []);

  const chord = forRoot ? forRoot.chords.find((c) => c.id === chordId) || forRoot.chords[0] : null;
  const slashes = forRoot ? forRoot.chords.filter((c) => c.bass !== null) : [];

  return (
    <div>
      {overview.start?.length > 0 && (
        <section className={s.start} aria-label="Start here">
          <span className={s.label}>Start here</span>
          <div className={s.row}>
            {overview.start.map((c) => (
              <button key={c.id} type="button" className={s.btn} aria-pressed={c.id === chord?.id} onClick={() => onChord(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <span className={s.label}>Root</span>
      <RootPicker roots={roots} value={wanted.root} onChange={(pc) => onChord(`${pc}:${wanted.quality}`)} />

      <div className={s.types}>
        {TIERS.map((tier) => (
          <div key={tier.id} className={s.group}>
            <p className={s.groupName}>{tier.name}</p>
            <div className={s.row}>
              {qualities
                .filter((q) => q.tier === tier.id)
                .map((q) => {
                  const id = `${wanted.root}:${q.id}`;
                  const name = forRoot?.chords.find((c) => c.id === id)?.name;
                  return (
                    <button key={q.id} type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={chord?.id === id} onClick={() => onChord(id)} title={q.name}>
                      {name || q.name}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        {slashes.length > 0 && (
          <div className={s.group}>
            <p className={s.groupName}>Slash chords</p>
            <div className={s.row}>
              {slashes.map((c) => (
                <button key={c.id} type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={chord?.id === c.id} onClick={() => onChord(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className={s.muted} role="alert">{error.message}</p>}
      {!chord && !error && <p className={s.muted}>Loading chords…</p>}
      {chord && (
        <ChordDetail
          chord={chord}
          plain={forRoot.chords.find((c) => c.root === chord.root && c.quality === chord.quality && c.bass === null)}
          overview={overview}
          label={label}
          setLabel={setLabel}
        />
      )}
    </div>
  );
}

function ChordDetail({ chord, plain, overview, label, setLabel }) {
  const { kind, tuning, qualities, instrument } = overview;
  const quality = qualities.find((q) => q.id === chord.quality);
  const notes = useMemo(() => spellings([...chord.notes, ...(chord.bassNote ? [chord.bassNote] : [])]), [chord]);
  const intervals = useMemo(() => intervalsOf(chord.notes), [chord]);
  const slash = chord.bass !== null;
  const bassName = chord.bassNote?.name;
  // A ukulele has no bass to speak of: a slash chord is played as its chord.
  const shapes = slash && kind === "fretted" && !chord.voicings?.length ? plain?.voicings || [] : chord.voicings || [];

  const fullName = `${chord.notes[0].name} ${quality.name}${slash ? ` with ${bassName} in the bass` : ""}`;

  return (
    <article aria-labelledby="chord-name">
      <header className={s.head}>
        <div>
          <h2 id="chord-name" className={`${s.name} ${s.asWritten}`}>
            {chord.name}
          </h2>
          <p className={s.fullName}>{fullName}</p>
          <Notes notes={chord.notes} />
          <p className={s.about}>{quality.about}</p>
          {slash && (
            <p className={s.about}>
              {kind === "bass"
                ? `The note after the slash is yours: play ${bassName}, and the band plays ${chord.name.split("/")[0]} over it.`
                : instrument === "Ukulele"
                  ? `On ukulele, play ${chord.name.split("/")[0]}: the ${bassName} in the bass belongs to the bass player and the guitar.`
                  : `${chord.name.split("/")[0]} over a ${bassName} bass note${chord.bassNote?.inChord ? ", a chord note moved to the bottom" : ", a note from outside the chord that walks the bass line along"}.`}
            </p>
          )}
          {quality.symmetric && kind === "fretted" && (
            <p className={s.about}>Move any of these shapes up {chord.quality === "aug" ? "four" : "three"} frets and you have the same chord again.</p>
          )}
          <PlayedIn songs={chord.songs}>
            {(song) =>
              song.bars
                ? `${song.title}: ${song.bars} bar${song.bars === 1 ? "" : "s"}, the ${song.numeral} chord, in the ${list(song.sections.map((x) => x.toLowerCase()))}.`
                : `${song.title} uses it, as the ${song.numeral} chord.`
            }
          </PlayedIn>
        </div>
        {LABELS[kind] && (
          <div className={s.headSide}>
            <span className={s.label} style={{ margin: 0 }}>
              Dots show
            </span>
            <Seg label="Dots show" options={LABELS[kind]} value={label} onChange={setLabel} />
          </div>
        )}
      </header>

      {kind === "fretted" && (
        <>
          {!shapes.length && <p className={s.muted}>There&apos;s no diagram for this one yet.</p>}
          <div className={s.cards}>
            {shapes.map((v) => (
              <div key={v.frets.join(",")} className={s.card}>
                <p className={s.cardTitle}>{v.label}</p>
                <ChordBox voicing={v} tuning={tuning} notes={notes} intervals={intervals} label={label} rootPc={chord.root} title={`${chord.name}, ${v.label}`} />
                <p className={s.cardMeta}>{v.midi.map((m) => noteName(m, notes)).join(" ")}</p>
                <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => playChord(v.midi, { sound: "pluck" })}>
                  <Speaker /> Strum
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {kind === "bass" && (
        <div className={`${s.cards} ${s.cardsWide}`}>
          {shapes.map((v) => {
            const from = v.from === 0 ? 0 : Math.max(1, v.from - 1);
            const to = Math.max(v.to + 1, from + 4);
            const dots = v.dots.map((d) => ({
              string: d.string,
              fret: d.fret,
              text: label === "notes" ? noteName(d.midi, notes) : d.interval === "1" ? "R" : d.interval === "bass" ? noteName(d.midi, notes) : d.interval,
              tone: d.interval === "1" || (slash && d.midi === v.midi[0]) ? "root" : "note",
            }));
            return (
              <div key={v.label} className={s.card}>
                <p className={s.cardTitle}>{v.label}</p>
                <div className={s.scroll}>
                  <Fretboard tuning={tuning} from={from} to={to} dots={dots} title={`${chord.name} arpeggio, ${v.label}`} />
                </div>
                <p className={s.cardMeta}>{v.midi.map((m) => noteName(m, notes)).join(" ")}</p>
                <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => playSequence(v.midi, { sound: "pluck", bpm: 150 })}>
                  <Speaker /> Hear the arpeggio
                </button>
              </div>
            );
          })}
        </div>
      )}

      {kind === "keys" && (
        <div className={`${s.cards} ${s.cardsWide}`}>
          {shapes.map((v) => {
            const marks = new Map();
            v.left.forEach((m) => marks.set(m, { hand: "left", text: noteName(m, notes) }));
            v.right.forEach((m, i) => marks.set(m, { hand: "right", text: noteName(m, notes), finger: v.fingers[i] }));
            return (
              <div key={v.label} className={s.card}>
                <p className={s.cardTitle}>{v.label}</p>
                <div className={s.scroll}>
                  <Keyboard marks={marks} title={`${chord.name}, ${v.label}`} />
                </div>
                <p className={s.cardMeta}>
                  Left hand {v.left.map((m) => noteName(m, notes)).join(" ")} · right hand {v.right.map((m) => noteName(m, notes)).join(" ")}, fingers {v.fingers.join("-")}
                </p>
                <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => playChord([...v.left, ...v.right], { sound: "keys" })}>
                  <Speaker /> Play it
                </button>
              </div>
            );
          })}
        </div>
      )}

      {kind === "voice" && chord.voice && <VoiceChord chord={chord} notes={notes} />}
    </article>
  );
}

function VoiceChord({ chord, notes }) {
  const [range, setRange] = useState("low");
  const run = chord.voice.arpeggio[range];
  const marks = new Map(run.map((m) => [m, { hand: "lit", text: noteName(m, notes) }]));
  return (
    <div className={`${s.cards} ${s.cardsWide}`}>
      <div className={s.card}>
        <p className={s.cardTitle}>Sing the arpeggio</p>
        <Seg
          label="Voice range"
          options={[
            { id: "low", label: "Lower voice" },
            { id: "high", label: "Higher voice" },
          ]}
          value={range}
          onChange={setRange}
        />
        <div className={s.scroll}>
          <Keyboard marks={marks} title={`${chord.name} arpeggio to sing`} />
        </div>
        <p className={s.cardMeta}>{run.map((m) => noteName(m, notes)).join(" ")}</p>
        <div className={s.row}>
          <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => playChord(run.slice(0, 3), { sound: "keys" })}>
            <Speaker /> Hear the chord
          </button>
          <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => playSequence(run, { bpm: 76, sound: "keys" })}>
            <Speaker /> Sing along
          </button>
        </div>
      </div>
      <div className={s.card} style={{ alignItems: "flex-start" }}>
        <p className={s.cardTitle} style={{ textAlign: "left" }}>
          Singing harmony
        </p>
        <p className={s.about}>
          Over {chord.name}, the safest harmony notes are the chord&apos;s own:{" "}
          {list([`${chord.notes[0].name} (the root)`, ...chord.voice.harmony.map((h) => `${h.name} (the ${HARMONY_NAMES[h.interval] || h.interval})`)])}. Pick the one nearest the tune and move with it.
        </p>
        <p className={s.about}>Play the chord, hold one of its notes, and listen for it to lock in with the others.</p>
      </div>
    </div>
  );
}
