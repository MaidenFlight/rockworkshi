"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import VideoPlayer from "@/components/member/VideoPlayer";

export default function LessonDetail() {
  const { id } = useParams();
  const [lesson, setLesson] = useState(undefined);
  const [activeLevel, setActiveLevel] = useState(1);

  useEffect(() => {
    fetch(`${API_URL}/lessons/${id}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setLesson(data.lesson))
      .catch(() => setLesson(null));
  }, [id]);

  if (lesson === undefined) {
    return <div style={{ maxWidth: 900, margin: "80px auto", textAlign: "center", color: "#6a6560" }}>Loading…</div>;
  }
  if (!lesson) {
    return (
      <div style={{ maxWidth: 900, margin: "80px auto", textAlign: "center", color: "#6a6560" }}>
        Lesson not found. <Link href="/member" style={{ color: "#cf3f20" }}>Back to dashboard</Link>
      </div>
    );
  }

  const levels = lesson.levels || [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 100px" }}>
      <Link href="/member" style={{ fontSize: 13.5, color: "#8a7d6a", textDecoration: "none" }}>
        &larr; Back to lessons
      </Link>
      <div style={{ marginTop: 10, marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0e8a97" }}>
          {lesson.difficulty} &middot; Key of {lesson.key}
        </div>
        <h1 style={{ fontWeight: 600, fontSize: 30, color: "#0a2338", margin: "6px 0 2px" }}>{lesson.title}</h1>
        <p style={{ color: "#8a7d6a", margin: 0 }}>{lesson.artist}</p>
      </div>

      <VideoPlayer lesson={lesson} />

      <h3 style={{ fontWeight: 700, fontSize: 16, color: "#0a2338", margin: "36px 0 12px" }}>Five levels</h3>
      <div>
        {levels.map((lv) => (
          <div key={lv.n} style={{ borderBottom: "1px solid #ece0d5" }}>
            <button
              onClick={() => setActiveLevel(activeLevel === lv.n ? null : lv.n)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 4px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: activeLevel === lv.n ? "#ef5130" : "#e6d8c6",
                  color: activeLevel === lv.n ? "#fff" : "#33454f",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 12.5,
                  flexShrink: 0,
                }}
              >
                {lv.n}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#0a2338" }}>{lv.name}</span>
            </button>
            {activeLevel === lv.n && (
              <p style={{ margin: "0 0 16px 40px", fontSize: 14, color: "#6a6560", lineHeight: 1.55 }}>{lv.blurb}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
