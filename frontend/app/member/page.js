"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Icon from "@/components/member/Icon";
import PracticeNext from "@/components/member/PracticeNext";
import TeacherWork from "@/components/member/TeacherWork";
import UpcomingClasses from "@/components/member/UpcomingClasses";
import YourTerm from "@/components/member/YourTerm";
import { NetworkError, practiceRequest } from "@/lib/practice";
import { openableCount, pickPracticeNext } from "@/lib/practiceNext";

const TOOLS = [
  { name: "Tuner", icon: "tuner", href: "/tools/tuner" },
  { name: "Metronome", icon: "metronome", href: "/tools/metronome" },
  { name: "Chord library", icon: "chords", href: "/tools/chords" },
  { name: "Piano notes", icon: "keys", href: "/tools/piano" },
  { name: "Rhythm trainer", icon: "drum", href: "/tools/rhythm" },
];

// What a request that failed should say, offline or not.
const why = (err) => (err instanceof NetworkError ? "You're offline. Check your connection and try again." : err.message);

export default function MemberDashboard() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  // undefined while loading; each one fails on its own so the rest of the page still shows.
  const [library, setLibrary] = useState(undefined);
  const [term, setTerm] = useState(undefined);
  const [assignments, setAssignments] = useState(undefined);
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/lessons`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLessons(data.lessons || []))
      .catch(() => setLessons([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([practiceRequest("/library"), practiceRequest("/term"), practiceRequest("/assignments?page=1&pageSize=20")]).then(
      ([lib, t, work]) => {
        if (cancelled) return;
        setLibrary(lib.status === "fulfilled" ? lib.value : null);
        setTerm(t.status === "fulfilled" ? t.value : null);
        setAssignments(work.status === "fulfilled" ? work.value.assignments : []);
        // Only worth a message when there's nothing to pick from at all.
        setFailure(lib.status === "rejected" && t.status === "rejected" ? why(lib.reason) : "");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const loaded = library !== undefined && term !== undefined && assignments !== undefined;
  const next = loaded && !failure ? pickPracticeNext({ library, term, assignments }) : null;
  const ready = openableCount(library);
  const favourites = (library?.songs ?? []).filter((s) => s.favorite).length;
  const firstName = user?.name?.split(" ")[0];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 100px" }}>
      <h1 className="rw-dash-title">
        {next?.isNew ? "Welcome" : "Welcome back"}
        {firstName ? `, ${firstName}` : ""}
      </h1>

      <div className="rw-dash">
        <div className="rw-dash-main">
          <PracticeNext
            next={next}
            failed={failure}
            onRetry={() => {
              setFailure("");
              setLibrary(undefined);
              setAttempt((n) => n + 1);
            }}
          />

          {/* useSearchParams needs a Suspense boundary in a client page. */}
          <div className="rw-dash-work">
            <Suspense fallback={null}>
              <TeacherWork exclude={next?.kind === "assignment" ? next.assignment.id : null} />
            </Suspense>
          </div>

          {lessons.length > 0 && (
            <section aria-labelledby="your-lessons">
              <h2 id="your-lessons" className="rw-dash-h2">
                Lesson videos
              </h2>
              <ul className="rw-dash-list">
                {lessons.map((lesson) => {
                  // Lesson videos aren't all ready, and a lesson without one has nothing to open yet.
                  const hasVideo = Boolean(lesson.videoUrl || lesson.playthroughVideoUrl);
                  const status = lesson.locked ? "Unlocks with your term" : hasVideo ? lesson.estTime : "Coming soon";
                  const inside = (
                    <>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="rw-dash-row-title">{lesson.title}</span>
                        <span className="rw-dash-row-meta">{[lesson.artist, lesson.difficulty, lesson.key].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="rw-dash-row-status">{status}</span>
                    </>
                  );
                  return (
                    <li key={lesson.id}>
                      {hasVideo || lesson.locked ? (
                        <Link href={`/member/lesson/${lesson.id}`} className="rw-dash-row" data-link="true">
                          {inside}
                        </Link>
                      ) : (
                        <div className="rw-dash-row">{inside}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="rw-dash-side" aria-label="Your week and your tools">
          <UpcomingClasses />
          <YourTerm data={term} />
          <nav className="rw-st-card" aria-labelledby="practice-room">
            <h2 id="practice-room">Practice room</h2>
            <ul className="rw-dash-tools">
              <li>
                <Link href="/member/library">
                  <Icon name="library" size={20} />
                  <span style={{ flex: 1 }}>Practice library</span>
                  {library && (
                    <span className="rw-dash-row-meta">
                      {ready} to play{favourites ? ` · ${favourites} starred` : ""}
                    </span>
                  )}
                </Link>
              </li>
              {TOOLS.map((tool) => (
                <li key={tool.href}>
                  <Link href={tool.href}>
                    <Icon name={tool.icon} size={20} />
                    <span>{tool.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
