"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import ContinueCard from "@/components/member/library/ContinueCard";
import { NetworkError, formatClock, practiceRequest } from "@/lib/practice";

// The student's term at a glance: this month's song, what's next, and earlier months to revisit.
// Everything comes from GET /term, which never sends a song title before it's open.
// The song to continue with shows here too, merged in when it's this month's song.
export default function YourTerm({ continueItem = null }) {
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

  const term = data?.membership === "active" ? data.term : null;
  const currentSong = term?.slots?.find((s) => s.month === term.currentMonth)?.song;
  const merged = Boolean(currentSong && continueItem?.song.id === currentSong.id);

  return (
    <div style={{ display: "grid", gap: 14, marginBottom: 36 }}>
      {/* The Tag from DESIGN.md: square, with a flare rule across the top. */}
      <section className="rw-tag" aria-labelledby="your-term">
        <h2 id="your-term" style={heading}>
          Your term
        </h2>
        <Body data={data} failure={failure} retry={() => setAttempt((n) => n + 1)} leftOffAt={merged ? continueItem.position : null} />
      </section>
      {merged ? null : <ContinueCard item={continueItem} />}
    </div>
  );
}

function Body({ data, failure, retry, leftOffAt }) {
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
        <Button type="button" onClick={retry} size="xs" variant="secondary">
          Retry
        </Button>
      </p>
    );
  }
  if (data.membership !== "active") {
    return (
      <>
        <h3 className="rw-tag-title">{data.membership === "expired" ? "Your membership has ended" : "No active membership"}</h3>
        <p style={muted}>
          {data.term.group ? `You're in ${data.term.group.name}. ` : ""}Renew your membership to open your term&apos;s songs
          again.
        </p>
        <Button href="/onboarding/payment" size="sm">
          Renew membership
        </Button>
      </>
    );
  }
  const { term } = data;
  if (term.state === "none") {
    return (
      <>
        <h3 className="rw-tag-title">You&apos;re not in a term yet</h3>
        <p style={muted}>
          Students learn one song a month in a three-month term group, which the school sets up when your lessons start.
          Ask us if you think you should be in one. Meanwhile the practice library is open.
        </p>
        <Button href="/member/library" size="sm" variant="secondary">
          Open the practice library
        </Button>
      </>
    );
  }

  const current = term.slots.find((s) => s.month === term.currentMonth);
  const nextUpcoming = term.slots.find((s) => s.state === "upcoming");
  // This month is shown large above, so the list only carries the other two.
  const others = term.slots.filter((s) => s.month !== term.currentMonth);

  return (
    <>
      <p style={{ ...muted, fontSize: 13.5, color: "var(--rw-meta)", margin: "0 0 14px" }}>
        {term.group.name} · {term.state === "ended" ? "finished" : term.state === "upcoming" ? `starts ${term.group.startShort}` : `month ${term.currentMonth} of 3`}
      </p>

      {term.state === "upcoming" || !current ? (
        <>
          <h3 className="rw-tag-title">Your first song is on its way</h3>
          <p style={muted}>It unlocks {term.slots[0].unlockShort}.</p>
        </>
      ) : current.state === "available" ? (
        <>
          <h3 className="rw-tag-title" style={{ marginBottom: 2 }}>
            {current.song.title}
          </h3>
          <p style={{ ...muted, margin: "0 0 12px" }}>
            {[current.song.artist, leftOffAt ? `you left off at ${formatClock(leftOffAt)}` : null].filter(Boolean).join(" · ")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button href={`/member/song/${current.song.id}`} size="sm">
              Continue learning
            </Button>
            {current.lesson && (
              <Button href={`/member/lesson/${current.lesson.id}`} size="sm" variant="secondary">
                Watch the lesson
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <h3 className="rw-tag-title">Your next song is being prepared</h3>
          <p style={muted}>Your teachers are getting this month&apos;s song ready. It will appear here as soon as it&apos;s published.</p>
        </>
      )}

      <ol style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
        {others.map((s) => (
          <li key={s.month} style={row}>
            <span style={{ fontWeight: 700, color: "var(--rw-ink)", width: 72, flexShrink: 0 }}>Month {s.month}</span>
            <span style={{ flex: 1, fontSize: 14, color: "var(--rw-body)" }}>
              {s.state === "available" ? (
                <Link href={`/member/song/${s.song.id}`} style={{ color: "var(--rw-orange-deep)", fontWeight: 600 }}>
                  {s.song.title}
                </Link>
              ) : s.state === "preparing" ? (
                "Being prepared"
              ) : s === nextUpcoming && term.currentMonth ? (
                `Coming next month · ${s.unlockShort}`
              ) : (
                `Unlocks ${s.unlockShort}`
              )}
            </span>
          </li>
        ))}
      </ol>

      {term.earlier?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--rw-ink)", marginBottom: 4 }}>Earlier terms</div>
          {term.earlier.map((g) => (
            <div key={g.id} style={{ fontSize: 14, color: "var(--rw-body)" }}>
              {g.name}:{" "}
              {g.songs.map((s, i) => (
                <span key={s.month}>
                  {i > 0 && ", "}
                  <Link href={`/member/song/${s.song.id}`} style={{ color: "var(--rw-orange-deep)" }}>
                    {s.song.title}
                  </Link>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const heading = { margin: "0 0 2px", fontWeight: 800, fontSize: "var(--rw-text-3xl)", lineHeight: 1.05, textTransform: "uppercase", color: "var(--rw-ink)" };
const muted = { color: "var(--rw-body)", fontSize: 15, lineHeight: 1.6, margin: "0 0 10px" };
const row = { display: "flex", gap: 10, alignItems: "baseline", padding: "9px 0", borderTop: "1px solid var(--rw-border)" };
