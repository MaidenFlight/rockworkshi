"use client";

import { useId, useState } from "react";
import Icon from "@/components/member/Icon";
import {
  SWING_MAX,
  SWING_STRAIGHT,
  SWING_TRIPLET,
  effective,
  polyChoices,
  setField,
  setGroups,
  setMeter,
  setPulse,
  setSubdivision,
  subdivisionChoices,
  swingState,
} from "@/lib/metronome/config";
import {
  METER_PRESETS,
  MAX_BEATS,
  NOTES,
  cellsOf,
  countingText,
  defaultAccents,
  defaultGroups,
  describeMeter,
  groupingChoices,
  groupsLabel,
  isCompound,
  parseGroups,
  pulseNote,
  validGroups,
} from "@/lib/metronome/rhythm";
import { VOICES } from "@/lib/metronome/sounds";
import CycleView from "./CycleView";
import { Choices, NumberField, PercentSlider } from "./Fields";
import NoteValue, { PULSE_SYMBOL } from "./NoteValue";
import s from "./metronome.module.css";

// What a time signature's tile says under its numbers, for the meter as it first opens.
function tileCaption(beats, unit) {
  const shape = { beats, unit, groups: defaultGroups(beats, unit), pulse: "count" };
  if (isCompound(shape)) return `${shape.groups.length} beats of 3`;
  if (unit === 8) return `${beats} eighths`;
  return `${beats} beats`;
}

export default function SettingsMetronome({ m }) {
  const { config, change } = m;
  return (
    <div className={s.sections}>
      <MeterSection config={config} change={change} />
      <SubdivisionSection config={config} change={change} />
      <AccentSection config={config} change={change} />
      <SoundSection m={m} />
      <PracticeSection config={config} change={change} />
      <AdvancedSection config={config} change={change} />
    </div>
  );
}

function MeterSection({ config, change }) {
  const meter = config.meter;
  const isPreset = METER_PRESETS.some((p) => p.beats === meter.beats && p.unit === meter.unit);
  const [customOpen, setCustomOpen] = useState(false);
  const custom = customOpen || !isPreset;
  const value = custom ? "custom" : `${meter.beats}/${meter.unit}`;
  const options = [
    ...METER_PRESETS.map((p) => ({
      value: `${p.beats}/${p.unit}`,
      label: (
        <span className={s.sig} aria-hidden="true">
          <span>{p.beats}</span>
          <span>{p.unit}</span>
        </span>
      ),
      detail: (
        <>
          <span className={s.srOnly}>{`${p.beats}/${p.unit}: `}</span>
          {tileCaption(p.beats, p.unit)}
        </>
      ),
    })),
    { value: "custom", label: <span className={s.sigWord}>Other</span>, detail: "Any meter" },
  ];
  const note = pulseNote(meter);

  return (
    <section className={s.section} aria-labelledby="mt-meter">
      <h3 className={s.sectionTitle} id="mt-meter">
        Meter
      </h3>
      <Choices
        legend="Time signature"
        value={value}
        options={options}
        columns="meters"
        onChange={(v) => {
          if (v === "custom") {
            setCustomOpen(true);
            return;
          }
          setCustomOpen(false);
          const [beats, unit] = v.split("/").map(Number);
          change((c) => setMeter(c, beats, unit));
        }}
        help={describeMeter(meter)}
      />

      {custom && (
        <div className={s.inlineFields}>
          <NumberField
            label="Beats in a bar"
            value={meter.beats}
            min={1}
            max={MAX_BEATS}
            onCommit={(beats) => change((c) => setMeter(c, beats, c.meter.unit))}
          />
          <Choices
            legend="Note value"
            value={meter.unit}
            options={[
              { value: 4, label: "Quarter notes", detail: `${meter.beats}/4` },
              { value: 8, label: "Eighth notes", detail: `${meter.beats}/8` },
            ]}
            onChange={(unit) => change((c) => setMeter(c, c.meter.beats, unit))}
          />
        </div>
      )}

      {isCompound(meter) && (
        <Choices
          legend="What the tempo counts"
          value={meter.pulse}
          size="wide"
          options={[
            {
              value: "group",
              label: (
                <span className={s.choiceWithNote}>
                  <NoteValue {...PULSE_SYMBOL["dotted-quarter"]} height={26} />
                  Dotted quarters
                </span>
              ),
              detail: `${meter.groups.length} beats a bar, each holding three eighths. The usual way to feel ${meter.beats}/8.`,
            },
            {
              value: "count",
              label: (
                <span className={s.choiceWithNote}>
                  <NoteValue {...PULSE_SYMBOL.eighth} height={26} />
                  Eighth notes
                </span>
              ),
              detail: `${meter.beats} beats a bar. Good for slow ${meter.beats}/8, or learning where each eighth falls.`,
            },
          ]}
          onChange={(pulse) => change((c) => setPulse(c, pulse))}
          help="Switching keeps the music at the same speed; the tempo number changes to match."
        />
      )}

      <Grouping config={config} change={change} />

      <p className={s.unitNote}>
        <NoteValue {...PULSE_SYMBOL[note]} height={22} />
        <span>
          The tempo counts <strong>{NOTES[note].plural}</strong>: {config.tempo} of them a minute.
        </span>
      </p>
    </section>
  );
}

function Grouping({ config, change }) {
  const meter = config.meter;
  const choices = groupingChoices(meter.beats, meter.unit);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  if (!choices.length && meter.groups.length === 1) return null;
  const current = groupsLabel(meter.groups);
  const listed = choices.some((g) => groupsLabel(g) === current);

  function apply() {
    const groups = parseGroups(text);
    if (!groups || !validGroups(groups, meter.beats)) {
      setError(`Use numbers that add up to ${meter.beats}, like ${groupsLabel(defaultGroups(meter.beats, meter.unit))}.`);
      return;
    }
    setError("");
    setText("");
    change((c) => setGroups(c, groups));
  }

  return (
    <div className={s.grouping}>
      {choices.length > 0 && (
        <Choices
          legend="Grouping"
          value={listed ? current : null}
          options={choices.map((g) => ({
            value: groupsLabel(g),
            label: g.length === 1 ? "None" : groupsLabel(g),
            detail: g.length === 1 ? "Only beat 1 strong" : `Strong on ${strongBeats(meter, g)}`,
          }))}
          onChange={(v) => change((c) => setGroups(c, parseGroups(v)))}
          help={`How the ${meter.unit === 8 ? "eighths" : "beats"} are felt: each group starts with a strong beat.${listed ? "" : ` Now: ${current}.`}`}
        />
      )}
      <div className={s.groupCustom}>
        <label className={s.numberLabel} htmlFor={id}>
          Your own grouping
        </label>
        <span className={s.numberRow}>
          <input
            id={id}
            className={s.textInput}
            value={text}
            placeholder={groupsLabel(defaultGroups(meter.beats, meter.unit))}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <button type="button" className={s.paperButton} onClick={apply}>
            Use it
          </button>
        </span>
        {error && (
          <span className={s.fieldError} id={`${id}-error`} role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

function strongBeats(meter, groups) {
  const shape = { ...meter, groups, pulse: "count" };
  const strong = defaultAccents(shape)
    .map((a, i) => (a === "strong" ? i + 1 : null))
    .filter(Boolean);
  return strong.length > 1 ? `${strong.slice(0, -1).join(", ")} and ${strong.at(-1)}` : `${strong[0]}`;
}

function SubdivisionSection({ config, change }) {
  const eff = effective(config);
  const choices = subdivisionChoices(config);
  const reasons = [...new Set(choices.filter((o) => o.disabled).map((o) => o.reason))];
  return (
    <section className={s.section} aria-labelledby="mt-sub">
      <h3 className={s.sectionTitle} id="mt-sub">
        Subdivision
      </h3>
      <Choices
        legend="Clicks in each beat"
        value={eff.subdivision}
        columns="four"
        options={choices.map((o) => {
          const sample = countingText(config.meter, o.n);
          return {
            value: o.n,
            disabled: o.disabled,
            title: o.reason || undefined,
            label: (
              <span className={s.subLabel}>
                <NoteValue {...o.notes} height={30} />
                <span>{o.name}</span>
              </span>
            ),
            detail: (
              <>
                {o.per}
                {sample && <span className={s.subSample}>{sample[0].join(" ")}</span>}
              </>
            ),
          };
        })}
        onChange={(n) => change((c) => setSubdivision(c, n))}
        help={reasons.length ? reasons.join(" ") : null}
      />
      <PercentSlider
        label="Subdivision volume"
        value={config.sound.subVolume}
        disabled={eff.subdivision === 1}
        onChange={(v) => change((c) => setField(c, "sound.subVolume", v))}
        help={eff.subdivision === 1 ? "Choose a subdivision to hear it." : "The in-between clicks, under the beat."}
      />
    </section>
  );
}

function AccentSection({ config, change }) {
  const defaults = defaultAccents(config.meter);
  const isDefault = defaults.join() === config.accents.join();
  const cells = cellsOf(config.meter).length;
  return (
    <section className={s.section} aria-labelledby="mt-acc">
      <h3 className={s.sectionTitle} id="mt-acc">
        Accents
      </h3>
      <p className={s.prose}>
        Press a beat in the metronome to change it. <strong>Strong</strong> clicks higher and louder, <strong>Normal</strong> is the
        plain click, and <strong>Silent</strong> makes no sound but keeps its place, so the timing never shifts.
      </p>
      <div className={s.buttonRow}>
        <button type="button" className={s.paperButton} disabled={isDefault} onClick={() => change((c) => ({ config: { ...c, accents: defaultAccents(c.meter) }, notice: null }))}>
          Reset to {config.meter.beats}/{config.meter.unit}&rsquo;s accents
        </button>
        {cells === 4 && (
          <button
            type="button"
            className={s.paperButton}
            onClick={() => change((c) => ({ config: { ...c, accents: ["normal", "strong", "normal", "strong"] }, notice: null }))}
          >
            Backbeat on 2 and 4
          </button>
        )}
        <button
          type="button"
          className={s.paperButton}
          onClick={() => change((c) => ({ config: { ...c, accents: c.accents.map(() => "normal") }, notice: null }))}
        >
          All normal
        </button>
      </div>
    </section>
  );
}

function SoundSection({ m }) {
  const { config, change, prefs, setPrefs, engine } = m;
  const [heard, setHeard] = useState(null);
  return (
    <section className={s.section} aria-labelledby="mt-sound">
      <h3 className={s.sectionTitle} id="mt-sound">
        Sound
      </h3>
      <fieldset className={s.field}>
        <legend className={s.fieldLegend}>Click sound</legend>
        <div className={s.voices}>
          {VOICES.map((v) => (
            <div key={v.id} className={s.voice} data-checked={config.sound.voice === v.id ? "true" : undefined}>
              <label className={s.voiceLabel}>
                <input
                  type="radio"
                  className={s.choiceInput}
                  name="mt-voice"
                  checked={config.sound.voice === v.id}
                  onChange={() => change((c) => setField(c, "sound.voice", v.id))}
                />
                <span className={s.choiceLabel}>{v.name}</span>
              </label>
              <button
                type="button"
                className={s.hear}
                onClick={async () => {
                  const ok = await engine?.preview(v.id);
                  setHeard(ok ? null : "The browser didn't let the sound play. Check this tab isn't muted.");
                }}
                aria-label={`Hear the ${v.name.toLowerCase()}`}
              >
                <Icon name="sound-on" size={16} />
                Hear it
              </button>
            </div>
          ))}
        </div>
        {heard && (
          <p className={s.fieldError} role="alert">
            {heard}
          </p>
        )}
        <div className={s.fieldHelp}>Strong beats click higher than normal ones, and subdivisions sit lower and quieter.</div>
      </fieldset>
      <PercentSlider label="Volume" value={prefs.volume} disabled={prefs.visualOnly} onChange={(volume) => setPrefs({ volume })} />
      <label className={s.check}>
        <input type="checkbox" checked={prefs.visualOnly} onChange={(e) => setPrefs({ visualOnly: e.target.checked })} />
        <span>
          <strong>Visual only.</strong>{" "}
          No sound, just the beat lights. Works even where the browser can&rsquo;t play audio.
        </span>
      </label>
      <p className={s.fieldHelp}>No sound on an iPhone? The ring/silent switch mutes web pages too.</p>
    </section>
  );
}

function PracticeSection({ config, change }) {
  const p = config.practice;
  const preset = [0, 5, 10, 15, 20, 30];
  const [otherOpen, setOtherOpen] = useState(false);
  const other = otherOpen || !preset.includes(p.timerMinutes);
  return (
    <section className={s.section} aria-labelledby="mt-practice">
      <h3 className={s.sectionTitle} id="mt-practice">
        Practice
      </h3>
      <Choices
        legend="Count-in"
        value={p.countIn}
        options={[
          { value: 0, label: "Off" },
          { value: 1, label: "1 bar" },
          { value: 2, label: "2 bars" },
        ]}
        onChange={(n) => change((c) => setField(c, "practice.countIn", n))}
        help="A bar or two of clicks before the practice starts, so you come in together. It doesn't count toward bars or time."
      />
      <Choices
        legend="Practice timer"
        value={other ? "other" : p.timerMinutes}
        options={[
          ...preset.map((n) => ({ value: n, label: n ? `${n} min` : "Off" })),
          { value: "other", label: "Other" },
        ]}
        onChange={(n) => {
          if (n === "other") {
            setOtherOpen(true);
            return;
          }
          setOtherOpen(false);
          change((c) => setField(c, "practice.timerMinutes", n));
        }}
      />
      {other && (
        <NumberField
          label="Minutes"
          value={p.timerMinutes}
          min={0}
          max={120}
          suffix="min"
          onCommit={(n) => change((c) => setField(c, "practice.timerMinutes", n))}
          help="Up to 120. 0 turns the timer off."
        />
      )}
      {p.timerMinutes > 0 && (
        <Choices
          legend="When the time is up"
          value={p.timerEnd}
          size="wide"
          options={[
            { value: "stop", label: "Finish the bar, then stop", detail: "It never cuts off mid-bar." },
            { value: "continue", label: "Keep playing", detail: "The metronome shows Time's up and carries on." },
          ]}
          onChange={(v) => change((c) => setField(c, "practice.timerEnd", v))}
          help="The timer counts practice time only: not the count-in, and not while stopped."
        />
      )}
    </section>
  );
}

function AdvancedSection({ config, change }) {
  const [open, setOpen] = useState(null);
  const inUse = config.advanced.swing > SWING_STRAIGHT || config.advanced.poly.on;
  const isOpen = open ?? inUse;
  return (
    <details className={s.advanced} open={isOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={s.advancedSummary}>
        <span className={s.advancedTitle}>Advanced rhythm</span>
        <span className={s.advancedSub}>Swing and polyrhythms{inUse ? " · in use" : ""}</span>
        <span className={s.advancedChevron} aria-hidden="true">
          <Icon name="chevron-down" size={18} />
        </span>
      </summary>
      <div className={s.advancedBody}>
        <SwingField config={config} change={change} />
        <PolyField config={config} change={change} />
      </div>
    </details>
  );
}

function SwingField({ config, change }) {
  const state = swingState(config);
  const id = useId();
  const swing = config.advanced.swing;
  const named = swing === SWING_STRAIGHT ? " (straight)" : swing === SWING_TRIPLET ? " (triplet swing)" : swing === SWING_MAX ? " (hard swing)" : "";
  const set = (v) => change((c) => setField(c, "advanced.swing", v));
  return (
    <fieldset className={s.field} disabled={!state.available}>
      <legend className={s.fieldLegend}>Swing</legend>
      <p className={s.prose}>
        Swing pushes the second note of each pair later. At 50% the pair is even (straight); at 67% the second note lands on the
        last third of the beat, like a triplet.
      </p>
      <div className={s.swingRow}>
        <label className={s.srOnly} htmlFor={id}>
          Swing amount
        </label>
        <input
          id={id}
          type="range"
          className={s.paperSlider}
          min={SWING_STRAIGHT}
          max={SWING_MAX}
          step={1}
          value={swing}
          onChange={(e) => set(Number(e.target.value))}
          aria-valuetext={`${swing}%${named}`}
        />
        <output className={s.sliderValue} htmlFor={id}>
          {swing}%
        </output>
      </div>
      <div className={s.buttonRow}>
        <button type="button" className={s.paperButton} aria-pressed={swing === SWING_STRAIGHT} onClick={() => set(SWING_STRAIGHT)}>
          Straight · 50%
        </button>
        <button type="button" className={s.paperButton} aria-pressed={swing === SWING_TRIPLET} onClick={() => set(SWING_TRIPLET)}>
          Triplet swing · 67%
        </button>
        <button type="button" className={s.paperButton} aria-pressed={swing === SWING_MAX} onClick={() => set(SWING_MAX)}>
          Hard · 75%
        </button>
      </div>
      {!state.available && <p className={s.disabledReason}>{state.reason}</p>}
    </fieldset>
  );
}

function PolyField({ config, change }) {
  const poly = config.advanced.poly;
  const beats = cellsOf(config.meter).length;
  const choices = polyChoices(config);
  const reasons = [...new Set(choices.filter((o) => o.disabled).map((o) => o.reason))];
  const note = NOTES[pulseNote(config.meter)];
  const valid = poly.notes !== beats;
  return (
    <fieldset className={s.field}>
      <legend className={s.fieldLegend}>Polyrhythm</legend>
      <p className={s.prose}>
        A second click that fits a different number of even notes into each bar. Both layers start together on beat 1 and finish
        together at the bar line.
      </p>
      <label className={s.check}>
        <input type="checkbox" checked={poly.on} onChange={(e) => change((c) => setField(c, "advanced.poly.on", e.target.checked))} />
        <span>
          <strong>Play a second layer</strong>
        </span>
      </label>
      {poly.on && (
        <>
          <Choices
            legend="Notes in the second layer, per bar"
            value={poly.notes}
            columns="eight"
            options={choices.map((o) => ({ value: o.notes, label: String(o.notes), disabled: o.disabled, title: o.reason || undefined }))}
            onChange={(notes) => change((c) => setField(c, "advanced.poly.notes", notes))}
            help={reasons.length ? reasons.join(" ") : null}
          />
          {valid ? (
            <p className={s.polyRatio}>
              <strong>
                {poly.notes}:{beats}
              </strong>{" "}
              {poly.notes} against {beats}. The tempo sets your {beats} beats ({note.plural}, {config.tempo} a minute); the{" "}
              {poly.notes} notes are spread evenly across the same bar.
            </p>
          ) : (
            <p className={s.disabledReason}>Pick a number other than {beats}: with the same count, both layers would play the same beats.</p>
          )}
          {valid && <CycleView beats={beats} notes={poly.notes} />}
          <Choices
            legend="Second layer sound"
            value={poly.voice}
            options={VOICES.map((v) => ({ value: v.id, label: v.name }))}
            onChange={(voice) => change((c) => setField(c, "advanced.poly.voice", voice))}
          />
          <PercentSlider label="Second layer volume" value={poly.volume} onChange={(v) => change((c) => setField(c, "advanced.poly.volume", v))} />
          <p className={s.fieldHelp}>While the second layer plays, subdivisions and swing rest, so the two layers stay clear.</p>
        </>
      )}
      {!poly.on && (
        <p className={s.fieldHelp}>
          For 3 against 2, choose 2/4 above and 3 notes here; for 4 against 3, choose 3/4 and 4 notes.
        </p>
      )}
    </fieldset>
  );
}
