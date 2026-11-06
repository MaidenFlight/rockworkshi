"use client";

import Link from "next/link";
import EditorialHero from "@/components/EditorialHero";
import { Button } from "@/components/ui";
import Icon from "@/components/member/Icon";
import T from "@/components/T";
import { useAuth } from "@/contexts/AuthContext";
import { nextEnrolmentStep } from "@/lib/auth/enrolment";

// The tuner and metronome are open to everyone; the rest come with membership.
const TOOLS = [
  { key: "tuner", title: "Tuner", desc: "Mic-based tuning plus plucked reference tones.", icon: "tuner", free: true },
  { key: "metronome", title: "Metronome", desc: "A steady click at any tempo, with tap tempo.", icon: "metronome", free: true },
  { key: "chords", title: "Chord Library", desc: "Every chord, scale and groove for the instrument you study, linked to our songs.", icon: "chords" },
  { key: "piano", title: "Piano", desc: "A two-octave, polyphonic on-screen keyboard.", icon: "keys" },
  { key: "rhythm", title: "Rhythm Trainer", desc: "Clap or play along with a count-in and highlighted beats.", icon: "drum" },
];

export default function ToolsHub() {
  const { user, isAuthenticated, isLoading } = useAuth();
  // A paying member (or staff) opens everything; anyone else gets the two free tools.
  const member = isAuthenticated && !nextEnrolmentStep(user);

  return (
    <div>
      <EditorialHero
        title={<T k="tools.hero.title">Music Tools</T>}
        intro={
          <T k="tools.hero.intro.split">
            The tuner and metronome are free for anyone. The chord library, piano and rhythm trainer come with membership.
          </T>
        }
      />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 24px 100px" }}>
        <ul className="rw-toolgrid">
          {TOOLS.map((t) => {
            const open = t.free || member;
            const inside = (
              <>
                <span className="rw-tool-mark" aria-hidden="true">
                  <Icon name={t.icon} size={30} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="rw-tool-title">
                    <T k={`tools.${t.key}.title`}>{t.title}</T>
                  </span>
                  <span className="rw-tool-desc">
                    <T k={`tools.${t.key}.desc`}>{t.desc}</T>
                  </span>
                </span>
                <span className="rw-tool-state" data-free={t.free ? "true" : undefined}>
                  {t.free ? "Free" : member ? "Open" : "With membership"}
                </span>
              </>
            );
            return (
              <li key={t.key}>
                {open ? (
                  <Link href={`/tools/${t.key}`} className="rw-tag rw-tag-link rw-tool">
                    {inside}
                  </Link>
                ) : (
                  <div className="rw-tag rw-tool" data-locked="true">
                    {inside}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {!isLoading && !member && (
          <div className="rw-tool-join">
            <p>
              <T k="tools.join.copy">Membership opens all five tools, the lesson videos and the song library.</T>
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {/* Someone signed in but not paid yet goes to their next signup step, not a new account. */}
              <Button href={(isAuthenticated && nextEnrolmentStep(user)) || "/signup"}>
                <T k="cta.join">Join the member area</T>
              </Button>
              {!isAuthenticated && (
                <Button href="/signin?next=/tools" variant="quiet">
                  <T k="tools.links.signin">Student Sign In</T>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
