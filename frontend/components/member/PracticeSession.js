"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import Tuner from "@/components/tuner/Tuner";
import Icon from "./Icon";
import { TUNED, tickToday } from "./TodayList";
import s from "./PracticeSession.module.css";

// "Start today's practice": the day's practice work as one clear sequence above the player, using the
// tools the student already has. Tune up (string instruments), practise the section (the loop and the
// speed trainer), record a take (the recorder), listen back, and save or submit it. Each step done is
// ticked on the dashboard's Today list too. Getting to the end sends nothing: only the last step's key does.
// player is the StemPlayer's handle ({ startTrainer, openRecorder, sendTake, listenBack, setUp }); take is where
// the take is (StemPlayer's onTakeState: { take, name, keep, sending, verdict, uploadStopped }); sent turns
// true once it has gone.
export default function PracticeSession({ assignment, instrument, player, take, sent, onEnd }) {
  const teacher = assignment.teacher?.name?.split(" ")[0] || "your teacher";
  const part = assignment.section || "the section";
  const checkpoint = Boolean(assignment.week) && assignment.kind === "checkpoint";
  const assessment = Boolean(assignment.week) && assignment.kind === "assessment";
  const speedWords = `${assignment.targetSpeed ?? 100}%`;
  const steps = [
    ...(TUNED.includes(instrument) ? [{ id: "tune", label: "Tune up" }] : []),
    { id: "practise", label: `Practise ${part}` },
    { id: "record", label: "Record your take" },
    { id: "listen", label: "Listen back" },
    { id: "send", label: checkpoint ? "Save it" : assessment ? `Submit to ${teacher}` : `Send to ${teacher}` },
  ];
  // The step reached survives a reload, for this practice work, in this tab.
  const storageKey = `rw-session:${assignment.id}`;
  const [index, setIndex] = useState(() => {
    try {
      return Math.min(steps.length - 1, Math.max(0, Number(window.sessionStorage.getItem(storageKey)) || 0));
    } catch {
      return 0;
    }
  });
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const heading = useRef(null);
  const step = steps[index];

  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, String(index));
    } catch {
      // Only a convenience: a reload starts at the first step.
    }
  }, [storageKey, index]);

  // Moving on puts the reader at the new step's heading.
  function go(next) {
    setIndex(next);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  function next() {
    if (step.id === "tune") tickToday(assignment.id, "tune");
    if (step.id === "practise") tickToday(assignment.id, "loop");
    go(Math.min(steps.length - 1, index + 1));
  }

  const toPlayer = () => document.querySelector(".rw-transport")?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function send() {
    setSending(true);
    setSendFailed(false);
    const ok = await player.current?.sendTake();
    setSending(false);
    if (!ok) setSendFailed(true);
  }

  if (sent) {
    return (
      <section className={s.session} aria-labelledby="session-step">
        <div className={s.done}>
          <span className={s.doneMark} aria-hidden="true">
            <Icon name="check" size={22} />
          </span>
          <div>
            <h2 id="session-step" className={s.title}>
              {checkpoint ? "Saved" : assessment ? `Submitted to ${teacher}` : `Sent to ${teacher}`}
            </h2>
            <p className={s.text}>
              {checkpoint
                ? `That's this milestone saved. ${teacher === "your teacher" ? "Your teacher" : teacher} can listen to it, and you can save another whenever you like.`
                : `That's today's practice done. ${teacher === "your teacher" ? "Your teacher" : teacher} replies on the practice work's page.`}
            </p>
          </div>
        </div>
        <div className={s.actions}>
          <Button href="/member">Back to your dashboard</Button>
          <Button type="button" variant="quiet" onClick={onEnd}>
            Keep practising
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={s.session} aria-labelledby="session-step">
      <div className={s.head}>
        <ol className={s.steps} aria-label="Today's practice">
          {steps.map((st, i) => (
            <li key={st.id} aria-current={i === index ? "step" : undefined} data-done={i < index ? "true" : undefined}>
              <span className={s.num} aria-hidden="true">
                {i < index ? <Icon name="check" size={14} /> : i + 1}
              </span>
              {st.label}
            </li>
          ))}
        </ol>
        <button type="button" className={s.end} onClick={onEnd}>
          End session
        </button>
      </div>

      <h2 id="session-step" ref={heading} tabIndex={-1} className={s.title}>
        {index + 1}. {step.label}
      </h2>

      {step.id === "tune" && (
        <>
          <p className={s.text}>Play each string and turn its peg until the needle sits in the middle, or match the reference tones.</p>
          <div className={s.tuner}>
            <Tuner instrument={instrument} />
          </div>
        </>
      )}

      {step.id === "practise" && (
        <>
          <p className={s.text}>
            {`Loop ${part} until it feels easy. The speed trainer starts it slow and speeds up a step every couple of passes, up to ${assignment.targetSpeed ? `${assignment.targetSpeed}%` : "full speed"}. Or just press Play and loop it at your own pace.`}
          </p>
          <div className={s.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                player.current?.startTrainer();
                toPlayer();
              }}
            >
              Start the speed trainer
            </Button>
          </div>
        </>
      )}

      {step.id === "record" && (
        <>
          <p className={s.text}>
            {assessment
              ? `Record the whole of ${part} at ${speedWords}, with headphones on so the mic only hears you. The recorder shows what this assessment asks for and can set the player up for it. You can record again until you're happy with it.`
              : `Record the whole of ${part} at ${assignment.targetSpeed ? speedWords : "full speed"}, with headphones on so the mic only hears you. You can record again until you're happy with it.`}
          </p>
          <div className={s.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                // Set to what the task asks for, whatever the speed trainer had got to.
                player.current?.setUp();
                player.current?.openRecorder();
              }}
            >
              <Icon name="record" size={12} />
              Open the recorder
            </Button>
            <span className={s.status} role="status">
              {take?.take ? `${take.name} is ready.` : "No take yet."}
            </span>
          </div>
        </>
      )}

      {step.id === "listen" && (
        <>
          <p className={s.text}>
            {take?.take
              ? `Play ${take.name} back from the start.${assignment.criteria?.length ? ` Listen for: ${assignment.criteria.join(", ").toLowerCase()}.` : ""} If it's not there yet, go back a step and record again.`
              : "There's no take to listen to yet. Go back a step and record one."}
          </p>
          {take?.take && (
            <div className={s.actions}>
              <Button type="button" variant="secondary" onClick={() => player.current?.listenBack()}>
                <Icon name="play" size={12} />
                Play your take
              </Button>
            </div>
          )}
        </>
      )}

      {step.id === "send" &&
        (take?.take && take.verdict?.ok === false ? (
          <p className={s.text}>{take.verdict.text}</p>
        ) : take?.take ? (
          <>
            <p className={s.text}>
              {checkpoint
                ? `${take.name} is saved where ${teacher} can listen to it. You can save another any time.`
                : assessment
                  ? `${take.name} goes to ${teacher} for the Week ${assignment.week} assessment. You can submit a better one later, and every one is kept.`
                  : `${take.name} goes to ${teacher}, who replies on the practice work's page. You can send it again any time.`}
            </p>
            <div className={s.actions}>
              <Button type="button" onClick={send} disabled={sending || take.sending}>
                {sending || take.sending ? "Uploading…" : take.uploadStopped ? "Resume upload" : checkpoint ? "Save milestone" : assessment ? `Submit ${take.name} for the Week ${assignment.week} assessment` : `Send to ${teacher}`}
              </Button>
              {sendFailed && (
                <span className={s.error} role="alert">
                  It didn&apos;t go. The recorder says why: try again from there, or press the key again.
                </span>
              )}
            </div>
          </>
        ) : (
          <p className={s.text}>There&apos;s no take yet. Go back to Record your take and record one.</p>
        ))}

      <div className={s.nav}>
        {index > 0 && (
          <Button type="button" variant="quiet" onClick={() => go(index - 1)}>
            Back
          </Button>
        )}
        {step.id !== "send" && (
          <Button type="button" variant="secondary" onClick={next} disabled={(step.id === "record" || step.id === "listen") && !take?.take}>
            Next: {steps[index + 1].label}
            <Icon name="arrow-right" size={14} />
          </Button>
        )}
      </div>
    </section>
  );
}
