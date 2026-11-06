"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Speaker, StopMark } from "./Pickers";
import { startLoop, stopAll } from "@/lib/audio/referenceTones";
import s from "./library.module.css";

const TIERS = [
  { id: "start", name: "Start with" },
  { id: "next", name: "Next" },
  { id: "more", name: "Fills and feels" },
];

// Plays one bar on a loop at a tempo the student can change while it runs.
function useLoop() {
  const loop = useRef(null);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  useEffect(
    () => () => {
      loop.current?.stop();
      stopAll();
    },
    []
  );
  const start = (steps, stepSeconds, play) => {
    loop.current = startLoop({ steps, stepSeconds, play, onStep: setStep });
    setPlaying(true);
  };
  const stop = () => {
    loop.current?.stop();
    loop.current = null;
    stopAll();
    setStep(-1);
    setPlaying(false);
  };
  const retime = (stepSeconds) => {
    if (loop.current) loop.current.tempo = stepSeconds;
  };
  return { step, playing, start, stop, retime };
}

function Tempo({ value, onChange }) {
  return (
    <label className={s.tempo}>
      <span className={s.tempoValue}>{value} bpm</span>
      <input type="range" min={40} max={200} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Tempo in beats per minute" />
    </label>
  );
}

function Picker({ items, value, onChange, tiers }) {
  const groups = tiers || [{ id: null, name: null }];
  return (
    <div className={s.types}>
      {groups.map((tier) => (
        <div key={tier.id || "all"} className={s.group}>
          {tier.name && <p className={s.groupName}>{tier.name}</p>}
          <div className={s.row}>
            {items
              .filter((x) => !tier.id || x.tier === tier.id)
              .map((x) => (
                <button key={x.id} type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={x.id === value} onClick={() => onChange(x.id)}>
                  {x.name}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GroovesTab({ overview, grooveId, onGroove }) {
  const { kit, counts, grooves } = overview.drums;
  const groove = grooves.find((g) => g.id === grooveId) || grooves[0];
  return (
    <div>
      <Picker items={grooves} value={groove.id} onChange={onGroove} tiers={TIERS} />
      {/* Keyed, so a new groove starts from rest at its own tempo. */}
      <Groove key={groove.id} groove={groove} kit={kit} counts={counts} />
    </div>
  );
}

function Groove({ groove, kit, counts }) {
  const [tempo, setTempo] = useState(groove.tempo);
  const loop = useLoop();
  const perBeat = groove.steps / 4;

  const toggle = () => {
    if (loop.playing) return loop.stop();
    loop.start(groove.steps, 60 / tempo / perBeat, (step, when, drum) => {
      for (const [row, hits] of Object.entries(groove.rows)) {
        const c = hits[step];
        if (c !== ".") drum(row, when, c === "X" ? 1 : 0.72);
      }
    });
  };
  const changeTempo = (bpm) => {
    setTempo(bpm);
    loop.retime(60 / bpm / perBeat);
  };

  const rows = kit.filter((k) => groove.rows[k.id]);
  return (
    <div>
      <article className={s.head} style={{ display: "block" }} aria-labelledby="groove-name">
        <h2 id="groove-name" className={s.name}>
          {groove.name}
        </h2>
        <p className={s.about} style={{ marginTop: 12 }}>
          {groove.about}
        </p>
        {groove.songs.length > 0 && (
          <div className={s.songs}>
            {groove.songs.map((song) => (
              <p key={song.id}>
                {song.title} is played on this groove.{" "}
                <Link className={s.link} href={`/member/song/${song.id}`}>
                  Practise it
                </Link>
              </p>
            ))}
          </div>
        )}
      </article>
      <div className={s.toolbar}>
        <button type="button" className={s.play} aria-pressed={loop.playing} onClick={toggle}>
          {loop.playing ? <StopMark /> : <Speaker />} {loop.playing ? "Stop" : "Play the groove"}
        </button>
        <Tempo value={tempo} onChange={changeTempo} />
      </div>
      <div className={`${s.neck} ${s.scroll}`}>
        <table className={s.grid} aria-label={`${groove.name}, one bar`}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.name}</th>
                {[...groove.rows[r.id]].map((c, i) => (
                  <td key={i} className={`${i % perBeat === 0 ? s.beat : ""} ${loop.step === i ? s.now : ""}`} aria-label={c === "." ? "rest" : c === "X" ? "accent" : "hit"}>
                    <span className={c === "X" ? s.accent : c === "x" ? s.hit : s.rest} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className={s.counts}>
              <th scope="row">Count</th>
              {counts[groove.steps].map((c, i) => (
                <td key={i} className={loop.step === i ? s.now : ""}>
                  {c}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <ul className={s.legend}>
          <li>
            <span className={s.hit} style={{ width: 12, height: 12 }} /> Hit
          </li>
          <li>
            <span className={s.accent} style={{ width: 14, height: 14 }} /> Accent: hit it harder
          </li>
        </ul>
      </div>
      <p className={s.muted}>Count out loud as it plays. Start slow enough to play it perfectly, then nudge the tempo up.</p>
    </div>
  );
}

// "lR" -> { grace: "l", stroke: "R", accent: false }
function parseStroke(token) {
  if (token === "-") return null;
  const accent = token.startsWith(">");
  const body = accent ? token.slice(1) : token;
  return { accent, grace: body.slice(0, -1), stroke: body.slice(-1) };
}

export function RudimentsTab({ overview, rudimentId, onRudiment }) {
  const { counts, rudiments } = overview.drums;
  const rudiment = rudiments.find((r) => r.id === rudimentId) || rudiments[0];
  return (
    <div>
      <Picker items={rudiments} value={rudiment.id} onChange={onRudiment} />
      <Rudiment key={rudiment.id} rudiment={rudiment} counts={counts} />
    </div>
  );
}

function Rudiment({ rudiment, counts }) {
  const [tempo, setTempo] = useState(rudiment.tempo);
  const loop = useLoop();
  const strokes = rudiment.sticking.split(" ").map(parseStroke);
  const perBeat = rudiment.steps / 4;

  const toggle = () => {
    if (loop.playing) return loop.stop();
    const stepSeconds = 60 / tempo / perBeat;
    loop.start(rudiment.steps, stepSeconds, (step, when, drum) => {
      const st = strokes[step];
      if (!st) return;
      [...st.grace].forEach((_, g) => drum("snare", when - 0.035 * (st.grace.length - g), 0.22));
      drum("snare", when, st.accent ? 1 : 0.62);
    });
  };

  return (
    <div>
      <article className={s.head} style={{ display: "block" }} aria-labelledby="rudiment-name">
        <h2 id="rudiment-name" className={s.name}>
          {rudiment.name}
        </h2>
        <p className={s.about} style={{ marginTop: 12 }}>
          {rudiment.about}
        </p>
      </article>
      <div className={s.toolbar}>
        <button type="button" className={s.play} aria-pressed={loop.playing} onClick={toggle}>
          {loop.playing ? <StopMark /> : <Speaker />} {loop.playing ? "Stop" : "Play it"}
        </button>
        <Tempo
          value={tempo}
          onChange={(bpm) => {
            setTempo(bpm);
            loop.retime(60 / bpm / perBeat);
          }}
        />
      </div>
      <div className={`${s.neck} ${s.scroll}`}>
        <table className={s.grid} aria-label={`${rudiment.name} sticking`}>
          <tbody>
            <tr>
              <th scope="row">Hand</th>
              {strokes.map((st, i) => (
                <td key={i} className={`${i % perBeat === 0 ? s.beat : ""} ${loop.step === i ? s.now : ""}`} style={{ height: 52 }}>
                  {st ? (
                    <span className={`${s.stroke} ${st.accent ? s.strokeAccent : ""}`}>
                      {st.accent && <span aria-label="accent">&gt;</span>}
                      {st.grace && <span className={s.grace}>{st.grace}</span>}
                      {st.stroke}
                    </span>
                  ) : (
                    <span className={s.rest} aria-label="rest" />
                  )}
                </td>
              ))}
            </tr>
            <tr className={s.counts}>
              <th scope="row">Count</th>
              {counts[rudiment.steps].map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <ul className={s.legend}>
          <li>R right hand, L left</li>
          <li>&gt; accent</li>
          <li>small letters: grace notes, played softly just before</li>
        </ul>
      </div>
      <p className={s.muted}>Practise on a pad or a pillow with a metronome. Even and relaxed beats fast and tense.</p>
    </div>
  );
}
