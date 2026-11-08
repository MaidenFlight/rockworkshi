"use client";

import { songLevels } from "@/lib/content";
import { DEFAULT_CRITERIA, HELP, WEEKS, rangeName } from "@/lib/months";
import { formatClock, parseClock } from "@/lib/teaching";
import s from "./Month.module.css";

const MAX_INSTRUCTION = 500;
const MAX_SECTION = 80;
const MAX_CRITERIA = 6;
const MAX_CRITERION = 80;
const near = (a, b) => a !== null && a !== undefined && Math.abs(a - b) < 0.01;

// A time in the song, typed as 1:05. It only changes the task once the box is left with a real time.
function ClockInput({ label, value, onChange }) {
  return (
    <label className="rw-st-field">
      {label}
      <input
        key={value ?? "none"}
        defaultValue={formatClock(value)}
        inputMode="numeric"
        placeholder="0:00"
        className={s.clock}
        onBlur={(e) => {
          const text = e.target.value.trim();
          if (text === formatClock(value)) return;
          const parsed = parseClock(text);
          if (!Number.isNaN(parsed)) onChange(parsed);
          else e.target.value = formatClock(value);
        }}
      />
    </label>
  );
}

// Everything a teacher can set on one task. sections are the song's own, from its chart: choosing them
// fills in the times, which can then be nudged to cover any bars.
export default function TaskFields({ task, sections = [], onChange }) {
  const from = sections.findIndex((x) => near(task.sectionStart, x.start));
  const to = sections.findIndex((x) => near(task.sectionEnd, x.end));
  const hasRange = task.sectionStart !== null && task.sectionStart !== undefined;
  const matchesSections = hasRange && from >= 0 && to >= from;

  function chooseFrom(value) {
    if (value === "") return onChange({ sectionStart: null, sectionEnd: null });
    const i = Number(value);
    const last = to >= i ? to : i;
    onChange({ sectionStart: sections[i].start, sectionEnd: sections[last].end, section: rangeName(sections[i], sections[last]) });
  }

  function chooseTo(value) {
    const i = Number(value);
    const first = from >= 0 && from <= i ? from : i;
    onChange({ sectionStart: sections[first].start, sectionEnd: sections[i].end, section: rangeName(sections[first], sections[i]) });
  }

  function chooseKind(kind) {
    onChange({ kind, ...(kind === "assessment" && !task.criteria?.length ? { criteria: [...DEFAULT_CRITERIA] } : {}) });
  }

  const criteria = task.criteria ?? [];
  const setCriteria = (list) => onChange({ criteria: list });

  return (
    <div className={s.fields}>
      <div className="rw-st-row">
        <label className="rw-st-field">
          Kind of task
          <select value={task.kind} onChange={(e) => chooseKind(e.target.value)}>
            <option value="checkpoint">Practice checkpoint</option>
            <option value="assessment">Weekly assessment</option>
          </select>
        </label>
        <label className="rw-st-field">
          Week
          <select value={task.week} onChange={(e) => onChange({ week: Number(e.target.value) })}>
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>
        <label className="rw-st-field">
          Due
          <input type="date" value={task.dueOn ?? ""} onChange={(e) => onChange({ dueOn: e.target.value || null })} />
        </label>
        <label className="rw-st-field">
          Level
          <select value={task.level} onChange={(e) => onChange({ level: Number(e.target.value) })}>
            {songLevels.map((l) => (
              <option key={l.n} value={l.n}>
                {l.n}. {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rw-st-row">
        {sections.length > 0 && (
          <>
            <label className="rw-st-field">
              From
              <select value={matchesSections ? String(from) : hasRange ? "custom" : ""} onChange={(e) => chooseFrom(e.target.value)}>
                <option value="">The whole song</option>
                {hasRange && !matchesSections && (
                  <option value="custom" disabled>
                    The times below
                  </option>
                )}
                {sections.map((x, i) => (
                  <option key={`${x.name}-${i}`} value={i}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="rw-st-field">
              To
              <select value={matchesSections ? String(to) : ""} disabled={!matchesSections} onChange={(e) => chooseTo(e.target.value)}>
                {!matchesSections && <option value="">Choose From first</option>}
                {sections.map((x, i) => (
                  <option key={`${x.name}-${i}`} value={i} disabled={matchesSections && i < from}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <ClockInput label="Starts at" value={task.sectionStart} onChange={(t) => onChange({ sectionStart: t })} />
        <ClockInput label="Ends at" value={task.sectionEnd} onChange={(t) => onChange({ sectionEnd: t })} />
      </div>

      <label className="rw-st-field">
        What the student sees it called
        <input value={task.section ?? ""} maxLength={MAX_SECTION} onChange={(e) => onChange({ section: e.target.value })} placeholder="Verse 1 + Chorus 1" />
      </label>

      <div className="rw-st-row">
        <label className="rw-st-field">
          Recording
          <select value={task.media} onChange={(e) => onChange({ media: e.target.value })}>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>
        </label>
        <label className="rw-st-field">
          Help in the final take
          <select value={task.support ?? ""} onChange={(e) => onChange({ support: e.target.value || null })}>
            <option value="">Any help</option>
            {Object.entries(HELP).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="rw-st-field">
          Target speed (%)
          <input
            type="number"
            min={50}
            max={100}
            step={5}
            value={task.targetSpeed ?? ""}
            placeholder="Any"
            onChange={(e) => onChange({ targetSpeed: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      </div>

      {task.media === "video" && (
        <label className="rw-st-check">
          <input type="checkbox" checked={Boolean(task.audioAllowed)} onChange={(e) => onChange({ audioAllowed: e.target.checked })} />
          Accept audio instead of video
        </label>
      )}

      <label className="rw-st-field">
        Instructions for the student
        <textarea value={task.instruction ?? ""} maxLength={MAX_INSTRUCTION} onChange={(e) => onChange({ instruction: e.target.value })} />
      </label>

      {task.kind === "assessment" ? (
        <fieldset className={s.criteria}>
          <legend>What you&apos;ll mark</legend>
          {criteria.map((c, i) => (
            <div key={i} className={s.criterion}>
              <input
                className="rw-st-input"
                aria-label={`Assessment criterion ${i + 1}`}
                value={c}
                maxLength={MAX_CRITERION}
                onChange={(e) => setCriteria(criteria.map((x, k) => (k === i ? e.target.value : x)))}
              />
              <button type="button" className="rw-st-btn" onClick={() => setCriteria(criteria.filter((_, k) => k !== i))}>
                Remove
              </button>
            </div>
          ))}
          {criteria.length < MAX_CRITERIA && (
            <div>
              <button type="button" className="rw-st-btn" onClick={() => setCriteria([...criteria, ""])}>
                Add a criterion
              </button>
            </div>
          )}
        </fieldset>
      ) : (
        <label className="rw-st-check">
          <input type="checkbox" checked={Boolean(task.reviewCheckpoint)} onChange={(e) => onChange({ reviewCheckpoint: e.target.checked })} />
          Put takes for this checkpoint in my review queue too
        </label>
      )}
    </div>
  );
}
