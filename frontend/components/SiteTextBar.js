"use client";

import { useSiteText } from "@/contexts/SiteTextContext";

const MESSAGES = {
  saving: "Saving…",
  saved: "Saved. Visitors see it on their next page load.",
  restored: "Original wording restored.",
};

// Admins only. Collapsed it is one button; open, it explains itself, reports
// every save, and offers to undo the last piece of text touched.
export default function SiteTextBar() {
  const { canEdit, editing, setEditing, selected, text, restore, status } = useSiteText();
  if (!canEdit) return null;

  if (!editing) {
    return (
      <button type="button" className="rw-textbar-open" onClick={() => setEditing(true)}>
        Edit text
      </button>
    );
  }

  const canRestore = selected && selected in text;

  return (
    <div className="rw-textbar" role="region" aria-label="Text editing">
      <p className="rw-textbar-help">
        <strong>Editing text.</strong> Click any outlined words and type. Enter saves, Esc cancels.
      </p>
      <p className="rw-textbar-status" aria-live="polite" data-state={status?.state}>
        {status ? status.message || MESSAGES[status.state] : ""}
      </p>
      <div className="rw-textbar-actions">
        <button type="button" className="rw-textbar-btn" disabled={!canRestore} onClick={() => restore(selected)}>
          Restore original
        </button>
        <button type="button" className="rw-textbar-btn rw-textbar-done" onClick={() => setEditing(false)}>
          Done
        </button>
      </div>
    </div>
  );
}
