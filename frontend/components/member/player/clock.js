"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react";

// The player re-renders only a few times a second while a song plays (constant renders would
// starve the router's page changes), so anything that must glide reads the audio clock itself.
// getPosition returns the song position now; playing says whether it's moving.
export const PlayClock = createContext({ getPosition: null, playing: false });

// A cursor at song time `at`, somewhere between start and end. While the song plays it follows the
// audio clock every frame instead. place(element, fraction) moves the element; it must be a
// steady function. Returns the ref to put on the element. React never writes the moved attribute,
// so a render can't pull the cursor back.
export function useClockCursor(at, start, end, place) {
  const el = useRef(null);
  const { getPosition, playing } = useContext(PlayClock);
  const live = playing && getPosition;
  useLayoutEffect(() => {
    if (!el.current) return;
    const t = live ? getPosition() : at;
    place(el.current, Math.min(1, Math.max(0, (t - start) / (end - start))));
  });
  useEffect(() => {
    if (!live) return;
    let frame = requestAnimationFrame(function step() {
      if (el.current) place(el.current, Math.min(1, Math.max(0, (getPosition() - start) / (end - start))));
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [live, getPosition, start, end, place]);
  return el;
}
