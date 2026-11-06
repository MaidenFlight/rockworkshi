"use client";

import { useId } from "react";
import { CLIP_KNEE } from "@/lib/audio/mix";
import { StateMark, partColor } from "../player/Timeline";
import Meter from "../player/Meter";
import Fader from "./Fader";

// A student's mixer: their own part against the backing band (every other part, mixed into one
// track on the server), then their take and the master. No strip per instrument and no mute or solo:
// the three play modes choose what's heard. A fader its mode silences is switched off, with the reason
// under the strips. Volumes stay as set while switching modes, so the balance comes back as it was.
export default function PartBalance({ instrument, ownPart, mix, mode, levels, onChange, takeLabel, onReset, meters, getMaster, getTake, active }) {
  const hintId = useId();
  const noun = instrument.toLowerCase();
  const setVolume = (part, volume) => onChange({ ...mix, stems: { ...mix.stems, [part]: { ...mix.stems[part], volume } } });

  const strips = [];
  if (ownPart) strips.push({ part: ownPart, label: `Your ${noun}`, silenced: mode === "minus" });
  if (mix.stems.Backing) strips.push({ part: "Backing", label: "Backing band", silenced: mode === "solo" });

  const hint = !ownPart
    ? `This recording has no separate ${noun} track, so the backing band is the whole song.`
    : mode === "minus"
      ? `“Without ${noun}” is on, so your ${noun} is silent and its fader is off. Choose Whole song to hear it again.`
      : mode === "solo"
        ? `“${instrument} only” is on, so the backing band is silent and its fader is off. Choose Whole song to bring it back.`
        : mix.stems.Backing
          ? `Balance your ${noun} against the band. The balance stays when you switch modes.`
          : null;

  return (
    <div className="rw-mixer" data-balance="true">
      <div className="rw-mixer-strips">
        {strips.map(({ part, label, silenced }) => {
          const heard = Boolean(levels[part]?.audible);
          return (
            <div key={part} className="rw-strip" data-part={part} data-state={heard ? "playing" : "off"} style={{ "--lane": partColor(part) }}>
              <Fader
                label={label}
                value={mix.stems[part].volume}
                on={heard}
                disabled={silenced}
                describedBy={silenced ? hintId : undefined}
                onChange={(volume) => setVolume(part, volume)}
                meter={<Meter getNodes={meters[part]} active={active} length={132} thickness={6} title={`${label} level`} />}
                status={
                  <>
                    <StateMark state={heard ? "playing" : "off"} />
                    {heard ? "Playing" : "Silent"}
                  </>
                }
              />
            </div>
          );
        })}

        {takeLabel && (
          <div className="rw-strip" data-part="take" data-state={mix.takeMuted ? "muted" : "playing"} style={{ "--lane": partColor("take") }}>
            <Fader
              label={takeLabel}
              value={mix.take}
              on={!mix.takeMuted}
              onChange={(take) => onChange({ ...mix, take })}
              meter={<Meter getNodes={getTake} active={active} length={132} thickness={6} title={`${takeLabel} level`} />}
              status={
                <>
                  <StateMark state={mix.takeMuted ? "muted" : "playing"} />
                  {mix.takeMuted ? "Muted" : "Playing"}
                </>
              }
            >
              <button
                type="button"
                className="rw-ms"
                data-kind="mute"
                onClick={() => onChange({ ...mix, takeMuted: !mix.takeMuted })}
                aria-pressed={mix.takeMuted}
                aria-label={`Mute ${takeLabel}`}
                title={`Mute ${takeLabel}`}
              >
                M
              </button>
            </Fader>
          </div>
        )}

        <div className="rw-strip rw-strip-master" data-part="master">
          <Fader
            label="Master"
            value={mix.master}
            master
            onChange={(master) => onChange({ ...mix, master })}
            meter={<Meter getNodes={getMaster} active={active} length={132} thickness={6} clipAt={CLIP_KNEE} clipLabel="Clip" title="Master level, left and right. Clip lights when loud peaks are being softened." />}
          >
            <button type="button" className="rw-btn rw-btn-small" onClick={onReset}>
              Reset mix
            </button>
          </Fader>
        </div>
      </div>

      {hint && (
        <p id={hintId} className="rw-studio-hint" role="status">
          {hint}
        </p>
      )}
    </div>
  );
}
