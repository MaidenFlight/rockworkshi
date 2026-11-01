"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NetworkError, practiceRequest } from "@/lib/practice";

// The student's term at a glance: this month's song, what's next, and earlier months to revisit.
// Everything shown comes from GET /term, which never sends a song title before it's open.
export default function YourTerm() {
  const [data, setData] = useState(undefined); // undefined loading, null failed
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    practiceRequest("/term")
      .then((d) => {
        setData(d);
        setFailure(null);
      })
      .catch((err) => {
        setFailure(err instanceof NetworkError ? "You're offline, so your term can't load." : `Your term couldn't load: ${err.message}`);
        setData(null);
      });
  }, [attempt]);

  return (
    <section aria-labelledby="your-term" style={panel}>
      <div style={eyebrow} id="your-term">
        Your term
      </div>
      <Body data={data} failure={failure} retry={() => setAttempt((n) => n + 1)} />
    </section>
  );
}

function Body({ data, failure, retry }) {
  if (data === undefined) {
    return (
      <p role="status" style={muted}>
        Loading your term…
      </p>
    );
  }
  if (!data) {
    return (
      <p role="alert" style={muted}>
        {failure}{" "}
        <button type="button" onClick={retry} style={small}>
          Retry
        </button>
      </p>
    );
  }
  if (data.membership !== "active") {
    return (
      <>
        <h2 style={title}>{data.membership === "expired" ? "Your membership has ended" : "No active membership"}</h2>
        <p style={muted}>
          {data.term.group ? `You're in ${data.term.group.name}. ` : ""}Renew your membership to open your term&apos;s songs
          again.
        </p>
        <Link href="/onboarding/payment" style={button}>
          Renew membership
        </Link>
      </>
    );
  }
  const { term } = data;
  if (term.state === "none") {
    return (
      <>
        <h2 style={title}>You&apos;re not in a term yet</h2>
        <p style={muted}>
          Students learn one song a month in a three-month term group, which the school sets up when your lessons start.
          Ask us if you think you should be in one. Meanwhile the practice library is open.
        </p>
        <Link href="/member/library" style={{ ...button, background: "#fff", color: "var(--rw-ink)", border: "1px solid var(--rw-line)" }}>
          Open the practice library
        </Link>
      </>
    );
  }

  const current = term.slots.find((s) => s.month === term.currentMonth);
  const nextUpcoming = term.slots.find((s) => s.state === "upcoming");
  const revisit = term.slots.filter((s) => s.state === "available" && s.month !== term.currentMonth);

  return (
    <>
      <div style={{ fontSize: 13, color: "var(--rw-meta)", marginBottom: 12 }}>
        {term.group.name} · {term.state === "ended" ? "finished" : term.state === "upcoming" ? `starts ${term.group.startDisplay}` : `month ${term.currentMonth} of 3`}
      </div>

      {term.state === "upcoming" || !current ? (
        <div style={feature}>
          <h2 style={title}>Your first song is on its way</h2>
          <p style={muted}>It unlocks {term.slots[0].unlockAtDisplay}.</p>
        </div>
      ) : current.state === "available" ? (
        <div style={feature}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rw-teal)" }}>MONTH {current.month} · THIS MONTH&apos;S SONG</div>
          <h2 style={title}>{current.song.title}</h2>
          <p style={muted}>{current.song.artist}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/member/song/${current.song.id}`} style={button}>
              Continue learning
            </Link>
            {current.lesson && (
              <Link href={`/member/lesson/${current.lesson.id}`} style={{ ...button, background: "#fff", color: "var(--rw-ink)", border: "1px solid var(--rw-line)" }}>
                Watch the lesson
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div style={feature}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rw-teal)" }}>MONTH {current.month}</div>
          <h2 style={title}>Your next song is being prepared</h2>
          <p style={muted}>Your teachers are getting this month&apos;s song ready. It will appear here as soon as it&apos;s published.</p>
        </div>
      )}

      <ol style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 8 }}>
        {term.slots.map((s) => (
          <li key={s.month} style={row}>
            <span style={{ fontWeight: 700, color: "var(--rw-ink)", width: 72 }}>Month {s.month}</span>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--rw-body)" }}>
              {s.state === "available" ? (
                <Link href={`/member/song/${s.song.id}`} style={{ color: "var(--rw-ink)", fontWeight: 600 }}>
                  {s.song.title}
                </Link>
              ) : s.state === "preparing" ? (
                "Being prepared"
              ) : s === nextUpcoming && term.currentMonth ? (
                `Coming next month · ${s.unlockAtDisplay}`
              ) : (
                `Unlocks ${s.unlockAtDisplay}`
              )}
            </span>
          </li>
        ))}
      </ol>

      {revisit.length > 0 && <p style={{ ...muted, marginTop: 10 }}>Songs you&apos;ve reached stay yours, even after the term ends. Tap one above to revisit it.</p>}

      {term.earlier?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rw-meta)", marginBottom: 6 }}>EARLIER TERMS</div>
          {term.earlier.map((g) => (
            <div key={g.id} style={{ fontSize: 13.5, color: "var(--rw-body)" }}>
              {g.name}:{" "}
              {g.songs.map((s, i) => (
                <span key={s.month}>
                  {i > 0 && ", "}
                  <Link href={`/member/song/${s.song.id}`}>{s.song.title}</Link>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const panel = {
  background: "var(--rw-surface)",
  border: "1px solid var(--rw-border)",
  borderTop: "4px solid var(--rw-orange)",
  borderRadius: 14,
  padding: "20px 22px",
  marginBottom: 36,
};
const eyebrow = { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 6 };
const title = { fontWeight: 700, fontSize: 22, color: "var(--rw-ink)", margin: "4px 0 2px" };
const muted = { color: "var(--rw-body)", fontSize: 14, lineHeight: 1.55, margin: "0 0 10px" };
const feature = { padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid var(--rw-border)" };
const row = { display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid var(--rw-border)" };
const button = {
  display: "inline-block",
  padding: "9px 16px",
  borderRadius: 8,
  background: "var(--rw-orange)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
};
const small = { padding: "5px 12px", borderRadius: 6, border: "1px solid var(--rw-line)", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
