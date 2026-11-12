"use client";

import { useEffect, useRef } from "react";
import s from "./live.module.css";

// One picture in the live room test: a LiveKit video track (someone else's, or this tab's own
// preview) in a 16:9 frame, or a quiet placeholder when there's nothing to show. LiveKit's
// attach() wires the track to the element; with adaptiveStream on, it also watches the element's
// size so a small tile only receives a small picture.
export default function VideoTile({ track, label, mirror = false, placeholder = "No picture", size = "strip" }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return undefined;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <figure className={s.tile} data-size={size}>
      {track ? (
        <video ref={ref} className={s.video} data-mirror={mirror ? "true" : undefined} autoPlay playsInline muted />
      ) : (
        <span className={s.noPicture}>{placeholder}</span>
      )}
      {label && <figcaption className={s.tileLabel}>{label}</figcaption>}
    </figure>
  );
}
