"use client";

import { useEffect, useState } from "react";
import Fretboard from "./Fretboard";
import Keyboard from "./Keyboard";
import { Notes, PlayedIn, RootPicker, Seg, Speaker, StopMark } from "./Pickers";
import { mod12, noteName, useLibrary } from "@/lib/library";
import { playSequence, stopAll } from "@/lib/audio/referenceTones";
import s from "./library.module.css";

const TIERS = [
  { id: "start", name: "Start with" },
  { id: "next", name: "Next" },
  { id: "more", name: "More colours" },
];

// The note a blues scale adds to its pentatonic, drawn in lagoon.
const BLUE = { blues: "b5", "major-blues": "b3" };

export default function ScalesTab({ overview, root, scaleId, onScale, scope }) {
  const { data: forRoot, error } = useLibrary(`/scales/${root}`, scope);

  useEffect(() => stopAll, []);

  const scale = forRoot ? forRoot.scales.find((x) => x.id === scaleId) || forRoot.scales[0] : null;
  const meta = overview.scales.find((x) => x.id === (scale?.id || scaleId)) || overview.scales[0];

  return (
    <div>
      <span className={s.label}>Root</span>
      <RootPicker roots={overview.roots} value={root} onChange={(pc) => onScale(pc, meta.id)} />
      <div className={s.types}>
        {TIERS.map((tier) => (
          <div key={tier.id} className={s.group}>
            <p className={s.groupName}>{tier.name}</p>
            <div className={s.row}>
              {overview.scales
                .filter((x) => x.tier === tier.id)
                .map((x) => (
                  <button key={x.id} type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={x.id === meta.id} onClick={() => onScale(root, x.id)}>
                    {x.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className={s.muted} role="alert">{error.message}</p>}
      {!scale && !error && <p className={s.muted}>Loading scales…</p>}
      {scale && <ScaleDetail key={`${root}-${scale.id}`} scale={scale} meta={meta} overview={overview} />}
    </div>
  );
}

function ScaleDetail({ scale, meta, overview }) {
  const { kind } = overview;
  return (
    <article aria-labelledby="scale-name">
      <header className={s.head}>
        <div>
          <h2 id="scale-name" className={s.name}>
            {scale.name}
          </h2>
          <p className={s.fullName}>
            Steps: {meta.steps.join(" ")} <span className={s.muted}>(W a whole step, H a half step)</span>
          </p>
          <Notes notes={scale.notes} sub={(n) => (kind === "voice" ? n.solfege : n.interval === "1" ? "R" : n.interval)} />
          <p className={s.about}>{meta.about}</p>
          <p className={s.about}>
            <strong>Use it over:</strong> {meta.over}
          </p>
          <PlayedIn songs={scale.songs}>
            {(song) =>
              song.relative
                ? `It fits ${song.title}, which is in ${song.key}: the same notes, started from ${scale.rootName}.`
                : `It fits ${song.title}, which is in ${song.key}.`
            }
          </PlayedIn>
        </div>
      </header>
      {(kind === "fretted" || kind === "bass") && <NeckView scale={scale} overview={overview} />}
      {kind === "keys" && <PianoScale scale={scale} />}
      {kind === "voice" && <VoiceScale scale={scale} />}
    </article>
  );
}

function NeckView({ scale, overview }) {
  const { tuning } = overview;
  const [position, setPosition] = useState(0);
  const [label, setLabel] = useState("intervals");
  const [playing, setPlaying] = useState(false);
  const blue = BLUE[scale.id];
  const chosen = position === -1 ? null : scale.positions[position];
  const inBox = new Set((chosen?.dots || []).map(([st, f]) => `${st}:${f}`));
  const to = Math.max(tuning.frets, ...(chosen?.dots || []).map(([, f]) => f));

  const dots = [];
  tuning.midi.forEach((open, string) => {
    for (let fret = 0; fret <= to; fret++) {
      const k = scale.notes.findIndex((n) => n.pc === mod12(open + fret));
      if (k === -1) continue;
      const note = scale.notes[k];
      const lit = !chosen || inBox.has(`${string}:${fret}`);
      dots.push({
        string,
        fret,
        text: label === "notes" ? note.name : note.interval === "1" ? "R" : note.interval,
        tone: !lit ? "dim" : note.interval === "1" ? "root" : note.interval === blue ? "blue" : "note",
      });
    }
  });

  const hear = () => {
    if (playing) {
      stopAll();
      setPlaying(false);
      return;
    }
    const source = chosen || scale.positions[0];
    const up = [...new Set(source.dots.map(([st, f]) => tuning.midi[st] + f))].sort((a, b) => a - b);
    setPlaying(true);
    playSequence([...up, ...up.slice(0, -1).reverse()], { sound: "pluck", bpm: 132, onEnd: () => setPlaying(false) });
  };

  return (
    <section aria-label="On the neck">
      <div className={s.toolbar}>
        <div>
          <span className={s.label} style={{ margin: 0 }}>
            Show
          </span>
          <div className={s.row}>
            {scale.positions.map((p, i) => (
              <button key={p.label} type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={position === i} onClick={() => setPosition(i)} title={p.label}>
                {p.label.split(" · ")[0].replace("Root on the ", "").replace("From the root on the ", "")}
              </button>
            ))}
            <button type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={position === -1} onClick={() => setPosition(-1)}>
              Whole neck
            </button>
          </div>
        </div>
        <div>
          <span className={s.label} style={{ margin: 0 }}>
            Dots show
          </span>
          <Seg
            label="Dots show"
            options={[
              { id: "intervals", label: "Intervals" },
              { id: "notes", label: "Notes" },
            ]}
            value={label}
            onChange={setLabel}
          />
        </div>
        <button type="button" className={s.play} aria-pressed={playing} onClick={hear}>
          {playing ? <StopMark /> : <Speaker />} {playing ? "Stop" : "Hear it"}
        </button>
      </div>
      <div className={s.neck}>
        <p className={s.cardTitle} style={{ textAlign: "left", marginBottom: 10 }}>
          {chosen ? chosen.label : `Every ${scale.rootName} note of the scale, open string to fret ${to}`}
        </p>
        <div className={s.scroll}>
          <Fretboard tuning={tuning} from={0} to={to} dots={dots} title={`${scale.name}${chosen ? `, ${chosen.label}` : ", whole neck"}`} />
        </div>
        <ul className={s.legend}>
          <li>
            <span className={s.swatch} style={{ background: "var(--rw-orange)" }} /> Root ({scale.rootName})
          </li>
          <li>
            <span className={s.swatch} /> Scale note
          </li>
          {blue && (
            <li>
              <span className={s.swatch} style={{ background: "var(--rw-teal)" }} /> Blue note ({scale.notes.find((n) => n.interval === blue)?.name})
            </li>
          )}
          {chosen && (
            <li>
              <span className={s.swatch} style={{ background: "var(--rw-surface)", border: "1px solid var(--rw-line)" }} /> Outside this position
            </li>
          )}
        </ul>
        {overview.instrument === "Ukulele" && <p className={s.muted}>A ukulele&apos;s G string is tuned high, so play the scale up from the C string.</p>}
      </div>
    </section>
  );
}

function PianoScale({ scale }) {
  const { right, left, fingers } = scale.piano;
  const spelled = new Map(scale.notes.map((n) => [n.pc, n.name]));
  const marks = new Map(right.map((m, i) => [m, { hand: "right", text: noteName(m, spelled), finger: fingers?.right[i] }]));
  const [playing, setPlaying] = useState(false);
  const hear = () => {
    if (playing) {
      stopAll();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    playSequence([...right, ...right.slice(0, -1).reverse()], { bpm: 120, onEnd: () => setPlaying(false) });
  };
  return (
    <section className={s.neck} aria-label="On the keyboard">
      <div className={s.toolbar}>
        <p className={s.cardTitle} style={{ textAlign: "left" }}>
          Right hand, one octave up from {scale.rootName}
        </p>
        <button type="button" className={s.play} aria-pressed={playing} onClick={hear}>
          {playing ? <StopMark /> : <Speaker />} {playing ? "Stop" : "Hear it"}
        </button>
      </div>
      <div className={s.scroll}>
        <Keyboard marks={marks} title={`${scale.name}, right hand`} />
      </div>
      {fingers ? (
        <p className={s.about} style={{ marginTop: 12 }}>
          <strong>Right hand:</strong> {fingers.right.join(" ")} · <strong>Left hand</strong> (an octave lower): {fingers.left.join(" ")}. The numbers are fingers, thumb as 1, going up. Teachers vary, and these
          keep both thumbs off the black keys.
        </p>
      ) : (
        <p className={s.about} style={{ marginTop: 12 }}>
          There&apos;s no one standard fingering for this scale. Keep your thumb on the white keys and cross it under after a group of two or three fingers. Left hand: {left.map((m) => noteName(m, spelled)).join(" ")}.
        </p>
      )}
    </section>
  );
}

function VoiceScale({ scale }) {
  const [range, setRange] = useState("low");
  const [at, setAt] = useState(-1);
  const run = scale.voice.up[range];
  const spelled = new Map(scale.notes.map((n) => [n.pc, n.name]));
  const marks = new Map(run.slice(0, scale.notes.length + 1).map((m) => [m, { hand: "lit", text: noteName(m, spelled) }]));
  const syllables = [...scale.voice.syllables, ...scale.voice.syllables.slice(0, -1).reverse()];
  const toggle = () => {
    if (at >= 0) {
      stopAll();
      setAt(-1);
    } else {
      playSequence(run, { bpm: 84, onNote: setAt, onEnd: () => setAt(-1) });
    }
  };
  return (
    <section className={s.neck} aria-label="Sing it">
      <div className={s.toolbar}>
        <Seg
          label="Voice range"
          options={[
            { id: "low", label: "Lower voice" },
            { id: "high", label: "Higher voice" },
          ]}
          value={range}
          onChange={setRange}
        />
        <button type="button" className={s.play} aria-pressed={at >= 0} onClick={toggle}>
          {at >= 0 ? <StopMark /> : <Speaker />} {at >= 0 ? "Stop" : "Sing along"}
        </button>
      </div>
      <div className={s.scroll}>
        <Keyboard marks={marks} title={`${scale.name} to sing`} />
      </div>
      <p className={s.about} style={{ marginTop: 12 }} aria-live="polite">
        {syllables.map((syl, i) => (
          <span key={i} style={{ fontWeight: i === at ? 800 : 400, color: i === at ? "var(--rw-orange-deep)" : undefined }}>
            {syl}
            {i < syllables.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
      <p className={s.muted}>Sing each syllable with the note, up and back down. Do is {scale.rootName} here; it moves with the key.</p>
    </section>
  );
}
