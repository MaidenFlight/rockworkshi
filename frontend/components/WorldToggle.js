"use client";

import { useEffect, useState } from "react";

// The world switch.
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
    try {
      window.localStorage.setItem(KEY, next);
    } catch {/* the choice still applies for this page view */}
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
