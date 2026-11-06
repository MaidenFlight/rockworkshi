"use client";

import { createContext, useContext, useEffect, useEffectEvent } from "react";

// The beat lights, the counting line and the cycle view follow the audio clock, not React: the
// page reads the engine's snapshot on every animation frame and hands it to each of these, which
// write straight to their own DOM. React only renders when settings change.
export const VisualBus = createContext(null);

export function createVisualBus() {
  const listeners = new Set();
  let last = null;
  return {
    emit(snapshot) {
      last = snapshot;
      listeners.forEach((fn) => fn(snapshot));
    },
    // Hears every frame from now on, starting with the latest one.
    register(fn) {
      listeners.add(fn);
      fn(last);
      return () => listeners.delete(fn);
    },
  };
}

export function useVisual(onFrame) {
  const bus = useContext(VisualBus);
  const frame = useEffectEvent((snapshot) => onFrame(snapshot));
  useEffect(() => bus?.register((snapshot) => frame(snapshot)), [bus]);
}

// For a reduced-motion preference, read once and followed if it changes.
export function subscribeReducedMotion(onChange) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function reducedMotionNow() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
