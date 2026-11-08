"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keptWhen, takeDetails, takeKey } from "@/lib/takeStore";
import Icon from "./Icon";
import s from "./UnsentTake.module.css";

// A take recorded for this practice work that's kept in this browser but hasn't been sent
// (lib/takeStore.js): says so, with the way back to it in the player. Draws nothing when there isn't
// one, or when this browser can't say. `aside` sets it as the practice panel's closing line.
export default function UnsentTake({ songId, assignmentId, aside = false }) {
  const [kept, setKept] = useState(null);

  useEffect(() => {
    let cancelled = false;
    takeDetails(takeKey(songId, assignmentId)).then((details) => {
      if (!cancelled) setKept(details);
    });
    return () => {
      cancelled = true;
    };
  }, [songId, assignmentId]);

  if (!kept) return null;
  const href = `/member/song/${songId}?assignment=${assignmentId}`;
  const name = kept.name?.trim() || `Take ${kept.number || 1}`;

  if (aside) {
    return (
      <p className="rw-next-aside">
        {name} from {keptWhen(kept.recordedAt)} isn&apos;t sent yet. <Link href={href}>Open it in the player</Link>
      </p>
    );
  }
  return (
    <p className={s.note} role="status">
      <span className={s.mark} aria-hidden="true">
        <Icon name="record" size={12} />
      </span>
      <span>
        <strong>{name} isn&apos;t sent yet.</strong> It&apos;s kept in this browser since {keptWhen(kept.recordedAt)}.{" "}
        <Link href={href} className={s.link}>
          Open it in the player
        </Link>
      </span>
    </p>
  );
}
