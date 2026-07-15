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
      <h1 style={{ fontWeight: 600, fontSize: 32, color: "#0a2338", marginBottom: 8 }}>Chord Library</h1>
      <p style={{ color: "#6a6560", marginBottom: 28 }}>Year One basics for every instrument we teach.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst}
            onClick={() => setInstrument(inst)}
            style={{
              padding: "9px 18px",
              borderRadius: 999,
              border: inst === instrument ? "1px solid #ef5130" : "1px solid #d8cab8",
              background: inst === instrument ? "#fdece6" : "#fff",
              fontWeight: 700,
              fontSize: 14,
              color: "#0a2338",
              cursor: "pointer",
            }}
          >
            {inst}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <div key={group.group} style={{ marginBottom: 36 }}>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 14 }}>
            {group.group}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {group.chords.map((chord) => (
              <div
                key={chord.name}
                style={{
                  textAlign: "center",
                  background: "#fffdf9",
                  border: "1px solid #ece0d5",
                  borderRadius: 12,
                  padding: "16px 18px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0a2338", marginBottom: 10 }}>{chord.name}</div>
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
