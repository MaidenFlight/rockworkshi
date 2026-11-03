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

export const section = { padding: "18px 22px", borderBottom: "1px solid var(--rw-border)" };
export const hint = { margin: 0, fontSize: 12.5, color: "var(--rw-meta)", lineHeight: 1.5 };
