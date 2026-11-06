// Inline styles shared by the stem player and its mixer panels.

// A small section heading. Sentence case: tracked uppercase kickers read as template filler.
export const eyebrow = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--rw-ink)",
  marginBottom: 10,
};

export const btn = {
  padding: "9px 14px",
  borderRadius: "var(--rw-radius-sm)",
  border: "1px solid var(--rw-line)",
  background: "#fff",
  color: "var(--rw-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

export const smallBtn = { ...btn, padding: "5px 10px", fontSize: 12 };

export function chip(active) {
  return {
    padding: "8px 14px",
    borderRadius: "var(--rw-radius-sm)",
    border: active ? "1px solid var(--rw-orange)" : "1px solid var(--rw-line)",
    background: active ? "var(--rw-orange-tint)" : "#fff",
    fontWeight: 700,
    fontSize: 13,
    color: "var(--rw-ink)",
    cursor: "pointer",
  };
}

// Square M / S buttons. `tone` colours them when pressed.
export function toggleBtn(pressed, tone) {
  return {
    width: 30,
    height: 28,
    padding: 0,
    borderRadius: "var(--rw-radius-sm)",
    border: `1px solid ${pressed ? tone : "var(--rw-line)"}`,
    background: pressed ? tone : "#fff",
    color: pressed ? "#fff" : "var(--rw-ink)",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  };
}

// Brushed metal lit from above, for the mixer's panel and the tape deck.
export const metal = {
  borderRadius: "var(--rw-radius-md)",
  border: "1px solid var(--rw-line)",
  background: "linear-gradient(180deg, var(--rw-chrome-hi), color-mix(in srgb, var(--rw-chrome-mid) 45%, var(--rw-chrome-hi)))",
  boxShadow: "inset 0 1px 0 var(--rw-chrome-hi), 0 1px 2px rgba(22, 18, 28, 0.08)",
};

export const section = { padding: "18px 22px", borderBottom: "1px solid var(--rw-border)" };
export const hint = { margin: 0, fontSize: 12.5, color: "var(--rw-meta)", lineHeight: 1.5 };
