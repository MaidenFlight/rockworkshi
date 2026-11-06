"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import T from "@/components/T";

// The player preview's frame on the homepage. The console itself is only fetched once a visitor
// scrolls near it, so the page stays light for everyone who doesn't.
const ConsolePreview = dynamic(() => import("./ConsolePreview"), { ssr: false, loading: () => <Slot /> });

function Slot() {
  return <div className="rw-preview-slot" aria-hidden="true" />;
}

export default function PlayerPreview() {
  const box = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        watch.disconnect();
      },
      { rootMargin: "600px 0px" }
    );
    watch.observe(box.current);
    return () => watch.disconnect();
  }, []);

  return (
    <section ref={box} className="rw-preview" aria-labelledby="player-preview">
      <div className="rw-preview-head">
        <h3 id="player-preview" className="rw-preview-title">
          <T k="home.preview.title">Practise it in the player</T>
        </h3>
        <p className="rw-ink-lead rw-preview-cap">
          <T k="home.preview.caption">
            A silent preview of the play-along player, on eight bars of the chorus of “Have You Ever Seen the Rain”. Press
            Play and follow the chords, or switch to the bass or drum part. In the member area the band plays too, each
            part on its own track, so you can slow it down, loop a bar or leave your part out.
          </T>
        </p>
      </div>
      {near ? <ConsolePreview /> : <Slot />}
      <div className="rw-preview-cta">
        <Button href="/signup">
          <T k="cta.join">Join the member area</T>
        </Button>
      </div>
    </section>
  );
}
