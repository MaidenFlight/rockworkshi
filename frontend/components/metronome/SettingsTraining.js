"use client";

import { setField } from "@/lib/metronome/config";
import { NOTES, barSeconds, pulseNote } from "@/lib/metronome/rhythm";
import { builderSeconds, builderStages } from "@/lib/metronome/training";
import { clock } from "./Console";
import { Choices, NumberField } from "./Fields";
import s from "./metronome.module.css";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function SettingsTraining({ m }) {
  const { config, change } = m;
  const t = config.training;
  const running = m.engineState.status === "running";
  return (
    <div className={s.sections}>
      <section className={s.section} aria-labelledby="mt-train">
        <h3 className={s.sectionTitle} id="mt-train">
          Training
        </h3>
        <Choices
          legend="Training mode"
          hideLegend
          value={t.mode}
          size="wide"
          options={[
            { value: "off", label: "Off", detail: "Just the metronome, at the tempo you set." },
            { value: "builder", label: "Tempo builder", detail: "Changes the tempo in steps, every few bars, up or down." },
            { value: "silent", label: "Silent bars", detail: "Takes the click away for a few bars while you keep time." },
          ]}
          onChange={(mode) => change((c) => setField(c, "training.mode", mode))}
          help={
            running
              ? "One training mode runs at a time. A change here starts at the next bar, from its beginning."
              : "One training mode runs at a time. It starts when you press Start, after any count-in."
          }
        />
      </section>
      {t.mode === "builder" && <BuilderFields config={config} change={change} />}
      {t.mode === "silent" && <SilentFields config={config} change={change} />}
      {t.mode === "off" && (
        <p className={s.prose}>
          For a ready-made routine, try one of the starter exercises under Presets: gradual speed building, or two bars on and two
          bars silent.
        </p>
      )}
    </div>
  );
}

function BuilderFields({ config, change }) {
  const b = config.training.builder;
  const stages = builderStages(b);
  const seconds = builderSeconds(b, config.meter);
  const set = (key) => (value) => change((c) => setField(c, `training.builder.${key}`, value));
  const direction = b.target > b.start ? "up" : b.target < b.start ? "down" : "steady";
  const note = NOTES[pulseNote(config.meter)].plural;
  const shown = stages.length > 8 ? [...stages.slice(0, 3), "…", ...stages.slice(-2)] : stages;
  return (
    <section className={s.section} aria-labelledby="mt-builder">
      <h3 className={s.sectionTitle} id="mt-builder">
        Tempo builder
      </h3>
      <div className={s.fieldGrid}>
        <NumberField label="Start at" value={b.start} min={20} max={300} suffix="BPM" onCommit={set("start")} />
        <NumberField label="Finish at" value={b.target} min={20} max={300} suffix="BPM" onCommit={set("target")} />
        <NumberField label={direction === "down" ? "Slow down by" : "Speed up by"} value={b.step} min={1} max={50} suffix="BPM" onCommit={set("step")} />
        <NumberField label="Every" value={b.bars} min={1} max={64} suffix={b.bars === 1 ? "bar" : "bars"} onCommit={set("bars")} />
      </div>
      <Choices
        legend="At the target"
        value={b.atTarget}
        size="wide"
        options={[
          { value: "hold", label: "Keep playing at the target", detail: "It stays at the target until you press Stop." },
          { value: "stop", label: `Play ${plural(b.bars, "bar")} at the target, then stop`, detail: "The last stage is a full one, then it ends." },
        ]}
        onChange={set("atTarget")}
      />
      <p className={s.summary}>
        {direction === "steady" ? (
          <>Start and finish are the same, so this plays one stage at {b.start}.</>
        ) : (
          <>
            {plural(stages.length, "stage")}: {shown.join(", ")}. The tempo counts {note}, and every change lands on a bar line.{" "}
            {b.atTarget === "stop"
              ? `About ${clock(seconds)} from start to finish.`
              : `It reaches ${b.target} after about ${clock(seconds - b.bars * barSeconds(config.meter, b.target))}, then holds it.`}
          </>
        )}
      </p>
    </section>
  );
}

function SilentFields({ config, change }) {
  const sl = config.training.silent;
  const set = (key) => (value) => change((c) => setField(c, `training.silent.${key}`, value));
  return (
    <section className={s.section} aria-labelledby="mt-silent">
      <h3 className={s.sectionTitle} id="mt-silent">
        Silent bars
      </h3>
      <div className={s.fieldGrid}>
        <NumberField label="Bars with the click" value={sl.play} min={1} max={16} suffix={sl.play === 1 ? "bar" : "bars"} onCommit={set("play")} />
        <NumberField label="Silent bars" value={sl.rest} min={1} max={16} suffix={sl.rest === 1 ? "bar" : "bars"} onCommit={set("rest")} />
      </div>
      <label className={s.check}>
        <input type="checkbox" checked={sl.showCues} onChange={(e) => set("showCues")(e.target.checked)} />
        <span>
          <strong>Keep the beat lights on during silent bars.</strong>{" "}
          Turning them off makes it harder: you keep time on your own,
          with nothing to watch, and find out on beat 1 whether you stayed with it.
        </span>
      </label>
      <p className={s.summary}>
        The clock never stops during the silence, so the click comes back exactly where the beat should be. The cycle starts on the
        first bar after any count-in.
      </p>
    </section>
  );
}
