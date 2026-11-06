"use client";

import { useEffect, useId, useState } from "react";
import Icon from "@/components/member/Icon";
import { describeConfig } from "@/lib/metronome/config";
import { MAX_PRESETS, NAME_MAX, STARTER_EXERCISES } from "@/lib/metronome/presets";
import { shareUrl } from "@/lib/metronome/share";
import s from "./metronome.module.css";

export default function SettingsPresets({ m, nameRef }) {
  const { saved, store, config, load, engineState, scope } = m;
  const running = engineState.status === "running" || engineState.status === "starting";
  const [name, setName] = useState("");
  const [message, setMessage] = useState(null);
  const [renaming, setRenaming] = useState(null); // { id, text }
  const [removed, setRemoved] = useState(null); // { preset, index }
  const [link, setLink] = useState(null); // { url, copied, label }
  const nameId = useId();
  const presets = saved?.presets ?? [];
  const suggested = describeConfig(config).split(" · ").slice(0, 2).join(" · ");

  useEffect(() => {
    if (!removed) return;
    const id = setTimeout(() => setRemoved(null), 10000);
    return () => clearTimeout(id);
  }, [removed]);

  function open(label, next) {
    load(next);
    setMessage(running ? `Loaded “${label}”. It starts at the next bar.` : `Loaded “${label}”. Press Start when you're ready.`);
  }

  function save(e) {
    e.preventDefault();
    const preset = store?.save(name.trim() || suggested, config);
    if (!preset) {
      setMessage(presets.length >= MAX_PRESETS ? `You can keep up to ${MAX_PRESETS} presets. Delete one to save another.` : "Give the preset a name first.");
      return;
    }
    setName("");
    setMessage(`Saved “${preset.name}”.`);
  }

  async function share(label, cfg) {
    const url = shareUrl(cfg, window.location.origin);
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // Clipboard refused (permissions, or an older browser): the link is shown to copy by hand.
    }
    setLink({ url, copied, label });
  }

  const storageNote = !saved
    ? "Opening your presets…"
    : !saved.persistent
      ? null
      : scope === "guest"
        ? "Saved in this browser only. They aren't part of an account, so they won't follow you to another device."
        : "Saved in this browser, for the account you're signed in with. They aren't synced to your Rock Works account yet, so they stay on this device.";

  return (
    <div className={s.sections}>
      <p className={s.liveMessage} role="status">
        {message}
      </p>

      <section className={s.section} aria-labelledby="mt-starters">
        <h3 className={s.sectionTitle} id="mt-starters">
          Starter exercises
        </h3>
        <p className={s.prose}>
          Starting points to practise with, not a test of your level. Load one, change anything you like, and save your version
          below.
        </p>
        <ul className={s.presetList}>
          {STARTER_EXERCISES.map((ex) => (
            <li key={ex.id} className={s.presetItem} data-layout="row">
              <div className={s.presetText}>
                <span className={s.presetName}>{ex.name}</span>
                <span className={s.presetDesc}>{ex.description}</span>
                <span className={s.presetMeta}>{describeConfig(ex.config)}</span>
              </div>
              <div className={s.presetActions}>
                <button type="button" className={s.paperButton} onClick={() => open(ex.name, ex.config)} aria-label={`Load ${ex.name}`}>
                  Load
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={s.section} aria-labelledby="mt-mine">
        <h3 className={s.sectionTitle} id="mt-mine">
          Your presets
        </h3>
        {storageNote && <p className={s.storageNote}>{storageNote}</p>}
        {saved?.notice && (
          <p className={s.softNotice} role="status">
            {saved.notice}{" "}
            <button type="button" className={s.inlineLink} onClick={() => store.dismissNotice()}>
              OK
            </button>
          </p>
        )}
        <form className={s.saveForm} onSubmit={save}>
          <label className={s.numberLabel} htmlFor={nameId}>
            Name this setup
          </label>
          <span className={s.numberRow}>
            <input
              id={nameId}
              ref={nameRef}
              className={s.textInput}
              value={name}
              maxLength={NAME_MAX}
              placeholder={suggested}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className={s.paperButtonStrong} disabled={!store}>
              Save
            </button>
          </span>
        </form>
        {removed && (
          <p className={s.softNotice} role="status">
            Deleted “{removed.preset.name}”.{" "}
            <button
              type="button"
              className={s.inlineLink}
              onClick={() => {
                store.restore(removed.preset, removed.index);
                setRemoved(null);
              }}
            >
              Undo
            </button>
          </p>
        )}
        {presets.length === 0 ? (
          <p className={s.empty}>Nothing saved yet. Set the metronome up the way you like it, give it a name and press Save.</p>
        ) : (
          <ul className={s.presetList}>
            {presets.map((p, index) => (
              <li key={p.id} className={s.presetItem}>
                {renaming?.id === p.id ? (
                  <form
                    className={s.renameForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (store.rename(p.id, renaming.text)) setRenaming(null);
                    }}
                  >
                    <label className={s.srOnly} htmlFor={`${nameId}-${p.id}`}>
                      New name for {p.name}
                    </label>
                    <input
                      id={`${nameId}-${p.id}`}
                      className={s.textInput}
                      value={renaming.text}
                      maxLength={NAME_MAX}
                      autoFocus
                      onChange={(e) => setRenaming({ id: p.id, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenaming(null);
                      }}
                    />
                    <button type="submit" className={s.paperButtonStrong}>
                      Rename
                    </button>
                    <button type="button" className={s.paperButton} onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className={s.presetText}>
                      <span className={s.presetName}>{p.name}</span>
                      <span className={s.presetMeta}>{describeConfig(p.config)}</span>
                    </div>
                    <div className={s.presetActions}>
                      <button type="button" className={s.paperButtonStrong} onClick={() => open(p.name, p.config)} aria-label={`Load ${p.name}`}>
                        Load
                      </button>
                      <button
                        type="button"
                        className={s.paperButton}
                        onClick={() => {
                          store.overwrite(p.id, config);
                          setMessage(`Updated “${p.name}” with the current settings.`);
                        }}
                        aria-label={`Update ${p.name} with the current settings`}
                      >
                        Update
                      </button>
                      <button type="button" className={s.paperButton} onClick={() => setRenaming({ id: p.id, text: p.name })} aria-label={`Rename ${p.name}`}>
                        Rename
                      </button>
                      <button
                        type="button"
                        className={s.paperButton}
                        onClick={() => {
                          const copy = store.duplicate(p.id);
                          setMessage(copy ? `Made a copy: “${copy.name}”.` : `You can keep up to ${MAX_PRESETS} presets.`);
                        }}
                        aria-label={`Duplicate ${p.name}`}
                      >
                        Duplicate
                      </button>
                      <button type="button" className={s.paperButton} onClick={() => share(p.name, p.config)} aria-label={`Share ${p.name}`}>
                        Share
                      </button>
                      <button
                        type="button"
                        className={s.paperButtonDanger}
                        onClick={() => {
                          store.remove(p.id);
                          setRemoved({ preset: p, index });
                        }}
                        aria-label={`Delete ${p.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={s.section} aria-labelledby="mt-share">
        <h3 className={s.sectionTitle} id="mt-share">
          Share a setup
        </h3>
        <p className={s.prose}>
          A link a teacher can send. It holds only the metronome settings: no names, nothing about your account, and not your
          presets. Opening it fills in the controls; it never starts playing by itself and never changes anyone&rsquo;s saved
          presets.
        </p>
        <button type="button" className={s.paperButtonStrong} onClick={() => share("the current setup", config)}>
          <Icon name="link" size={16} />
          Copy a link to the current setup
        </button>
        {link && (
          <div className={s.linkBox}>
            <label className={s.numberLabel} htmlFor={`${nameId}-link`}>
              Link to {link.label}
            </label>
            <input id={`${nameId}-link`} className={s.textInput} readOnly value={link.url} onFocus={(e) => e.target.select()} />
            <span className={s.numberHelp} role="status">
              {link.copied ? "Copied. Paste it into a message." : "Copy the link above to send it."}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
