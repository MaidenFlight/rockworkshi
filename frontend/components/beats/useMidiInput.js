"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { MIDI_OFF, MidiLink, hitForVelocity } from "@/lib/drums/midiInput";

const noSubscribe = () => () => {};
const offState = () => MIDI_OFF;

// MIDI on the beat maker page: the connection, each note sent to the engine and lit on the kit, and
// the settings kept in this browser. Nothing is opened until someone asks for it; after that, a
// return visit reconnects by itself if the browser still allows it.
export function useMidiInput({ engine, prefs, setPrefs, flash }) {
  const [link] = useState(() => (typeof window === "undefined" ? null : new MidiLink(window.navigator)));
  const state = useSyncExternalStore(link ? link.subscribe : noSubscribe, link ? link.getState : offState, offState);

  const notes = prefs.midi.notes;
  useEffect(() => {
    link?.setNotes(notes);
  }, [link, notes]);

  useEffect(() => {
    if (!link || !engine) return;
    link.setNoteHandler(({ velocity, drum }) => {
      flash("midi");
      if (!drum) return;
      const { level, gain } = hitForVelocity(drum, velocity);
      engine.hitMidi(drum, level, gain);
      flash(drum);
    });
    return () => link.setNoteHandler(null);
  }, [link, engine, flash]);

  const wanted = prefs.midi.on;
  useEffect(() => {
    if (wanted) link?.resume();
  }, [link, wanted]);

  // Leaving the page gives the devices back.
  useEffect(() => () => link?.disconnect(), [link]);

  const connect = useCallback(async () => {
    if (await link?.connect()) setPrefs((p) => ({ midi: { ...p.midi, on: true } }));
  }, [link, setPrefs]);

  const disconnect = useCallback(() => {
    link?.disconnect();
    setPrefs((p) => ({ midi: { ...p.midi, on: false } }));
  }, [link, setPrefs]);

  const setNoteDrum = useCallback((note, drum) => setPrefs((p) => ({ midi: { ...p.midi, notes: { ...p.midi.notes, [note]: drum } } })), [setPrefs]);
  const resetNotes = useCallback(() => setPrefs((p) => ({ midi: { ...p.midi, notes: {} } })), [setPrefs]);

  return { link, state, notes, connect, disconnect, setNoteDrum, resetNotes };
}
