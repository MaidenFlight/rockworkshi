"use client";

import { useRef, useState } from "react";
import { useVisual } from "@/components/metronome/visual";
import { MAX_BLOCKS, MAX_BLOCK_BARS, addBlock, barSeconds, moveBlock, partById, removeBlock, setBlockBars, setBlockCrash, setBlockPart, songBars } from "@/lib/drums/beat";
import s from "./beats.module.css";

function duration(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// The song: parts strung together in order, each played a number of bars. Choose a block to
// change it; the one playing carries a lamp and fills as it goes.
export default function SongStrip({ m }) {
  const { beat, selected } = m;
  const [openId, setOpenId] = useState(null);
  const open = beat.song.find((b) => b.id === openId) || null;
  const blocks = useRef({});
  const fills = useRef({});
  const bars = songBars(beat);
  const starts = [];
  beat.song.reduce((at, b, i) => {
    starts[i] = at;
    return at + b.bars;
  }, 0);

  useVisual((snap) => {
    beat.song.forEach((b, i) => {
      const el = blocks.current[b.id];
      const fill = fills.current[b.id];
      if (!el) return;
      const on = snap && !snap.countIn && snap.block === i;
      if (on) {
        el.setAttribute("data-now", "");
        const into = (snap.songBar - starts[i] + (snap.step + 1) / snap.steps) / b.bars;
        if (fill) fill.style.transform = `scaleX(${Math.min(1, Math.max(0, into))})`;
      } else {
        el.removeAttribute("data-now");
        if (fill) fill.style.transform = "scaleX(0)";
      }
    });
  });

  const add = () => {
    const isFill = /fill|break|ending|stop/i.test(selected.name);
    m.edit((b) => addBlock(b, selected.id, isFill ? 1 : 4));
  };

  return (
    <section className={s.song} aria-labelledby="bm-song-title">
      <div className={s.songHead}>
        <h2 id="bm-song-title" className={s.songTitle}>
          Song
        </h2>
        <span className={s.songMeta}>{bars.length ? `${bars.length} bars · ${duration(bars.length * barSeconds(beat))}` : "Empty"}</span>
        <div className={s.songKeys}>
          <button type="button" className={s.smallKey} onClick={add} disabled={beat.song.length >= MAX_BLOCKS}>
            + Add {selected.name}
          </button>
          {bars.length > 0 && (
            <button type="button" className={s.smallKey} onClick={() => m.play("song", 0)}>
              Play the song
            </button>
          )}
        </div>
      </div>

      {beat.song.length === 0 ? (
        <p className={s.songEmpty}>
          Put parts in order to make a song: choose a part above, then Add it. A verse for 4 bars, a fill for 1, a chorus for 4…
        </p>
      ) : (
        <ol className={s.blocks}>
          {beat.song.map((b, i) => {
            const part = partById(beat, b.part);
            return (
              <li key={b.id} className={s.blockItem} style={{ "--bars": b.bars }}>
                <button
                  type="button"
                  ref={(el) => {
                    blocks.current[b.id] = el;
                  }}
                  className={s.block}
                  aria-expanded={openId === b.id}
                  aria-controls="bm-block-editor"
                  onClick={() => setOpenId(openId === b.id ? null : b.id)}
                >
                  <span className={s.blockName}>{part?.name}</span>
                  <span className={s.blockBars}>
                    {b.bars} {b.bars === 1 ? "bar" : "bars"}
                    {b.crash ? " · crash" : ""}
                  </span>
                  <span className={s.srOnly}>, place {i + 1} of {beat.song.length}</span>
                  <span
                    className={s.blockFill}
                    ref={(el) => {
                      fills.current[b.id] = el;
                    }}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {open && (
        <div id="bm-block-editor" className={s.blockEditor} role="group" aria-label={`Place ${beat.song.indexOf(open) + 1} in the song`}>
          <label className={s.editorField}>
            <span className={s.editorLabel}>Part</span>
            <select className={s.darkSelect} value={open.part} onChange={(e) => m.edit((b) => setBlockPart(b, open.id, e.target.value))}>
              {beat.parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className={s.editorField}>
            <span className={s.editorLabel} id="bm-block-bars">
              Bars
            </span>
            <div className={s.stepper} role="group" aria-labelledby="bm-block-bars">
              <button type="button" className={s.nudge} aria-label="One bar fewer" disabled={open.bars <= 1} onClick={() => m.edit((b) => setBlockBars(b, open.id, open.bars - 1))}>
                −
              </button>
              <span className={s.stepperValue} aria-live="polite">
                {open.bars}
              </span>
              <button
                type="button"
                className={s.nudge}
                aria-label="One bar more"
                disabled={open.bars >= MAX_BLOCK_BARS}
                onClick={() => m.edit((b) => setBlockBars(b, open.id, open.bars + 1))}
              >
                +
              </button>
            </div>
          </div>
          <label className={s.darkCheck}>
            <input type="checkbox" checked={open.crash} onChange={(e) => m.edit((b) => setBlockCrash(b, open.id, e.target.checked))} />
            Start with a crash
          </label>
          <div className={s.editorKeys}>
            <button type="button" className={s.smallKey} onClick={() => m.play("song", beat.song.indexOf(open))}>
              Play from here
            </button>
            <button type="button" className={s.smallKey} disabled={beat.song[0]?.id === open.id} onClick={() => m.edit((b) => moveBlock(b, open.id, -1))}>
              Move earlier
            </button>
            <button type="button" className={s.smallKey} disabled={beat.song.at(-1)?.id === open.id} onClick={() => m.edit((b) => moveBlock(b, open.id, 1))}>
              Move later
            </button>
            <button
              type="button"
              className={s.smallKey}
              onClick={() => {
                m.edit((b) => removeBlock(b, open.id));
                setOpenId(null);
              }}
            >
              Take out
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
