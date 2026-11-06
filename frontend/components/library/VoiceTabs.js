"use client";

import { useEffect, useState } from "react";
import Keyboard from "./Keyboard";
import { Speaker, StopMark } from "./Pickers";
import { noteName } from "@/lib/library";
import { playSequence, stopAll } from "@/lib/audio/referenceTones";
import s from "./library.module.css";

const LOW = 48; // C3
const HIGH = 72; // C5

// A warm-up starts on a note the singer picks and can walk up or down a half step at a time,
// or climb by itself: each repeat a half step higher, the way a voice teacher plays them.
export function WarmupsTab({ overview }) {
  const { warmups } = overview.voice;
  const [id, setId] = useState(warmups[0].id);
  const [start, setStart] = useState(55);
  const [at, setAt] = useState(-1);
  const [climbing, setClimbing] = useState(false);
  const warmup = warmups.find((w) => w.id === id);

  useEffect(() => stopAll, []);

  const notes = (from) => warmup.steps.map((st) => from + st);
  const stop = () => {
    stopAll();
    setAt(-1);
    setClimbing(false);
  };
  const play = (from = start, climb = false, repeats = 5) => {
    setStart(from);
    setClimbing(climb);
    playSequence(notes(from), {
      bpm: 96,
      onNote: setAt,
      onEnd: () => {
        if (climb && repeats > 1 && from + 1 <= HIGH) play(from + 1, true, repeats - 1);
        else {
          setAt(-1);
          setClimbing(false);
        }
      },
    });
  };

  const run = notes(start);
  const marks = new Map(run.map((m) => [m, { hand: "lit", text: noteName(m) }]));
  const busy = at >= 0;

  return (
    <div>
      <div className={s.types}>
        <div className={s.group}>
          <p className={s.groupName}>Warm-ups</p>
          <div className={s.row}>
            {warmups.map((w) => (
              <button key={w.id} type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={w.id === id} onClick={() => {
                  stop();
                  setId(w.id);
                }}>
                {w.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <article className={s.head} style={{ display: "block" }} aria-labelledby="warmup-name">
        <h2 id="warmup-name" className={s.name}>
          {warmup.name}
        </h2>
        <p className={s.about} style={{ marginTop: 12 }}>
          {warmup.about}
        </p>
      </article>
      <div className={s.toolbar}>
        <div>
          <span className={s.label} style={{ margin: 0 }}>
            Starting note
          </span>
          <div className={s.row}>
            <button type="button" className={s.btn} disabled={busy || start <= LOW} onClick={() => setStart(start - 1)} aria-label="Half a step lower">
              −
            </button>
            <span className={s.tempoValue} style={{ textAlign: "center" }}>
              {noteName(start)}
              {Math.floor(start / 12) - 1}
            </span>
            <button type="button" className={s.btn} disabled={busy || start >= HIGH} onClick={() => setStart(start + 1)} aria-label="Half a step higher">
              +
            </button>
          </div>
        </div>
        <button type="button" className={s.play} aria-pressed={busy && !climbing} onClick={() => (busy ? stop() : play(start))}>
          {busy && !climbing ? <StopMark /> : <Speaker />} {busy && !climbing ? "Stop" : "Play once"}
        </button>
        <button type="button" className={s.btn} aria-pressed={climbing} onClick={() => (busy ? stop() : play(start, true))}>
          {climbing ? <StopMark /> : <Speaker />} {climbing ? "Stop" : "Climb five keys"}
        </button>
      </div>
      <div className={`${s.neck} ${s.scroll}`}>
        <Keyboard marks={marks} title={`${warmup.name} from ${noteName(start)}`} low={LOW - 1} high={HIGH + 14} />
      </div>
      <p className={s.muted}>Men&apos;s and lower voices usually start around C3, higher voices around C4. Stop before anything strains.</p>
    </div>
  );
}

// Intervals to learn by ear, each with a tune that starts on it, and a quick test.
export function IntervalsTab({ overview }) {
  const { intervals } = overview.voice;
  const [quiz, setQuiz] = useState(null);
  const [score, setScore] = useState({ right: 0, asked: 0 });

  useEffect(() => stopAll, []);

  const hear = (semis, base = 60) => playSequence([base, base + semis], { bpm: 90 });
  const ask = () => {
    const pick = intervals[Math.floor(Math.random() * intervals.length)];
    const base = 55 + Math.floor(Math.random() * 8);
    setQuiz({ pick, base, answer: null });
    hear(pick.semitones, base);
  };
  const answer = (semis) => {
    if (!quiz || quiz.answer !== null) return;
    const right = semis === quiz.pick.semitones;
    setQuiz({ ...quiz, answer: semis });
    setScore((x) => ({ right: x.right + (right ? 1 : 0), asked: x.asked + 1 }));
  };

  return (
    <div>
      <section className={s.start} aria-label="Ear test">
        <span className={s.label}>Ear test</span>
        <div className={s.row} style={{ marginBottom: 12 }}>
          <button type="button" className={s.play} onClick={ask}>
            <Speaker /> {quiz && quiz.answer === null ? "Play another" : "Play a mystery interval"}
          </button>
          {quiz && (
            <button type="button" className={s.btn} onClick={() => hear(quiz.pick.semitones, quiz.base)}>
              Hear it again
            </button>
          )}
          {score.asked > 0 && (
            <span className={s.muted}>
              {score.right} of {score.asked} right
            </span>
          )}
        </div>
        {quiz && (
          <>
            <div className={s.row}>
              {intervals.map((iv) => (
                <button key={iv.semitones} type="button" className={`${s.btn} ${s.btnSmall}`} disabled={quiz.answer !== null} aria-pressed={quiz.answer === iv.semitones} onClick={() => answer(iv.semitones)}>
                  {iv.name}
                </button>
              ))}
            </div>
            {quiz.answer !== null && (
              <p className={s.quizResult} role="status">
                {quiz.answer === quiz.pick.semitones ? "Right: " : "Not quite. It was "}
                {quiz.pick.name.toLowerCase()}, like the start of {quiz.pick.tune}.
              </p>
            )}
          </>
        )}
      </section>
      <ul className={s.list}>
        {intervals.map((iv) => (
          <li key={iv.semitones} className={s.item}>
            <div className={s.itemHead}>
              <h2 className={s.itemTitle}>{iv.name}</h2>
              <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => hear(iv.semitones)}>
                <Speaker /> Hear it
              </button>
            </div>
            <p className={s.about} style={{ margin: 0 }}>
              {iv.semitones} half step{iv.semitones === 1 ? "" : "s"} up. Think of {iv.tune}.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
