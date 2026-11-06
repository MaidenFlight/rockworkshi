import Link from "next/link";
import s from "./library.module.css";

const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

// The school's songs, read for their chords: the key, every chord with its place in the key, and
// the named progressions. Drummers see the grooves instead.
export default function SongsTab({ overview, onChord, onGroove }) {
  const { songs, kind } = overview;
  if (!songs.length) {
    return (
      <div className={s.notice}>
        <h2>No songs to read yet</h2>
        <p>When a song in the library has its chords charted, they&apos;ll show up here with every chord linked.</p>
      </div>
    );
  }
  return (
    <ul className={s.list}>
      {songs.map((song) => (
        <li key={song.id} className={s.item}>
          <div className={s.itemHead}>
            <h2 className={s.itemTitle}>{song.title}</h2>
            <Link className={s.link} href={`/member/song/${song.id}`}>
              Practise it
            </Link>
          </div>
          {song.artist && <p className={s.muted} style={{ margin: "0 0 12px" }}>{song.artist}</p>}

          {kind === "drums" ? (
            <div className={s.row}>
              {song.grooves.map((g) => (
                <button key={g.id} type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => onGroove(g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
          ) : (
            <>
              {song.key && (
                <p className={s.about}>
                  In <strong>{song.key.name}</strong>.{" "}
                  {song.fromChart
                    ? "Bars counted from the song's chart."
                    : "From the song's chord list: it doesn't have a chart on the site yet."}
                </p>
              )}
              <div className={s.row} style={{ marginBottom: 12 }}>
                {song.chords.map((c) => (
                  <button key={c.name} type="button" className={s.chordChip} disabled={!c.id} onClick={() => c.id && onChord(c.id)} title={c.bars ? `${c.bars} bars` : undefined}>
                    <span className={s.chordChipName}>{c.display}</span>
                    <span className={s.chordChipSub}>{c.numeral || "—"}</span>
                  </button>
                ))}
              </div>
              {song.progressions.length > 0 && (
                <p className={s.about} style={{ margin: 0 }}>
                  {song.fromChart ? "Progressions in it: " : "Its chords make "}
                  {list(song.progressions.map((p) => (p.section ? `${p.name} (${p.section.toLowerCase()})` : p.name)))}.
                </p>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
