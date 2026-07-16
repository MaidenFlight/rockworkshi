"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const TOOLS = [
  { name: "Guitar Tuner", emoji: "\u{1F3B8}", href: "/tools/tuner" },
  { name: "Metronome", emoji: "⏱️", href: "/tools/metronome" },
  { name: "Chord Library", emoji: "\u{1F4D6}", href: "/tools/chords" },
  { name: "Piano Notes", emoji: "\u{1F3B9}", href: "/tools/piano" },
  { name: "Rhythm Trainer", emoji: "\u{1F941}", href: "/tools/rhythm" },
];

const ACHIEVEMENTS = [
  { emoji: "\u{1F3B5}", name: "First Song" },
  { emoji: "\u{1F525}", name: "7-Day Streak" },
  { emoji: "\u{1F3A4}", name: "Stage Ready" },
];

export default function MemberDashboard() {
  const { user } = useSession();
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/lessons`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLessons(data.lessons || []))
      .catch(() => setLessons([]));
  }, []);

  const stats = user?.practiceStats || { weeklyMinutes: 0, weeklyGoal: 90, streak: 0 };
  const wkPct = Math.min(100, Math.round((stats.weeklyMinutes / (stats.weeklyGoal || 1)) * 100));
  const ringR = 46;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - wkPct / 100);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 100px" }}>
      <h1 style={{ fontWeight: 600, fontSize: 30, color: "#0a2338", marginBottom: 4 }}>
        Welcome back{user?.name ? `, ${user.name}` : ""}
      </h1>
      <p style={{ color: "#6a6560", marginBottom: 36 }}>Pick up where you left off, or grab a practice tool.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 44 }}>
        {TOOLS.map((tool) => (
          <Link
            key={tool.name}
            href={tool.href}
            className="rw-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "24px 12px",
              background: "#fffdf9",
              border: "1px solid #ece0d5",
              borderRadius: 14,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 30 }}>{tool.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: "#0a2338", textAlign: "center" }}>{tool.name}</span>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 32 }}>
        <div>
          <h2 style={{ fontWeight: 600, fontSize: 20, color: "#0a2338", marginBottom: 16 }}>Your lessons</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/member/lesson/${lesson.id}`}
                className="rw-card"
                style={{
                  display: "block",
                  padding: 18,
                  background: "#fffdf9",
                  border: "1px solid #ece0d5",
                  borderRadius: 14,
                  textDecoration: "none",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 6 }}>
                  {lesson.difficulty} &middot; {lesson.key}
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#0a2338" }}>{lesson.title}</div>
                <div style={{ fontSize: 13.5, color: "#8a7d6a" }}>{lesson.artist}</div>
                <div style={{ fontSize: 12.5, color: "#6a6560", marginTop: 8 }}>{lesson.estTime}</div>
              </Link>
            ))}
            {lessons.length === 0 && <p style={{ color: "#8a7d6a" }}>No lessons assigned yet.</p>}
          </div>
        </div>

        <div>
          <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 14, padding: 24, textAlign: "center", marginBottom: 20 }}>
            <svg viewBox="0 0 110 110" width={110} height={110}>
              <circle cx={55} cy={55} r={ringR} fill="none" stroke="#e6d8c6" strokeWidth={9} />
              <circle
                cx={55}
                cy={55}
                r={ringR}
                fill="none"
                stroke="#ef5130"
                strokeWidth={9}
                strokeDasharray={ringC}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
              />
              <text x={55} y={60} textAnchor="middle" fontSize={20} fontWeight={700} fill="#0a2338">
                {wkPct}%
              </text>
            </svg>
            <p style={{ margin: "10px 0 2px", fontSize: 13.5, color: "#33454f" }}>
              {stats.weeklyMinutes} / {stats.weeklyGoal} min this week
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#8a7d6a" }}>{stats.streak || 0}-day streak</p>
          </div>

          <div style={{ background: "#fffdf9", border: "1px solid #ece0d5", borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0e8a97", marginBottom: 12 }}>
              Achievements
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {ACHIEVEMENTS.map((a) => (
                <div key={a.name} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 24 }}>{a.emoji}</div>
                  <div style={{ fontSize: 11, color: "#6a6560", marginTop: 4 }}>{a.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
