"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/auth/roles";

// Wording is one line of plain text: runs of whitespace (JSX indentation, a
// typed newline) render as a single space anyway, so they are stored as one.
export function tidy(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

const SiteTextContext = createContext({ text: {}, editing: false, canEdit: false });

// Edit mode lives in sessionStorage so it survives a reload in the same tab.
// Read through useSyncExternalStore: the server (and hydration) always sees
// "off", and the client switches over right after, with no mismatch.
const EDIT_FLAG = "rw-edit-text";
const listeners = new Set();
function readEditing() {
  try {
    return sessionStorage.getItem(EDIT_FLAG) === "1";
  } catch {
    return false;
  }
}
function writeEditing(on) {
  try {
    if (on) sessionStorage.setItem(EDIT_FLAG, "1");
    else sessionStorage.removeItem(EDIT_FLAG);
  } catch {}
  listeners.forEach((l) => l());
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function SiteTextProvider({ initialText, children }) {
  const { role } = useAuth();
  const canEdit = role === ROLES.ADMINISTRATOR;

  const [text, setText] = useState(initialText || {});
  const editing = useSyncExternalStore(subscribe, readEditing, () => false);
  // The last piece of text clicked, so "Restore original" knows what it means
  // after focus has moved to the button.
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);

  const setEditing = useCallback((on) => {
    writeEditing(on);
    if (!on) setSelected(null);
  }, []);

  const refreshPages = () => fetch("/api/site-text", { method: "POST" }).catch(() => {});

  const restore = useCallback(async (key) => {
    if (!(key in text)) return;
    const previous = text[key];
    setText((t) => {
      const copy = { ...t };
      delete copy[key];
      return copy;
    });
    setStatus({ state: "saving" });
    try {
      const res = await fetch(`${API_URL}/admin/site-text/${encodeURIComponent(key)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Couldn't restore the original.");
      await refreshPages();
      setStatus({ state: "restored" });
    } catch (err) {
      setText((t) => ({ ...t, [key]: previous }));
      setStatus({ state: "error", message: err.message === "Failed to fetch" ? "Couldn't reach the server." : err.message });
    }
  }, [text]);

  const save = useCallback(async (key, value, original) => {
    // One line of plain text: a typed newline would render as a space anyway.
    const next = tidy(value);
    // Typing the original back, or clearing the text, both mean "the page's
    // own wording" — store nothing rather than a copy of it.
    if (!next || next === original) {
      if (key in text) return restore(key);
      return;
    }
    if (next === text[key]) return;
    const previous = text[key];
    setText((t) => ({ ...t, [key]: next }));
    setStatus({ state: "saving" });
    try {
      const res = await fetch(`${API_URL}/admin/site-text/${encodeURIComponent(key)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save.");
      await refreshPages();
      setStatus({ state: "saved" });
    } catch (err) {
      setText((t) => {
        const copy = { ...t };
        if (previous === undefined) delete copy[key];
        else copy[key] = previous;
        return copy;
      });
      setStatus({ state: "error", message: err.message === "Failed to fetch" ? "Couldn't reach the server. Your change wasn't saved." : err.message });
    }
  }, [text, restore]);


  const value = useMemo(
    () => ({ text, editing: editing && canEdit, canEdit, setEditing, selected, setSelected, status, save, restore }),
    [text, editing, canEdit, setEditing, selected, status, save, restore]
  );

  return <SiteTextContext.Provider value={value}>{children}</SiteTextContext.Provider>;
}

export function useSiteText() {
  return useContext(SiteTextContext);
}
