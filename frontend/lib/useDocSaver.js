"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Keeps a document being edited saved on the server. changed(next) says what it is now; with auto on,
// it's saved a moment after the last change, and saveNow() saves it at once and says whether that
// worked. Edits made while a save is on its way are sent straight after. state is "saved", "unsaved",
// "saving" or "error", and the page warns before closing unless it's "saved".
export function useDocSaver(save, { auto = true, delay = 900 } = {}) {
  const [state, setState] = useState("saved");
  const [error, setError] = useState("");
  const doc = useRef(null);
  const edits = useRef(0);
  const savedEdits = useRef(0);
  const running = useRef(null);
  const timer = useRef(null);
  const saver = useRef(save);

  useEffect(() => {
    saver.current = save;
  }, [save]);

  const saveNow = useCallback(() => {
    clearTimeout(timer.current);
    if (running.current) return running.current;
    if (savedEdits.current >= edits.current) return Promise.resolve(true);
    running.current = (async () => {
      try {
        while (savedEdits.current < edits.current) {
          const sending = edits.current;
          setState("saving");
          await saver.current(doc.current);
          savedEdits.current = sending;
        }
        setState("saved");
        setError("");
        return true;
      } catch (err) {
        setState("error");
        setError(err.message);
        return false;
      } finally {
        running.current = null;
      }
    })();
    return running.current;
  }, []);

  const changed = useCallback(
    (next) => {
      doc.current = next;
      edits.current += 1;
      setState("unsaved");
      clearTimeout(timer.current);
      if (auto) timer.current = setTimeout(saveNow, delay);
    },
    [auto, delay, saveNow]
  );

  // A fresh copy from the server, with nothing to save.
  const reset = useCallback((next) => {
    clearTimeout(timer.current);
    doc.current = next;
    edits.current = 0;
    savedEdits.current = 0;
    setState("saved");
    setError("");
  }, []);

  useEffect(() => {
    if (state === "saved") return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { state, error, changed, saveNow, reset };
}
