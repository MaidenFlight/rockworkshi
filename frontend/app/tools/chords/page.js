"use client";

import { useState } from "react";
import { chordLibrary } from "@/lib/chords";
import { ChordDiagram, PianoDiagram } from "@/components/ChordDiagram";

const INSTRUMENTS = Object.keys(chordLibrary);

export default function ChordLibrary() {
  const [instrument, setInstrument] = useState("Guitar");
  const groups = chordLibrary[instrument];
  const isPiano = instrument === "Piano";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "var(--rw-ink)", marginBottom: 8 }}>Chord Library</h1>
      <p style={{ color: "var(--rw-body)", marginBottom: 28 }}>Year One basics for every instrument we teach.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst}
            onClick={() => setInstrument(inst)}
            style={{
              padding: "9px 18px",
              borderRadius: 999,
              border: inst === instrument ? "1px solid var(--rw-orange)" : "1px solid var(--rw-line)",
              background: inst === instrument ? "var(--rw-orange-tint)" : "#fff",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--rw-ink)",
              cursor: "pointer",
            }}
          >
            {inst}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <div key={group.group} style={{ marginBottom: 36 }}>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rw-teal)", marginBottom: 14 }}>
            {group.group}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {group.chords.map((chord) => (
              <div
                key={chord.name}
                style={{
                  textAlign: "center",
                  background: "var(--rw-surface)",
                  border: "1px solid var(--rw-border)",
                  borderRadius: 12,
                  padding: "16px 18px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--rw-ink)", marginBottom: 10 }}>{chord.name}</div>
                {isPiano ? (
                  <PianoDiagram notes={chord.notes} />
                ) : (
                  <ChordDiagram frets={chord.frets} base={chord.base} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
