"use client";

import { CLIP_KNEE } from "@/lib/audio/mix";
import { STATE_TEXT, StateMark, partColor } from "../player/Timeline";
import Meter from "../player/Meter";
import Fader from "./Fader";

// Volume, mute and solo per stem, plus master and the take, as a compact console. Changing any
// of these only moves gains on the running audio graph: playback never stops or restarts.
// Each strip's meter reads its stem after the fader, so it shows what you actually hear.
export default function MixerPanel({ parts, mix, levels, states, onChange, takeLabel, onReset, meters, getMaster, getTake, active }) {
  const setStem = (part, patch) => onChange({ ...mix, stems: { ...mix.stems, [part]: { ...mix.stems[part], ...patch } } });

  const anySolo = parts.some((p) => mix.stems[p]?.soloed);
  const bandSilent = parts.every((p) => !levels[p]?.audible);

  return (
    <div className="rw-mixer">
      <div className="rw-mixer-strips">
        {parts.map((part) => {
          const stem = mix.stems[part];
          const audible = Boolean(levels[part]?.audible);
          const state = states[part];
          return (
            <div key={part} className="rw-strip" data-part={part} data-state={state} style={{ "--lane": partColor(part) }}>
              <Fader
                label={<Name text={part} off={!audible} />}
                value={stem.volume}
                on={audible}
                onChange={(volume) => setStem(part, { volume })}
                meter={<Meter getNodes={meters[part]} active={active} length={132} thickness={6} title={`${part} level`} />}
                status={
                  <>
                    <StateMark state={state} />
                    {STATE_TEXT[state]}
                  </>
                }
              >
                <button
                  type="button"
                  className="rw-ms"
                  data-kind="mute"
                  onClick={() => setStem(part, { muted: !stem.muted })}
                  aria-pressed={stem.muted}
                  aria-label={`Mute ${part}`}
                  title={stem.muted ? `Unmute ${part}` : `Mute ${part}`}
                >
                  M
                </button>
                <button
                  type="button"
                  className="rw-ms"
                  data-kind="solo"
                  onClick={() => setStem(part, { soloed: !stem.soloed })}
                  aria-pressed={stem.soloed}
                  aria-label={`Solo ${part}`}
                  title={stem.soloed ? `Stop soloing ${part}` : `Solo ${part}: hear only soloed parts`}
                >
                  S
                </button>
              </Fader>
            </div>
          );
        })}

        {takeLabel && (
          <div className="rw-strip" data-part="take" data-state={mix.takeMuted ? "muted" : "playing"} style={{ "--lane": partColor("take") }}>
            <Fader
              label={<Name text={takeLabel} off={mix.takeMuted} />}
              value={mix.take}
              on={!mix.takeMuted}
              onChange={(take) => onChange({ ...mix, take })}
              meter={<Meter getNodes={getTake} active={active} length={132} thickness={6} title={`${takeLabel} level`} />}
              status={
                <>
                  <StateMark state={mix.takeMuted ? "muted" : "playing"} />
                  {mix.takeMuted ? "Muted" : "In mix"}
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

      {(bandSilent || anySolo) && (
        <p className="rw-studio-hint" role="status">
          {bandSilent ? "The band is silent: the play mode, mute and solo leave no part playing." : "Solo is on: only soloed parts play. Your take has its own mute."}
        </p>
      )}
    </div>
  );
}

// A part's name under its fader, saying when it won't be heard.
function Name({ text, off }) {
  return (
    <>
      {text}
      {off && <span className="rw-fader-off"> (off)</span>}
    </>
  );
}
