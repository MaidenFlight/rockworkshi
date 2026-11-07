"use client";

import { useState } from "react";
import { NAME_MAX, describeBeat, sameMusic } from "@/lib/drums/beat";
import { beatToMidi, midiFileName } from "@/lib/drums/midi";
import { shareUrl } from "@/lib/drums/share";
import s from "./beats.module.css";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function SavedItem({ item, m, current }) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(item.name);

  return (
    <li className={s.presetItem} data-layout="row">
      <div className={s.presetText}>
        <span className={s.presetName}>
          {item.name}
          {current && <span className={s.currentTag}>On screen</span>}
        </span>
        <span className={s.presetDesc}>{describeBeat(item.beat)}</span>
        {item.updatedAt > 0 && <span className={s.presetMeta}>Saved {dateFormat.format(item.updatedAt)}</span>}
      </div>
      <div className={s.presetActions}>
        {confirming ? (
          <>
            <span className={s.confirmText}>Delete “{item.name}” for good?</span>
            <button type="button" className={s.paperButtonDanger} onClick={() => m.removeSaved(item.id)}>
              Delete
            </button>
            <button type="button" className={s.paperButton} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button type="button" className={s.paperButtonStrong} onClick={() => m.load(item.beat)} disabled={current}>
              Open
            </button>
            <button
              type="button"
              className={s.paperButton}
              aria-expanded={renaming}
              onClick={() => {
                setName(item.name);
                setRenaming(!renaming);
              }}
            >
              Rename
            </button>
            <button type="button" className={s.paperButtonDanger} onClick={() => setConfirming(true)}>
              Delete
            </button>
          </>
        )}
      </div>
      {renaming && (
        <form
          className={s.renameForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (m.renameSaved(item.id, name)) setRenaming(false);
          }}
        >
          <label className={s.srOnly} htmlFor={`bm-rename-${item.id}`}>
            New name for {item.name}
          </label>
          <input id={`bm-rename-${item.id}`} className={s.textInput} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} autoFocus />
          <button type="submit" className={s.paperButtonStrong} disabled={!name.trim()}>
            Save name
          </button>
          <button type="button" className={s.paperButton} onClick={() => setRenaming(false)}>
            Cancel
          </button>
        </form>
      )}
    </li>
  );
}

// Saving in this browser, the list of saved beats, and taking a beat elsewhere: a link for
// another member, or a MIDI file for GarageBand or any other music program.
export default function SettingsSaved({ m }) {
  const { beat } = m;
  const [name, setName] = useState(null);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState("");

  const value = name ?? beat.name;
  const status = m.savedMatch ? `Saved as “${m.savedMatch.name}”.` : beat.name && m.saved.some((x) => x.name === beat.name) ? "Changed since it was saved." : "Not saved yet.";

  function save(e) {
    e.preventDefault();
    const result = m.saveAs(value);
    setMessage(result.message);
    if (result.ok) setName(null);
  }

  async function makeLink() {
    const url = shareUrl(beat, window.location.origin, window.location.pathname);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copied. Anyone with membership can open it.");
    } catch {
      setCopied("Copy the link from the box below.");
    }
  }

  function downloadMidi() {
    const blob = new Blob([beatToMidi(beat, m.playMode === "part" || !beat.song.length ? { part: m.selected.id, bars: 4 } : {})], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = midiFileName(beat);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={s.sections}>
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Save this beat</h3>
        <form className={s.saveForm} onSubmit={save}>
          <label className={s.numberLabel} htmlFor="bm-save-name">
            Name
          </label>
          <div className={s.saveRow}>
            <input
              id="bm-save-name"
              className={s.textInput}
              value={value}
              maxLength={NAME_MAX}
              placeholder="My first beat"
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className={s.paperButtonStrong} disabled={!value.trim()}>
              Save
            </button>
          </div>
          <p className={s.fieldHelp}>{status} Saving with a name already in the list saves over it.</p>
        </form>
        <p className={s.liveMessage} role="status">
          {message}
        </p>
        {(!m.persistent || m.storeNotice) && <p className={s.softNotice}>{m.storeNotice || "Saved beats will only last until you leave the page."}</p>}
      </section>

      <section className={s.section}>
        <h3 className={s.sectionTitle}>Your beats</h3>
        {m.saved.length === 0 ? (
          <p className={s.empty}>Nothing saved yet. The beat on screen is kept while you work, even if you leave and come back.</p>
        ) : (
          <ul className={s.presetList}>
            {m.saved.map((item) => (
              <SavedItem key={item.id} item={item} m={m} current={sameMusic(item.beat, beat)} />
            ))}
          </ul>
        )}
      </section>

      <section className={s.section}>
        <h3 className={s.sectionTitle}>Share or take it elsewhere</h3>
        <p className={s.prose}>
          A link carries the whole beat (its parts, song, tempo and name) and nothing about you. A MIDI file opens in GarageBand and most
          music programs: the {m.playMode === "part" || !beat.song.length ? `part ${m.selected.name}, four times over` : "whole song"}, on the
          General MIDI drum notes.
        </p>
        <div className={s.buttonRow}>
          <button type="button" className={s.paperButtonStrong} onClick={makeLink}>
            Copy a link
          </button>
          <button type="button" className={s.paperButton} onClick={downloadMidi}>
            Download MIDI
          </button>
        </div>
        <p className={s.liveMessage} role="status">
          {copied}
        </p>
        {link && (
          <div className={s.saveForm}>
            <label className={s.numberLabel} htmlFor="bm-link">
              Link to this beat
            </label>
            <input id="bm-link" className={s.textInput} value={link} readOnly onFocus={(e) => e.target.select()} />
          </div>
        )}
      </section>
    </div>
  );
}
