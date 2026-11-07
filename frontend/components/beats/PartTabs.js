"use client";

import { useRef, useState } from "react";
import { useVisual } from "@/components/metronome/visual";
import { MAX_PARTS, NAME_MAX, addPart, clearPart, countNotes, duplicatePart, isEmptyNotes, removePart, renamePart } from "@/lib/drums/beat";
import s from "./beats.module.css";

// The beat's parts as tabs (Verse, Chorus, Fill...): the grid and the pads work on the chosen one,
// and Loop part plays it. A lamp shows which part is sounding.
export default function PartTabs({ m }) {
  const { beat, selected } = m;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const tabRefs = useRef({});
  const lamps = useRef({});
  const full = beat.parts.length >= MAX_PARTS;

  useVisual((snap) => {
    for (const [id, el] of Object.entries(lamps.current)) {
      if (!el) continue;
      if (snap && !snap.countIn && snap.part === id) el.setAttribute("data-playing", "");
      else el.removeAttribute("data-playing");
    }
  });

  function choose(id, moveFocus) {
    m.selectPart(id);
    setRenaming(false);
    if (moveFocus) requestAnimationFrame(() => tabRefs.current[id]?.focus());
  }

  function onTabKey(e, index) {
    const last = beat.parts.length - 1;
    const to = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    choose(beat.parts[to].id, true);
  }

  // The new part's id is needed to select it, so the change is worked out here, from the beat on
  // screen, rather than inside the reducer.
  function add() {
    const r = addPart(beat, `Groove ${beat.parts.length + 1}`);
    if (!r.id) return;
    m.edit(() => r.beat);
    choose(r.id);
  }

  function copy() {
    const r = duplicatePart(beat, selected.id);
    if (!r.id) return;
    m.edit(() => r.beat);
    choose(r.id);
    setMessage(`Copied ${selected.name}. Change the copy and keep both.`);
  }

  function remove() {
    const gone = selected.name;
    const index = beat.parts.findIndex((p) => p.id === selected.id);
    const next = beat.parts[index + 1] || beat.parts[index - 1];
    m.edit((b) => removePart(b, selected.id));
    if (next) m.selectPart(next.id);
    setMessage(`Deleted ${gone}${beat.song.some((b) => b.part === selected.id) ? " and its places in the song" : ""}. Undo brings it back.`);
  }

  function clear() {
    m.edit((b) => clearPart(b, selected.id));
    setMessage(`Cleared ${selected.name}. Undo brings the notes back.`);
  }

  function startRename() {
    setName(selected.name);
    setRenaming(true);
  }

  function saveName(e) {
    e.preventDefault();
    if (!name.trim()) return;
    m.edit((b) => renamePart(b, selected.id, name));
    setRenaming(false);
  }

  return (
    <div className={s.parts}>
      <div className={s.partTabs} role="tablist" aria-label="Parts of the beat">
        {beat.parts.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              tabRefs.current[p.id] = el;
            }}
            type="button"
            role="tab"
            id={`bm-part-${p.id}`}
            aria-selected={p.id === selected.id}
            aria-controls="bm-part-panel"
            tabIndex={p.id === selected.id ? 0 : -1}
            className={s.partTab}
            onClick={() => choose(p.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            <span
              className={s.partLamp}
              ref={(el) => {
                lamps.current[p.id] = el;
              }}
              aria-hidden="true"
            />
            <span className={s.partName}>{p.name}</span>
            <span className={s.partCount}>{isEmptyNotes(p.notes) ? "empty" : `${countNotes(p.notes)} notes`}</span>
          </button>
        ))}
      </div>

      {renaming ? (
        <form className={s.renameRow} onSubmit={saveName}>
          <label className={s.srOnly} htmlFor="bm-part-name">
            New name for {selected.name}
          </label>
          <input
            id="bm-part-name"
            className={s.darkInput}
            value={name}
            maxLength={NAME_MAX}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
          />
          <button type="submit" className={s.smallKey} disabled={!name.trim()}>
            Save name
          </button>
          <button type="button" className={s.smallKey} onClick={() => setRenaming(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className={s.partActions}>
          <button type="button" className={s.smallKey} onClick={add} disabled={full} aria-label="New part">
            + New<span className={s.wideOnly}>part</span>
          </button>
          <button type="button" className={s.smallKey} onClick={copy} disabled={full}>
            Copy
          </button>
          <button type="button" className={s.smallKey} onClick={startRename}>
            Rename
          </button>
          <button type="button" className={s.smallKey} onClick={clear} disabled={isEmptyNotes(selected.notes)}>
            Clear
          </button>
          <button type="button" className={s.smallKey} onClick={remove} disabled={beat.parts.length <= 1}>
            Delete
          </button>
          {full && <span className={s.partNote}>{MAX_PARTS} parts is the most a beat can have.</span>}
        </div>
      )}
      <p className={s.partMessage} role="status">
        {message}
      </p>
    </div>
  );
}
