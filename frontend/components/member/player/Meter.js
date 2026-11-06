"use client";

import { useEffect, useRef } from "react";
import { METER_FLOOR_DB, createBallistics, measure, meterFraction, toDb } from "@/lib/audio/meters";

const SETTLE_S = 2; // keeps reading this long after the sound stops, so the bars fall rather than vanish

// A level meter reading one or two AnalyserNodes in the real signal path (two for left and
// right). The bar runs from METER_FLOOR_DB to full scale with zones for safe, hot and the top,
// and a peak line that holds for a moment. clipAt is an amplitude: the light comes on when a
// peak reaches it, and stays on for a moment so it can be seen.
// getNodes is called each frame, so a node that appears later (the mic) is picked up.
export default function Meter({ getNodes, active, vertical = true, length = 120, thickness = 6, clipAt = null, clipLabel = "Clip", title }) {
  const box = useRef(null);
  const clip = useRef(null);

  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const wells = [...(box.current?.querySelectorAll("[data-well]") ?? [])];
    const meters = wells.map(() => createBallistics());
    const scratch = new Float32Array(1024);
    let then = performance.now();
    let quietSince = active ? null : then;
    let clipUntil = 0;
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(0.1, (now - then) / 1000);
      then = now;
      const nodes = getNodes() ?? [];
      let anyClip = false;
      wells.forEach((well, i) => {
        const node = nodes[i] ?? nodes[0];
        const { peak } = node ? measure(node, scratch) : { peak: 0 };
        if (clipAt !== null && peak >= clipAt) anyClip = true;
        const { shown, held } = meters[i].step(toDb(peak), still ? 1 : dt);
        const f = meterFraction(shown);
        const h = meterFraction(held);
        well.firstChild.style.transform = vertical ? `scaleY(${1 - f})` : `scaleX(${1 - f})`;
        // The peak line is the edge of a full-size layer, so a percentage moves it along the bar.
        well.lastChild.style.transform = vertical ? `translateY(${(1 - h) * 100}%)` : `translateX(${(h - 1) * 100}%)`;
        well.lastChild.style.opacity = held > METER_FLOOR_DB + 1 ? "1" : "0";
      });
      if (anyClip) clipUntil = now + 1500;
      if (clip.current) clip.current.dataset.on = now < clipUntil ? "true" : "false";
      if (quietSince !== null && now - quietSince > SETTLE_S * 1000) return;
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, getNodes, clipAt, vertical]);

  const channels = (getNodes() ?? []).length > 1 ? 2 : 1;
  const wellStyle = {
    position: "relative",
    overflow: "hidden",
    width: vertical ? thickness : length,
    height: vertical ? length : thickness,
    background: `linear-gradient(${vertical ? "0deg" : "90deg"}, var(--rw-meter-low) 0%, var(--rw-meter-low) 62%, var(--rw-meter-mid) 62%, var(--rw-meter-mid) 88%, var(--rw-meter-high) 88%)`,
  };
  return (
    <div
      ref={box}
      role="img"
      aria-label={title}
      title={title}
      style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 4 }}
    >
      {clipAt !== null && (
        <span ref={clip} data-on="false" className="rw-clip-led" title={clipLabel}>
          {clipLabel}
        </span>
      )}
      <div style={{ display: "flex", flexDirection: vertical ? "row" : "column", gap: 2 }}>
        {Array.from({ length: channels }, (_, i) => (
          <div key={i} data-well="true" style={wellStyle}>
            {/* The unlit part of the bar covers the zones from the top down. */}
            <span style={{ position: "absolute", inset: 0, background: "var(--rw-console-well)", transformOrigin: vertical ? "top" : "right", transform: vertical ? "scaleY(1)" : "scaleX(1)" }} />
            <span
              style={{
                position: "absolute",
                inset: 0,
                ...(vertical ? { borderTop: "2px solid var(--rw-console-text)" } : { borderRight: "2px solid var(--rw-console-text)" }),
                opacity: 0,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
