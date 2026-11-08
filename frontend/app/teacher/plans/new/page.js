"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import s from "@/components/teacher/Plans.module.css";
import Audience from "@/components/teacher/plans/Audience";
import { songLevels } from "@/lib/content";
import { todayHere } from "@/lib/months";
import { INSTRUMENTS, api, send } from "@/lib/studio";

export default function NewPlanPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p className="rw-st-muted">Loading…</p>}>
      <NewPlan />
    </Suspense>
  );
}

const START_WORDS = {
  suggest: "Suggest four weeks from the song's sections",
  template: "Use one of my templates",
  empty: "Start with an empty month",
};

// Starts a draft. Saving here only makes a draft: nobody sees it until it's published, and everything
// can still change on the next page.
function NewPlan() {
  const router = useRouter();
  const params = useSearchParams();
  const fromStudent = params.get("student") || "";
  const fromClass = params.get("class") || "";
  const fromTemplate = params.get("template") || "";

  const [data, setData] = useState(null);
  const [start, setStart] = useState(fromTemplate ? "template" : "suggest");
  const [templateId, setTemplateId] = useState(fromTemplate);
  const [songId, setSongId] = useState("");
  const [startsOn, setStartsOn] = useState(() => todayHere());
  const [level, setLevel] = useState(1);
  const [instrument, setInstrument] = useState("Guitar");
  const [readsChart, setReadsChart] = useState(false);
  const [studentIds, setStudentIds] = useState([]);
  const [classId, setClassId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api("/teacher/roster"), api("/teacher/content"), api("/teacher/plans?kind=template")])
      .then(([roster, content, templates]) => {
        setData({ roster, songs: content.songs.filter((x) => x.hasTracks), templates: templates.plans });
        const student = roster.students.find((p) => p.id === fromStudent);
        const cls = roster.classes.find((c) => c.id === fromClass);
        const template = templates.plans.find((t) => t.id === fromTemplate);
        const wanted = template?.instrument ?? student?.instrument ?? cls?.instruments?.[0];
        if (wanted && INSTRUMENTS.includes(wanted)) setInstrument(wanted);
        if (student) setStudentIds([student.id]);
        if (cls) {
          setClassId(cls.id);
          setStudentIds(cls.members.filter((m) => m.linked && m.instrument === (wanted ?? "Guitar")).map((m) => m.id));
        }
      })
      .catch((err) => setError(err.message));
  }, [fromStudent, fromClass, fromTemplate]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = start === "template" ? { templateId, startsOn, studentIds, classId } : { songId, startsOn, level, instrument, readsChart, studentIds, classId, start: start === "empty" ? "empty" : "suggest" };
      const { plan } = await send("/teacher/plans", "POST", body);
      router.push(`/teacher/plans/${plan.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!data) return error ? <p className="rw-st-error" role="alert">{error}</p> : <p className="rw-st-muted">Loading…</p>;

  const template = data.templates.find((t) => t.id === templateId);
  const song = data.songs.find((x) => x.id === songId);
  const ready = start === "template" ? Boolean(templateId) : Boolean(songId);

  return (
    <div className="rw-st">
      <div>
        <Link href="/teacher/plans" className={`rw-st-muted ${s.back}`}>
          ← Plans
        </Link>
        <h1 className="rw-st-title" style={{ marginTop: 6 }}>
          Plan a month
        </h1>
        <p className="rw-st-lead">Four weeks on one song. This only makes a draft: nothing reaches a student until you publish it.</p>
      </div>

      {error && (
        <p className="rw-st-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={create} className={`rw-st-card rw-st-form ${s.fieldStack}`} style={{ maxWidth: 620 }}>
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 6 }}>
          <legend className={s.sectionName} style={{ padding: 0 }}>
            Start from
          </legend>
          {Object.entries(START_WORDS).map(([id, label]) => (
            <label key={id} className={s.personRow}>
              <input type="radio" name="start" checked={start === id} onChange={() => setStart(id)} disabled={id === "template" && !data.templates.length} />
              <span>
                {label}
                {id === "template" && !data.templates.length ? <span className={s.personMeta}> · none saved yet</span> : null}
              </span>
            </label>
          ))}
        </fieldset>

        {start === "template" ? (
          <label className="rw-st-field">
            Template
            <select required value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Choose a template</option>
              {data.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {`${t.instrument} · Level ${t.level} · ${t.name}`}
                </option>
              ))}
            </select>
            {template?.song && <small>{`Song: ${template.song.title}`}</small>}
          </label>
        ) : (
          <>
            <label className="rw-st-field">
              Song
              <select required value={songId} onChange={(e) => setSongId(e.target.value)}>
                <option value="">Choose a song</option>
                {data.songs.map((x) => (
                  <option key={x.id} value={x.id}>
                    {`${x.title}${x.artist ? ` · ${x.artist}` : ""}${x.hasChart ? "" : " (no chart yet)"}`}
                  </option>
                ))}
              </select>
              {song && !song.hasChart && <small>This song has no chart with sections yet, so there are no sections to suggest or choose from. You can still add tasks by hand.</small>}
            </label>
            <div className="rw-st-row">
              <label className="rw-st-field">
                Instrument
                <select value={instrument} onChange={(e) => setInstrument(e.target.value)}>
                  {INSTRUMENTS.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
              <label className="rw-st-field">
                Level
                <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                  {songLevels.map((l) => (
                    <option key={l.n} value={l.n}>
                      {`${l.n}. ${l.name}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {start === "suggest" && (
              <label className="rw-st-check" style={{ minHeight: 44 }}>
                <input type="checkbox" checked={readsChart} onChange={(e) => setReadsChart(e.target.checked)} />
                Learning to read notation: keep the chart in the On my own weeks
              </label>
            )}
          </>
        )}

        <label className="rw-st-field">
          First day of week 1
          <input type="date" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          {start === "template" && <small>The template&apos;s due dates follow from this day.</small>}
        </label>

        <div>
          <p className={s.sectionName}>Who it&apos;s for</p>
          <Audience roster={data.roster} selected={studentIds} classId={classId} instrument={template?.instrument ?? instrument} onChange={({ classId: nextClass, studentIds: next }) => (setClassId(nextClass), setStudentIds(next))} />
          <p className="rw-st-muted" style={{ marginTop: 6 }}>
            You can change this before you publish.
          </p>
        </div>

        <div className={s.actions}>
          <button type="submit" className="rw-st-btn" data-tone="primary" disabled={busy || !ready}>
            {busy ? "Making the draft…" : "Make a draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
