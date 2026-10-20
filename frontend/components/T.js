"use client";

import { Children, useRef, useState } from "react";
import { useSiteText, tidy } from "@/contexts/SiteTextContext";

export default function T({ k, children }) {
  const { text, editing } = useSiteText();
  // Collapsed because JSX keeps the indentation around an entity at a line end.
  const original = tidy(Children.toArray(children).join(""));
  const value = text[k] ?? original;
  if (!editing) return value;
  return <EditableText k={k} value={value} original={original} />;
}

function EditableText({ k, value, original }) {
  const { save, setSelected, selected } = useSiteText();
  // Bumped to remount the span whenever the DOM text has to be thrown away (a save, or Esc).
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
