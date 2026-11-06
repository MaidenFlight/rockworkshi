"use client";

import { useId, useState } from "react";

function saved(key, ids) {
  try {
    const v = window.localStorage.getItem(key);
    return ids.includes(v) ? v : null;
  } catch {
    return null;
  }
}

// Tabs for the studio column. Every panel stays mounted, so a mix being saved or a slider being
// dragged isn't lost by looking at another tab. Arrow keys move between tabs, as in any tablist.
export default function StudioTabs({ tabs, label = "Studio", storageKey = "rw-studio-tab" }) {
  const base = useId();
  const ids = tabs.map((t) => t.id);
  const [chosen, setChosen] = useState(() => saved(storageKey, ids) ?? ids[0]);
  const usable = tabs.filter((t) => !t.disabled);
  const current = usable.some((t) => t.id === chosen) ? chosen : usable[0]?.id;

  function choose(id) {
    setChosen(id);
    try {
      window.localStorage.setItem(storageKey, id);
    } catch {
      // Only a convenience.
    }
  }

  function onKey(e) {
    const i = usable.findIndex((t) => t.id === current);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? usable.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation(); // the player's own arrow keys move by bar
    const tab = usable[(next + usable.length) % usable.length];
    choose(tab.id);
    document.getElementById(`${base}-${tab.id}`)?.focus();
  }

  return (
    <div className="rw-tabs">
      <div role="tablist" aria-label={label} className="rw-tablist" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === current}
            aria-controls={`${base}-${t.id}-panel`}
            tabIndex={t.id === current ? 0 : -1}
            disabled={t.disabled}
            title={t.disabled ? t.hint : undefined}
            onClick={() => choose(t.id)}
            className="rw-tab"
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`${base}-${t.id}-panel`} role="tabpanel" aria-labelledby={`${base}-${t.id}`} hidden={t.id !== current} className="rw-tabpanel">
          {t.content}
        </div>
      ))}
    </div>
  );
}
