"use client";

import { useEffect, useState } from "react";
import { PIECES } from "@/lib/drums/kit";

// The keys are physical positions (KeyboardEvent.code), so the kit sits under the same fingers on
// any layout. Where the browser can say what a key prints (Chrome and Edge), the pads show that;
// elsewhere they show the QWERTY letter.
const QWERTY = Object.fromEntries(PIECES.map((p) => [p.code, p.label]));
let layout = null;

function readLayout() {
  if (!layout) {
    const kb = typeof navigator !== "undefined" ? navigator.keyboard : null;
    layout = kb?.getLayoutMap
      ? kb
          .getLayoutMap()
          .then((map) => {
            const out = { ...QWERTY };
            for (const p of PIECES) {
              const ch = map.get(p.code);
              if (ch && ch.trim()) out[p.code] = ch.toUpperCase();
            }
            return out;
          })
          .catch(() => QWERTY)
      : Promise.resolve(QWERTY);
  }
  return layout;
}

export function useKeyLabels() {
  const [labels, setLabels] = useState(QWERTY);
  useEffect(() => {
    let live = true;
    readLayout().then((l) => live && setLabels(l));
    return () => {
      live = false;
    };
  }, []);
  return labels;
}
