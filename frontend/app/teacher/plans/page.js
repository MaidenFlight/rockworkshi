"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "@/components/teacher/Plans.module.css";
import { songLevels } from "@/lib/content";
import { dayLabel } from "@/lib/months";
import { PLAN_STATUS, count } from "@/lib/plans";
import { INSTRUMENTS, api } from "@/lib/studio";

const TABS = [
  { id: "drafts", label: "Drafts", query: "kind=plan&status=draft" },
  { id: "published", label: "Published", query: "kind=plan&status=published" },
  { id: "templates", label: "Templates", query: "kind=template" },
  { id: "archived", label: "Archived", query: "status=archived" },
];

const EMPTY = {
  drafts: ["No drafts", "Plan a month to start one. Nothing reaches a student until you publish it."],
  published: ["Nothing published yet", "Months you publish are listed here, so you can change them for a whole group."],
  templates: ["No templates yet", "Open a plan and choose Save as a template, then use it for another student or class."],
  archived: ["Nothing archived", "Plans and templates you archive are kept here and can be restored."],
};

export default function PlansPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={<p className="rw-st-muted">Loading…</p>}>
      <Plans />
    </Suspense>
  );
}

function Plans() {
  const wanted = useSearchParams().get("tab");
  const tab = TABS.find((t) => t.id === wanted) ?? TABS[0];
  const [state, setState] = useState({ tab: null, list: null, error: "" });

  useEffect(() => {
    let stale = false;
    const load = async () => {
      if (tab.id !== "archived") return (await api(`/teacher/plans?${tab.query}`)).plans;
      // Archived plans and templates together, newest first.
      const [plans, templates] = await Promise.all([api("/teacher/plans?kind=plan&status=archived"), api("/teacher/plans?kind=template&status=archived")]);
      return [...plans.plans, ...templates.plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    };
    load()
      .then((list) => !stale && setState({ tab: tab.id, list, error: "" }))
      .catch((err) => !stale && setState({ tab: tab.id, list: [], error: err.message }));
    return () => {
      stale = true;
    };
  }, [tab.id, tab.query]);

  const list = state.tab === tab.id ? state.list : null;

  return (
    <div className="rw-st">
      <div className="rw-st-head">
        <div>
          <h1 className="rw-st-title">Plans</h1>
          <p className="rw-st-lead">Months of practice on a song: drafted here, previewed, and published when they&apos;re ready.</p>
        </div>
        <Link href="/teacher/plans/new" className="rw-st-btn" data-tone="primary" style={{ minHeight: 44 }}>
          Plan a month
        </Link>
      </div>

      <nav className="rw-st-tabs" aria-label="Plans" style={{ marginBottom: 0 }}>
        {TABS.map((t) => (
          <Link key={t.id} href={t.id === "drafts" ? "/teacher/plans" : `/teacher/plans?tab=${t.id}`} className="rw-st-tab" aria-current={t.id === tab.id ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {state.error && (
        <p className="rw-st-error" role="alert">
          {state.error}
        </p>
      )}

      {list === null ? (
        <p className="rw-st-muted">Loading…</p>
      ) : list.length === 0 ? (
        !state.error && (
          <div className="rw-st-empty">
            <strong>{EMPTY[tab.id][0]}</strong>
            {EMPTY[tab.id][1]}
          </div>
        )
      ) : tab.id === "templates" ? (
        <Templates list={list} />
      ) : (
        <ul className={s.rows}>
          {list.map((p) => (
            <li key={p.id}>
              <PlanRow plan={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanRow({ plan: p }) {
  const template = p.kind === "template";
  const meta = [p.song?.title ?? "Song removed", p.instrument, `Level ${p.level}`, p.startsOn ? `starts ${dayLabel(p.startsOn)}` : null, count(p.tasks, "task")].filter(Boolean).join(" · ");
  const who = template ? "Template" : p.class ? `${p.class.title}, ${count(p.students, "student")}` : count(p.students, "student");
  return (
    <Link href={`/teacher/plans/${p.id}`} className={s.row}>
      <div className={s.rowMain}>
        <div className={s.rowTitle}>{p.name}</div>
        <div className={s.rowMeta}>{meta}</div>
      </div>
      <div className={s.chips}>
        <span className="rw-st-chip">{who}</span>
        {!template && p.status !== "draft" && <span className="rw-st-chip" data-tone={p.status === "published" ? "good" : "warn"}>{PLAN_STATUS[p.status]}</span>}
      </div>
    </Link>
  );
}

// Templates by instrument, then level, so the right one is quick to find.
function Templates({ list }) {
  const groups = INSTRUMENTS.map((instrument) => ({
    instrument,
    levels: songLevels.map((l) => ({ ...l, rows: list.filter((t) => t.instrument === instrument && t.level === l.n) })).filter((l) => l.rows.length),
  })).filter((g) => g.levels.length);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {groups.map((g) => (
        <section key={g.instrument} aria-labelledby={`templates-${g.instrument}`}>
          <h2 id={`templates-${g.instrument}`} className={s.groupName}>
            {g.instrument}
          </h2>
          {g.levels.map((l) => (
            <div key={l.n}>
              <h3 className={s.levelName}>{`Level ${l.n}: ${l.name}`}</h3>
              <ul className={s.rows}>
                {l.rows.map((t) => (
                  <li key={t.id} className={s.row}>
                    <div className={s.rowMain}>
                      <div className={s.rowTitle}>{t.name}</div>
                      <div className={s.rowMeta}>{[t.song?.title ?? "Song removed", count(t.tasks, "task"), `version ${t.version}`].join(" · ")}</div>
                    </div>
                    <div className={s.rowEnd}>
                      <Link href={`/teacher/plans/${t.id}`} className="rw-st-btn">
                        Edit
                      </Link>
                      <Link href={`/teacher/plans/new?template=${t.id}`} className="rw-st-btn" data-tone="primary">
                        Use this template
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
