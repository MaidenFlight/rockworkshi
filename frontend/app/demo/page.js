"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { demoCheckRequest, demoStatusRequest } from "@/lib/auth/authApi";
import { instruments } from "@/lib/content";
import { Button, Container, PageHero } from "@/components/ui";
import { Field, formStyles as f } from "@/components/ui/Form";
import s from "./demo.module.css";

// What a student of each instrument gets to play from (backend lib/instrumentAccess.js decides it).
const WHAT_YOU_GET = {
  Guitar: "Strum along with the band, with chords voiced for guitar.",
  Piano: "Play along with the band, with chords voiced for piano.",
  Bass: "Hold down the groove, with the bass line written out.",
  Drums: "Keep the beat with the band, with the drum part written out.",
  Voice: "Sing along with the band, with the melody written out.",
  Ukulele: "Strum along with the band, with chords voiced for ukulele.",
};

// The homepage's instrument photos, framed the same way.
const PHOTOS = {
  Guitar: ["guitar", "50% 50%"],
  Piano: ["piano", "50% 50%"],
  Bass: ["bass", "50% 50%"],
  Drums: ["drums", "50% 62%"],
  Voice: ["voice", "50% 35%"],
  Ukulele: ["ukulele", "50% 48%"],
};

// The Demo tab (backend lib/demo.js). With the passcode the school gave out, a visitor picks an
// instrument and is signed into a sample student who plays it. Someone already in the demo comes back
// here to switch instrument.
export default function DemoPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={null}>
      <Demo />
    </Suspense>
  );
}

function Demo() {
  const { user, isLoading, startDemo } = useAuth();
  const router = useRouter();
  const left = useSearchParams().get("left") === "1";
  const [status, setStatus] = useState(undefined); // { open, song }, or null when it couldn't be reached
  const [attempt, setAttempt] = useState(0);
  const [passcode, setPasscode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(null); // the instrument whose demo is being made

  useEffect(() => {
    let cancelled = false;
    demoStatusRequest()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const inDemo = Boolean(user?.isDemo);
  const song = status?.song ?? null;
  // The instruments the demo offers, in the site's usual order (backend DEMO_INSTRUMENTS).
  const offered = instruments.map((i) => i.name).filter((name) => status?.instruments?.includes(name));

  async function check(e) {
    e.preventDefault();
    if (!passcode.trim()) {
      setError("Enter the passcode you were given.");
      return;
    }
    setError("");
    setChecking(true);
    try {
      await demoCheckRequest(passcode);
      setAccepted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function choose(instrument) {
    if (inDemo && instrument === user.instrument) {
      router.push("/member");
      return;
    }
    setError("");
    setOpening(instrument);
    try {
      await startDemo({ passcode: inDemo ? undefined : passcode, instrument });
      router.push("/member");
    } catch (err) {
      setError(err.message);
      setOpening(null);
    }
  }

  let body;
  if (status === undefined || isLoading) {
    body = <p className={s.muted}>Loading…</p>;
  } else if (inDemo || accepted) {
    body = <Chooser offered={offered} inDemo={inDemo} current={inDemo ? user.instrument : null} song={song} error={error} opening={opening} onChoose={choose} />;
  } else if (status === null) {
    body = (
      <div className={f.panel} role="alert">
        <p className={f.intro}>The demo couldn&apos;t be reached. Check your connection and try again.</p>
        <Button type="button" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  } else if (!status.open) {
    body = (
      <div className={f.panel}>
        <h2 className={s.closedTitle}>Closed at the moment</h2>
        <p className={f.intro}>
          The demo opens with a passcode the school gives out. To see the school for yourself,{" "}
          <Link href="/trial" className={s.link}>
            book a free trial lesson
          </Link>
          .
        </p>
      </div>
    );
  } else {
    body = (
      <form className={f.panel} onSubmit={check} noValidate aria-busy={checking || undefined}>
        <p className={f.intro}>Enter the passcode you were given, then choose an instrument. You&apos;ll look around as a student who plays it.</p>
        <Field id="demo-passcode" label="Passcode" error={error} className={s.fieldGap}>
          {(props) => (
            <input
              {...props}
              className={f.input}
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </Field>
        {user && <p className={`${f.small} ${s.fieldGap}`}>Opening the demo signs you out of your own account in this browser.</p>}
        <div className={f.actions}>
          <Button type="submit" aria-disabled={checking || undefined} className={f.submit}>
            {checking ? "Checking…" : "Continue"}
          </Button>
          <p className={f.small}>Nothing you do in the demo is booked, charged or emailed, nothing reaches a real teacher, and it&apos;s all cleared when you leave.</p>
        </div>
      </form>
    );
  }

  return (
    <div>
      <PageHero
        title={<>Student demo</>}
        lead={
          <>
            Try the member area as a sample student: {song ? `${song.title} with every instrument on its own track, ` : "a song with every instrument on its own track, "}
            the chart and chord library for their instrument, and the practice tools.
          </>
        }
      />
      <Container width={inDemo || accepted ? "wide" : "form"} style={{ padding: "36px 24px 100px" }}>
        {left && !inDemo && (
          <p role="status" className={s.left}>
            You&apos;ve left the student demo, and everything done in it has been cleared.
          </p>
        )}
        {body}
      </Container>
    </div>
  );
}

// One sample student for each instrument the demo offers. In the demo already, the current one is marked
// and choosing another swaps the demo for a new one.
function Chooser({ offered, inDemo, current, song, error, opening, onChoose }) {
  return (
    <section aria-labelledby="demo-pick">
      <h2 id="demo-pick" className={s.title}>
        {inDemo ? "Switch instrument" : "Choose an instrument"}
      </h2>
      <p className={s.lead}>
        {inDemo
          ? `You're in the demo as a ${current?.toLowerCase()} student. Pick another instrument to see what its students get. This demo is cleared when you do.`
          : `You'll be Kai, a student about three months in${song ? `, working on ${song.title}` : ""}, with practice work and feedback from your teacher and a group lesson coming up.`}
      </p>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      <div className={s.grid}>
        {offered.map((name) => {
          const [file, position] = PHOTOS[name];
          const isCurrent = name === current;
          return (
            <button key={name} type="button" className={s.card} onClick={() => onChoose(name)} disabled={Boolean(opening)} aria-current={isCurrent || undefined}>
              <span className={s.photo}>
                <Image
                  src={`/images/instruments/${file}.jpg`}
                  alt=""
                  fill
                  sizes="(max-width: 380px) calc(100vw - 48px), (max-width: 700px) calc(50vw - 32px), (max-width: 1200px) calc(33.333vw - 32px), 368px"
                  style={{ objectPosition: position }}
                />
              </span>
              <span className={s.caption}>
                <span className={s.name}>
                  {name}
                  {isCurrent && <span className={s.current}>Current</span>}
                </span>
                <span className={s.line}>{opening === name ? "Opening the demo…" : isCurrent ? "Back to this demo" : WHAT_YOU_GET[name]}</span>
              </span>
            </button>
          );
        })}
      </div>
      {inDemo && (
        <p className={s.back}>
          <Link href="/member" className={s.link}>
            Back to the demo
          </Link>
        </p>
      )}
    </section>
  );
}
