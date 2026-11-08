"use client";

import { useSyncExternalStore } from "react";
import { GRID_ORDER, PIECE_BY_ID } from "@/lib/drums/kit";
import { NO_DRUM, drumForNote } from "@/lib/drums/midiInput";
import s from "./beats.module.css";

const noSubscribe = () => () => {};
const noNote = () => null;

// The note just played and what it plays. Choosing another drum here is how a kit or keyboard with
// unusual note numbers gets set up: hit the pad, then pick.
function LastNote({ midi }) {
  const { link, notes, setNoteDrum } = midi;
  const last = useSyncExternalStore(link ? link.subscribeNote : noSubscribe, link ? link.getLastNote : noNote, noNote);
  if (!last) return <p className={s.fieldHelp}>Hit a pad or press a key and its note will show here.</p>;
  return (
    <div className={s.midiLast}>
      <p className={s.midiNote}>
        <span className={s.midiNoteNumber}>Note {last.note}</span> velocity {last.velocity}, channel {last.channel}
      </p>
      <label className={s.midiPick}>
        <span>Plays</span>
        <select className={s.midiSelect} value={drumForNote(last.note, notes) || NO_DRUM} onChange={(e) => setNoteDrum(last.note, e.target.value)}>
          {GRID_ORDER.map((id) => (
            <option key={id} value={id}>
              {PIECE_BY_ID[id].name}
            </option>
          ))}
          <option value={NO_DRUM}>Nothing</option>
        </select>
      </label>
    </div>
  );
}

// Connecting an electronic kit, pad controller or keyboard, in the Kit tab.
export default function MidiSection({ midi }) {
  const { status, devices } = midi.state;
  const changed = Object.keys(midi.notes).length > 0;

  return (
    <section className={s.section}>
      <h3 className={s.sectionTitle}>MIDI</h3>

      {status === "unsupported" ? (
        <p className={s.prose}>
          This browser can&rsquo;t use MIDI devices. To play the kit from electronic drums or a pad controller, open this page in Chrome, Edge or
          Firefox on a computer, or Chrome on Android.
        </p>
      ) : (
        <p className={s.prose}>
          Play this kit from an electronic drum kit, a pad controller or a MIDI keyboard. How hard you hit sets how loud it sounds, and Record
          writes what you play into the part.
        </p>
      )}

      {status === "asking" && (
        <p className={s.softNotice} role="status">
          Your browser is asking whether this site can use MIDI devices. Choose Allow.
        </p>
      )}
      {status === "blocked" && (
        <p className={s.softNotice} role="alert">
          Your browser didn&rsquo;t allow MIDI on this site. Press Connect MIDI and choose Allow. If it doesn&rsquo;t ask, click the icon to the left of
          the web address and allow MIDI devices there.
        </p>
      )}
      {status === "failed" && (
        <p className={s.softNotice} role="alert">
          MIDI couldn&rsquo;t start in this browser. Reload the page and press Connect MIDI again.
        </p>
      )}

      {status === "on" && (
        <div className={s.midiPanel}>
          {devices.length > 0 ? (
            <p className={s.prose} role="status">
              Connected to <strong>{devices.map((d) => d.name).join(", ")}</strong>.
            </p>
          ) : (
            <p className={s.prose} role="status">
              Ready, but no MIDI device is plugged in. Plug one in and it will show up here. If it is plugged in already, close any music program
              that may be using it, then unplug it and plug it back in.
            </p>
          )}
          {devices.length > 0 && <LastNote midi={midi} />}
          {devices.length > 0 && (
            <p className={s.fieldHelp}>The standard drum notes are already set up. If a pad plays the wrong drum, hit it, then choose the right one here.</p>
          )}
        </div>
      )}

      {status !== "unsupported" && (
        <div className={s.buttonRow}>
          {status === "on" ? (
            <>
              <button type="button" className={s.paperButton} disabled={!changed} onClick={midi.resetNotes}>
                Reset the notes
              </button>
              <button type="button" className={s.paperButton} onClick={midi.disconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <button type="button" className={s.paperButtonStrong} disabled={status === "asking"} onClick={midi.connect}>
              Connect MIDI
            </button>
          )}
        </div>
      )}
    </section>
  );
}
