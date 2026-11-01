"use client";

import { useEffect, useRef, useState } from "react";
import { NetworkError, practiceRequest } from "@/lib/practice";

const MAX_NOTES = 5000;
const SAVE_AFTER_MS = 1500;

// Unsent text is kept in this browser too, so going offline or closing the tab doesn't lose it.
const draftKey = (userId, songId) => `rw-notes-draft:${userId}:${songId}`;
function readDraft(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeDraft(key, text) {
  try {
    if (text === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, text);
  } catch {
    // Storage blocked: the server copy still saves.
  }
}

// Private notes for one song. Saves itself a moment after typing stops.
export default function PracticeNotes({ songId, userId, initialNotes }) {
  const key = draftKey(userId, songId);
  const [savedText, setSavedText] = useState(initialNotes ?? "");
  // A draft left from an earlier visit isn't sent automatically: the note may have been
  // changed on the phone since, so the student chooses.
  const [leftover] = useState(() => {
    const draft = typeof window === "undefined" ? null : readDraft(key);
    return draft !== null && draft !== (initialNotes ?? "") ? draft : null;
  });
  const [text, setText] = useState(leftover ?? initialNotes ?? "");
  const [holding, setHolding] = useState(leftover !== null);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | offline | error
  const [error, setError] = useState("");
  const latest = useRef({ text, savedText, holding });
  useEffect(() => {
    latest.current = { text, savedText, holding };
  });

  const dirty = text !== savedText;

  async function save(value = text) {
    setStatus("saving");
    try {
      const { notes } = await practiceRequest(`/songs/${songId}/notes`, {
        method: "PUT",
        body: JSON.stringify({ notes: value }),
      });
      setSavedText(notes ?? "");
      setStatus("saved");
      writeDraft(key, null);
    } catch (err) {
      setStatus(err instanceof NetworkError ? "offline" : "error");
      setError(err.message);
    }
  }

  // Autosave once typing pauses.
  useEffect(() => {
    if (!dirty || holding) return;
    const id = setTimeout(() => save(text), SAVE_AFTER_MS);
    return () => clearTimeout(id);
    // save is recreated each render; text and dirty are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dirty, holding]);

  // Leaving with unsaved text: send it on the way out.
  useEffect(() => {
    return () => {
      const { text: pending, savedText: stored, holding: held } = latest.current;
      if (pending !== stored && !held) {
        practiceRequest(`/songs/${songId}/notes`, {
          method: "PUT",
          keepalive: true,
          body: JSON.stringify({ notes: pending }),
        }).catch(() => {}); // the local draft keeps it if this fails
      }
    };
  }, [songId]);

  const statusText = {
    idle: holding ? "These changes from your last visit weren't saved." : dirty ? "Not saved yet" : "Only you can see these notes.",
    saving: "Saving…",
    saved: dirty ? "Not saved yet" : "Saved. Only you can see these notes.",
    offline: "You're offline. Your note is kept on this device and will save when you retry.",
    error: `Couldn't save: ${error}`,
  }[status];

  return (
    <section aria-labelledby="notes-heading">
      <h2 id="notes-heading" style={{ fontWeight: 600, fontSize: 19, color: "var(--rw-ink)", margin: "0 0 10px" }}>
        My practice notes
      </h2>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          writeDraft(key, e.target.value);
          setHolding(false);
          if (status !== "saving") setStatus("idle");
        }}
        maxLength={MAX_NOTES}
        rows={5}
        aria-label="My practice notes"
        aria-describedby="notes-status"
        placeholder="What to work on, tricky bars, chord shapes, tempo goals…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--rw-line)",
          fontFamily: "inherit",
          fontSize: 14,
          lineHeight: 1.55,
          resize: "vertical",
          background: "#fff",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
        <span
          id="notes-status"
          role="status"
          style={{ fontSize: 12.5, color: status === "error" || status === "offline" ? "var(--rw-orange-deep)" : "var(--rw-meta)" }}
        >
          {statusText}
        </span>
        {holding && (
          <>
            <button type="button" onClick={() => { setHolding(false); save(); }} style={smallButton}>
              Save them
            </button>
            <button
              type="button"
              onClick={() => {
                setHolding(false);
                setText(savedText);
                writeDraft(key, null);
              }}
              style={smallButton}
            >
              Discard
            </button>
          </>
        )}
        {(status === "offline" || status === "error") && (
          <button type="button" onClick={() => save()} style={smallButton}>
            Retry
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--rw-meta)" }}>
          {text.length}/{MAX_NOTES}
        </span>
      </div>
    </section>
  );
}

const smallButton = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid var(--rw-line)",
  background: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
