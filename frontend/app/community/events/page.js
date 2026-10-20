"use client";

import { useEffect, useState } from "react";
import EditorialHero from "@/components/EditorialHero";
import T from "@/components/T";
import { Container, Button } from "@/components/ui";
import { API_URL } from "@/lib/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (!name) return value;
  return `${Number(day)} ${name} ${year}`;
}

export default function Events() {
  const [posts, setPosts] = useState(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/onstage`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => {
        setFailed(true);
        setPosts([]);
      });
  }, []);

  return (
    <div>
      <EditorialHero
        eyebrow={<T k="events.hero.eyebrow">Community</T>}
        title={<T k="events.hero.title">Events</T>}
        intro={<T k="events.hero.intro">Recitals, showcases, and performances throughout the year.</T>}
      />

      <Container width="text" style={{ padding: "56px 24px 80px" }}>
        {posts === undefined && (
          <ul className="rw-bill" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="rw-bill-row rw-bill-skeleton" aria-hidden="true">
                <span className="rw-bill-date" />
                <div>
                  <span className="rw-bill-title" />
                  <span className="rw-bill-desc" />
                </div>
              </li>
            ))}
            <li className="rw-sr-only">Loading events</li>
          </ul>
        )}

        {posts && posts.length > 0 && (
          <ul className="rw-bill">
            {posts.map((p) => (
              <li key={p.id} className="rw-bill-row">
                <time className="rw-bill-date" dateTime={p.date}>
                  {formatDate(p.date)}
                </time>
                <div>
                  <h2 className="rw-bill-title">{p.title}</h2>
                  <p className="rw-bill-desc">{p.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {posts && posts.length === 0 && (
          <div className="rw-empty">
            <p className="rw-empty-lead">
              {failed ? (
                <T k="events.failed.lead">The events list would not load just now.</T>
              ) : (
                <T k="events.empty.lead">Nothing on the calendar yet this season.</T>
              )}
            </p>
            <p className="rw-empty-body">
              {failed ? (
                <T k="events.failed.body">That is our end, not yours. Try again in a moment, or ask us what is coming up.</T>
              ) : (
                <T k="events.empty.body">
                  Bands rehearse weekly and finish at a Rock Works recital, so dates go up as they are set. Ask us
                  what is coming up, or come and see a lesson first.
                </T>
              )}
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <Button href="/contact"><T k="events.cta.ask">Ask what&apos;s coming up</T></Button>
              <Button href="/trial" variant="quiet">
                <T k="cta.trial">Book a free trial &rarr;</T>
              </Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
