import Link from "next/link";
import { Button } from "@/components/ui";
import TodayList, { stepsFor } from "@/components/member/TodayList";
import UnsentTake from "@/components/member/UnsentTake";
import { formatClock, formatWhen } from "@/lib/practice";

const LABELS = {
  assignment: "From your teacher",
  term: "This month's song",
  continue: "Pick up where you left off",
  start: "Your first song",
};

// The one panel that answers "what should I practise next?". `next` comes from pickPracticeNext.
export default function PracticeNext({ next, failed, onRetry }) {
  if (failed) {
    return (
      <section className="rw-tag rw-next" aria-labelledby="practice-next" role="alert">
        <h2 id="practice-next" className="rw-next-title">
          Your practice couldn&apos;t load
        </h2>
        <p className="rw-next-text">{failed}</p>
        <div className="rw-next-actions">
          <Button type="button" onClick={onRetry} variant="secondary">
            Try again
          </Button>
          <Button href="/member/library" variant="quiet">
            Open the library
          </Button>
        </div>
      </section>
    );
  }
  if (!next) {
    return (
      <section className="rw-tag rw-next" aria-busy="true" aria-label="Loading what to practise next">
        <div className="rw-next-skel" style={{ width: "30%" }} />
        <div className="rw-next-skel" style={{ width: "70%", height: 32 }} />
        <div className="rw-next-skel" style={{ width: "45%" }} />
      </section>
    );
  }

  if (next.kind === "renew") {
    return (
      <section className="rw-tag rw-next" aria-labelledby="practice-next">
        <h2 id="practice-next" className="rw-next-title">
          {next.expired ? "Your membership has ended" : "No active membership"}
        </h2>
        <p className="rw-next-text">Renew to open your songs, lessons and practice tools again. Your notes and favourites are kept.</p>
        <div className="rw-next-actions">
          <Button href="/onboarding/payment">Renew membership</Button>
        </div>
      </section>
    );
  }

  if (next.kind === "empty") {
    return (
      <section className="rw-tag rw-next" aria-labelledby="practice-next">
        <h2 id="practice-next" className="rw-next-title">
          {next.waiting?.upcoming && next.waiting.unlockShort ? `Your first song unlocks ${next.waiting.unlockShort}` : next.waiting ? "Your next song is being prepared" : "Songs are on their way"}
        </h2>
        <p className="rw-next-text">Nothing is ready to play along with yet. The tuner, metronome and chord library are open meanwhile.</p>
        <div className="rw-next-actions">
          <Button href="/tools/tuner" variant="secondary">
            Tune up
          </Button>
          <Button href="/member/library" variant="quiet">
            See what&apos;s coming
          </Button>
        </div>
        <Feedback item={next.feedback} />
      </section>
    );
  }

  const { song, assignment } = next;
  const meta = [
    song?.artist,
    assignment?.instrument,
    assignment ? `Level ${assignment.level}${assignment.levelName ? ` ${assignment.levelName}` : ""}` : song?.level,
    assignment?.section,
  ].filter(Boolean);
  const title = song?.title ?? assignment?.lesson?.title;
  const starting = next.leftOff == null && (next.kind === "start" || next.isNew);
  // Practice work on a song is a guided session: today's steps, one at a time, above the player.
  const guided = Boolean(assignment && song);
  const teacher = assignment?.teacher?.name?.split(" ")[0] || "your teacher";
  const finish = assignment?.week ? (assignment.kind === "checkpoint" ? "record a take and save it" : `record a take and submit it to ${teacher}`) : `record a take and send it to ${teacher}`;
  const plan = guided
    ? stepsFor(assignment)
        .map((s) => (s.id === "tune" ? "tune up" : s.id === "loop" ? `practise ${assignment.section || "the section"}` : s.id === "send" ? finish : null))
        .filter(Boolean)
    : [];

  return (
    <section className="rw-tag rw-next" aria-labelledby="practice-next">
      <p className="rw-next-label">{assignment?.week ? `Week ${assignment.week} ${assignment.kind === "assessment" ? "assessment" : "checkpoint"}` : LABELS[next.kind]}</p>
      <h2 id="practice-next" className="rw-next-title">
        {title}
      </h2>
      {meta.length > 0 && <p className="rw-next-meta">{meta.join(" · ")}</p>}
      {assignment?.instruction && <p className="rw-next-brief">{assignment.instruction}</p>}
      {guided ? (
        <p className="rw-next-text">
          Step by step: {plan.slice(0, -1).join(", ")}
          {plan.length > 1 ? ", then " : ""}
          {plan.at(-1)}.
        </p>
      ) : next.leftOff ? (
        <p className="rw-next-text">
          You left off at <strong>{formatClock(next.leftOff)}</strong>
          {next.lastOpenedAt ? `, ${formatWhen(next.lastOpenedAt)}` : ""}. The player opens there, paused.
        </p>
      ) : starting ? (
        <p className="rw-next-text">Press Play and follow the chart. You can slow it down and loop any bars until they feel easy.</p>
      ) : null}
      <div className="rw-next-actions">
        {guided ? <Button href={`${next.href}&session=1`}>Start today&apos;s practice</Button> : <Button href={next.href}>{starting ? "Start practising" : "Continue practice"}</Button>}
        {assignment ? (
          <Button href={`/member/assignment/${assignment.id}`} variant="secondary">
            View assignment
          </Button>
        ) : next.lesson ? (
          <Button href={`/member/lesson/${next.lesson.id}`} variant="secondary">
            Watch the lesson
          </Button>
        ) : null}
      </div>
      {guided && (
        <p className="rw-next-plain">
          <Link href={next.href}>Open the player without the steps</Link>
        </p>
      )}
      {assignment && <TodayList key={assignment.id} assignment={assignment} />}
      {assignment && song && <UnsentTake key={`take-${assignment.id}`} songId={song.id} assignmentId={assignment.id} aside />}
      {next.waiting && (
        <p className="rw-next-aside">
          {next.waiting.upcoming && next.waiting.unlockShort ? `Your term's first song unlocks ${next.waiting.unlockShort}.` : "This month's term song is being prepared."}
        </p>
      )}
      <Feedback item={next.feedback} />
    </section>
  );
}

// The latest reply from the teacher. The link says what it opens; the task it's on follows.
function Feedback({ item }) {
  if (!item) return null;
  const teacher = item.teacher?.name?.split(" ")[0];
  const on = item.section || (item.song || item.lesson)?.title;
  return (
    <p className="rw-next-aside">
      <Link href={`/member/assignment/${item.id}`}>Read {teacher ? `${teacher}'s` : "your teacher's"} feedback</Link>
      {on ? ` on ${on}` : ""}.
    </p>
  );
}
