"use client";

import { Children, useRef, useState } from "react";
import { useSiteText, tidy } from "@/contexts/SiteTextContext";

// Marks a run of wording an admin can change from the page itself:
//
//   <h1><T k="format.hero.title">Format & Pricing</T></h1>
//
// The children are the original and stay the source of truth: an edit is
// stored against `k`, and restoring it deletes that row. For a visitor this
// renders the bare string — no wrapper element, nothing in the DOM to pay for.
// Only an admin in edit mode gets the editable span.
//
// Children must be plain text. Wording with a link or <strong> inside it is
// either split into several <T>s around the markup or left uneditable.
export default function T({ k, children }) {
  const { text, editing } = useSiteText();
  // Collapsed because JSX keeps the indentation around an entity at a line
  // end. A page never shows it (HTML collapses runs of spaces), but an
  // editable span is pre-wrap and would.
  const original = tidy(Children.toArray(children).join(""));
  const value = text[k] ?? original;
  if (!editing) return value;
  return <EditableText k={k} value={value} original={original} />;
}

function EditableText({ k, value, original }) {
  const { save, setSelected, selected } = useSiteText();
  // Bumped to remount the span whenever the DOM text has to be thrown away
  // (a save, or Esc). React owns the text node inside it, and a contentEditable
  // edit replaces that node behind React's back.
  const [version, setVersion] = useState(0);
  const cancelled = useRef(false);

  return (
    <span
      key={version}
      className="rw-editable"
      data-selected={selected === k || undefined}
      data-changed={value !== original || undefined}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={`Edit text: ${value.slice(0, 60)}`}
      title={value !== original ? `Changed. Original: “${original}”` : "Click to edit"}
      // A <T> inside a link or button must not follow it while editing.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onFocus={() => setSelected(k)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const typed = e.currentTarget.textContent;
        if (cancelled.current) {
          cancelled.current = false;
          setVersion((v) => v + 1);
          return;
        }
        if (typed !== value) {
          save(k, typed, original);
          setVersion((v) => v + 1);
        }
      }}
    >
      {value}
    </span>
  );
}
