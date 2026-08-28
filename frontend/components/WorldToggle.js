"use client";

import { useEffect, useState } from "react";

// The world switch.
//
// It writes one attribute — data-world on <html> — and everything else follows,
// because all 48 routes read shared token NAMES rather than colours. That is
// the whole mechanism: no theme context, no re-render, no per-component
// branching. Flipping the attribute repaints the site.
//
// The initial value is applied by a blocking inline script in layout.js, before
// first paint, so nobody sees the wrong world flash. This component therefore
// starts as null and fills in on mount rather than guessing: rendering a label
// during SSR would either be wrong for half of visitors or force a hydration
// mismatch, and both are worse than the control appearing a frame late.
const KEY = "rw-world";

export default function WorldToggle() {
  const [world, setWorld] = useState(null);

  useEffect(() => {
    setWorld(document.documentElement.dataset.world === "classic" ? "classic" : "silkie");
  }, []);

  function choose(next) {
    setWorld(next);
    if (next === "classic") {
      document.documentElement.dataset.world = "classic";
    } else {
      delete document.documentElement.dataset.world;
    }
    // Wrapped because Safari's private mode throws on write, and a design
    // preference is not worth breaking a page over.
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* the choice still applies for this page view */
    }
  }

  const options = [
    { id: "silkie", label: "Silkie" },
    { id: "classic", label: "Classic" },
  ];

  return (
    <div className="rw-worldswitch">
      <span className="rw-worldswitch-label" id="rw-world-label">
        Site design
      </span>
      {/* A radiogroup rather than a switch: there are two named designs and
          neither is "off", so a checkbox would have to invent which one counts
          as on. aria-checked follows the real state, and the pair is only
          announced once the mounted value is known. */}
      <div className="rw-worldswitch-track" role="radiogroup" aria-labelledby="rw-world-label">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={world === o.id}
            className="rw-worldswitch-btn"
            data-active={world === o.id ? "true" : "false"}
            onClick={() => choose(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
