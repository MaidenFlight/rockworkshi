"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHero, Button } from "@/components/ui";
import ChordsTab from "@/components/library/ChordsTab";
import ScalesTab from "@/components/library/ScalesTab";
import KeysTab from "@/components/library/KeysTab";
import SongsTab from "@/components/library/SongsTab";
import { GroovesTab, RudimentsTab } from "@/components/library/DrumTabs";
import { IntervalsTab, WarmupsTab } from "@/components/library/VoiceTabs";
import { useLibrary } from "@/lib/library";
import { stopAll } from "@/lib/audio/referenceTones";
import s from "@/components/library/library.module.css";

const TABS = {
  harmony: [
    { id: "chords", label: "Chords" },
    { id: "scales", label: "Scales" },
    { id: "keys", label: "Keys" },
    { id: "songs", label: "Songs" },
  ],
  voice: [
    { id: "chords", label: "Harmony" },
    { id: "scales", label: "Scales" },
    { id: "warmups", label: "Warm-ups" },
    { id: "intervals", label: "Ear training" },
    { id: "keys", label: "Keys" },
    { id: "songs", label: "Songs" },
  ],
  drums: [
    { id: "grooves", label: "Grooves" },
    { id: "rudiments", label: "Rudiments" },
    { id: "songs", label: "Songs" },
  ],
};

const TITLES = {
  Guitar: "Guitar chords & scales",
  Ukulele: "Ukulele chords & scales",
  Bass: "Bass chords & scales",
  Piano: "Piano chords & scales",
  Voice: "Harmony & scales",
  Drums: "Grooves & rudiments",
};

const LEADS = {
  fretted: "Every chord in every position on the neck, with the fingers to use, the scales that go with them, and the songs on the site that use each one.",
  bass: "Every chord as the arpeggio a bass line is built from, the scales in one-finger-per-fret boxes, and the songs on the site that use them.",
  keys: "Every chord in every inversion with the fingers to use, scale fingerings in all twelve keys, and the songs on the site that use them.",
  voice: "The notes of every chord to sing harmony on, scales with solfège, warm-ups and ear training, each with notes to sing along to.",
  drums: "The grooves behind our songs, the rudiments every drummer learns, and a player to practise them at any tempo.",
};

export default function ChordLibraryPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={null}>
      <ChordLibrary />
    </Suspense>
  );
}

function ChordLibrary() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asked = params.get("instrument") || "";
  const [attempt, setAttempt] = useState(0);
  const { data: overview, error } = useLibrary("", asked || undefined, attempt);

  useEffect(() => stopAll, []);

  // Choices live in the URL, so a chord can be linked to and the back button works.
  const setParams = useCallback(
    (changes) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      stopAll();
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  if (error) return <Problem error={error} onRetry={() => setAttempt((n) => n + 1)} onOwn={() => setParams({ instrument: null })} />;
  if (!overview) {
    return (
      <div className="rw-gate" role="status" aria-live="polite">
        <p className="rw-gate-text">Opening your library…</p>
      </div>
    );
  }

  const { kind, instrument } = overview;
  const tabs = kind === "drums" ? TABS.drums : kind === "voice" ? TABS.voice : TABS.harmony;
  const tab = tabs.find((t) => t.id === params.get("tab"))?.id || tabs[0].id;
  // Staff pass the instrument they're looking at; a student's own is implied.
  const scope = overview.staff ? instrument : undefined;
  const openChord = (id) => setParams({ tab: "chords", chord: id });
  const firstScale = overview.scales?.[0]?.id;
  const scaleRoot = Number(params.get("root") ?? (firstScale === "minor-pentatonic" ? 9 : 0)) % 12;
  const firstKey = overview.songs?.find((x) => x.key)?.key;

  return (
    <div>
      <PageHero
        title={TITLES[instrument]}
        lead={
          <>
            {LEADS[kind]}{" "}
            {overview.staff ? "You're staff, so you can open the library for any instrument." : `It's built for ${instrument.toLowerCase()}, the instrument you study with us.`}
          </>
        }
      />
      <div className={s.page}>
        {overview.staff && (
          <div className={s.staffBar}>
            <p>
              <strong>Teaching view.</strong> Students only ever see the library for their own instrument.
            </p>
            <div role="group" aria-label="Instrument" className={s.row}>
              {overview.instruments.map((name) => (
                <button key={name} type="button" className={`${s.btn} ${s.btnSmall}`} aria-pressed={name === instrument} onClick={() => setParams({ instrument: name, tab: null, chord: null, root: null, scale: null, groove: null, rudiment: null })}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div role="tablist" aria-label="Library sections" className={s.tabs}>
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-controls="library-panel" aria-selected={t.id === tab} className={s.tab} onClick={() => setParams({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="library-panel" aria-labelledby={`tab-${tab}`}>
          {tab === "chords" && <ChordsTab overview={overview} chordId={params.get("chord") || "0:maj"} onChord={(id) => setParams({ chord: id })} scope={scope} />}
          {tab === "scales" && (
            <ScalesTab overview={overview} root={scaleRoot} scaleId={params.get("scale") || firstScale} onScale={(root, id) => setParams({ root, scale: id })} scope={scope} />
          )}
          {tab === "keys" && (
            <KeysTab overview={overview} keyName={params.get("key") || (firstKey ? `${firstKey.tonic}-${firstKey.mode}` : "0-major")} onKey={(key) => setParams({ key })} onChord={openChord} />
          )}
          {tab === "songs" && <SongsTab overview={overview} onChord={openChord} onGroove={(id) => setParams({ tab: "grooves", groove: id })} />}
          {tab === "grooves" && <GroovesTab overview={overview} grooveId={params.get("groove")} onGroove={(id) => setParams({ groove: id })} />}
          {tab === "rudiments" && <RudimentsTab overview={overview} rudimentId={params.get("rudiment")} onRudiment={(id) => setParams({ rudiment: id })} />}
          {tab === "warmups" && <WarmupsTab overview={overview} />}
          {tab === "intervals" && <IntervalsTab overview={overview} />}
        </div>
      </div>
    </div>
  );
}

function Problem({ error, onRetry, onOwn }) {
  let title = "The library didn't load";
  let body = error.message;
  let action = (
    <Button type="button" onClick={onRetry}>
      Try again
    </Button>
  );
  if (error.reason === "no_instrument") {
    title = "No instrument on your account yet";
    body = "The library is built for the instrument you study, and the school hasn't set one for you. Let us know which you play and we'll switch it on.";
    action = <Button href="/contact">Contact the school</Button>;
  } else if (error.reason === "instrument") {
    title = "That's another instrument's library";
    body = "Your library is built for the instrument you study with us.";
    action = (
      <Button type="button" onClick={onOwn}>
        Open my library
      </Button>
    );
  }
  return (
    <div>
      <PageHero title="Chord library" />
      <div className={s.page}>
        <div className={s.notice} role="alert">
          <h2>{title}</h2>
          <p>{body}</p>
          <div className={s.row}>
            {action}
            <Link className={s.link} href="/tools">
              Back to the tools
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
