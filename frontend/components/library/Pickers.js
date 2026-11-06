import Link from "next/link";
import s from "./library.module.css";

// The twelve roots, with both names where a black key has two.
export function RootPicker({ roots, value, onChange, label = "Root" }) {
  return (
    <div role="group" aria-label={label} className={s.roots}>
      {roots.map((r) => {
        const [main, other] = r.label.split("/");
        return (
          <button key={r.pc} type="button" className={s.btn} aria-pressed={r.pc === value} onClick={() => onChange(r.pc)}>
            <span>
              {main}
              {other && <span className={s.rootSub}>{other}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// A row of options where one is chosen.
export function Seg({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className={s.seg}>
      {options.map((o) => (
        <button key={o.id} type="button" className={s.btn} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Speaker({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="square">
      <path d="M4 9.5H8L13 5.5V18.5L8 14.5H4Z" fill="currentColor" stroke="none" />
      <path d="M16.5 9C17.4 9.9 17.9 10.9 17.9 12C17.9 13.1 17.4 14.1 16.5 15" />
      <path d="M19.2 6.5C20.6 8 21.4 9.9 21.4 12C21.4 14.1 20.6 16 19.2 17.5" />
    </svg>
  );
}

export function StopMark({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1" y="1" width="12" height="12" fill="currentColor" />
    </svg>
  );
}

// "Played in Have You Ever Seen the Rain: 40 bars, as the I chord (Intro, Verse, Chorus)."
export function PlayedIn({ songs, children }) {
  if (!songs?.length) return null;
  return (
    <div className={s.songs}>
      {songs.map((song) => (
        <p key={song.id}>
          {children(song)}{" "}
          <Link className={s.link} href={`/member/song/${song.id}`}>
            Practise it
          </Link>
        </p>
      ))}
    </div>
  );
}

export function Notes({ notes, root = "1", sub = (n) => (n.interval === "1" ? "R" : n.interval) }) {
  return (
    <ul className={s.notes} aria-label="Notes">
      {notes.map((n) => (
        <li key={`${n.name}-${n.interval}`} className={`${s.note} ${n.interval === root ? s.noteRoot : ""}`}>
          <span className={s.noteName}>{n.name}</span>
          <span className={s.noteInterval}>{sub(n)}</span>
        </li>
      ))}
    </ul>
  );
}
