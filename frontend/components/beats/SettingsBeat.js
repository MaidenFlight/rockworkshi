"use client";

import { useState } from "react";
import { METERS, METER_IDS, NAME_MAX, blankBeat, canSwing, meterOf, setBeatName, setMeter, setSwing } from "@/lib/drums/beat";
import { starterBeat } from "@/lib/drums/grooves";
import s from "./beats.module.css";

// The beat as a whole: its name, its meter, how the swing falls, and starting again.
export default function SettingsBeat({ m }) {
  const { beat } = m;
  const meter = meterOf(beat);
  const [name, setName] = useState(null);
  const [message, setMessage] = useState("");

  const commitName = () => {
    if (name === null) return;
    m.edit((b) => setBeatName(b, name));
    setName(null);
  };

  return (
    <div className={s.sections}>
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Name</h3>
        <div className={s.saveForm}>
          <label className={s.numberLabel} htmlFor="bm-beat-name">
            What this beat is called
          </label>
          <input
            id="bm-beat-name"
            className={s.textInput}
            value={name ?? beat.name}
            maxLength={NAME_MAX}
            placeholder="Untitled beat"
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && commitName()}
          />
        </div>
      </section>

      <section className={s.section}>
        <fieldset className={s.field}>
          <legend className={s.fieldLegend}>Meter</legend>
          <div className={s.choices}>
            {METER_IDS.map((id) => (
              <label key={id} className={s.choice}>
                <input
                  className={s.choiceInput}
                  type="radio"
                  name="bm-meter"
                  checked={beat.meter === id}
                  onChange={() => {
                    m.edit((b) => setMeter(b, id));
                    setMessage(`Every part is in ${id} now. Notes moved to the nearest step${METERS[id].beats < meter.beats ? ", and any past the end of the shorter bar went" : ""}; Undo takes it back.`);
                  }}
                />
                <span className={s.choiceLabel}>{METERS[id].name}</span>
                <span className={s.choiceDetail}>{METERS[id].detail}</span>
              </label>
            ))}
          </div>
          <p className={s.fieldHelp}>
            4/4 and 3/4 are written in sixteenths. 12/8 and 6/8 are written in triplets, three to a beat, so a shuffle is built into the grid
            and the tempo counts dotted quarters.
          </p>
        </fieldset>
        <p className={s.liveMessage} role="status">
          {message}
        </p>
      </section>

      <section className={s.section}>
        <fieldset className={s.field} disabled={!canSwing(meter)}>
          <legend className={s.fieldLegend}>Swing falls on</legend>
          <div className={s.choices} data-columns="two">
            {[
              { unit: 8, label: "Eighths", detail: "The & of each beat comes late: shuffles, blues, jazz" },
              { unit: 16, label: "Sixteenths", detail: "The e and a come late: funk, hip-hop" },
            ].map((o) => (
              <label key={o.unit} className={s.choice} data-disabled={canSwing(meter) ? undefined : "true"}>
                <input className={s.choiceInput} type="radio" name="bm-swing-unit" checked={beat.swingUnit === o.unit} onChange={() => m.edit((b) => setSwing(b, b.swing, o.unit))} />
                <span className={s.choiceLabel}>{o.label}</span>
                <span className={s.choiceDetail}>{o.detail}</span>
              </label>
            ))}
          </div>
          <p className={s.fieldHelp}>{canSwing(meter) ? "How much swing is set with the Swing slider on the console." : "Not used in a triplet meter: the swing is already in the grid."}</p>
        </fieldset>
      </section>

      <section className={s.section}>
        <h3 className={s.sectionTitle}>Start again</h3>
        <p className={s.prose}>Both keep your saved beats, and Undo brings this one back.</p>
        <div className={s.buttonRow}>
          <button type="button" className={s.paperButton} onClick={() => m.load(blankBeat())}>
            New empty beat
          </button>
          <button type="button" className={s.paperButton} onClick={() => m.load(starterBeat())}>
            The example song
          </button>
        </div>
      </section>
    </div>
  );
}
