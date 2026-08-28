"use client";

import { useEffect, useState } from "react";
import EditorialHero from "@/components/EditorialHero";
import { Container, Button } from "@/components/ui";
import { API_URL } from "@/lib/api";

// A list of dated performances is a bill, and this world already knows what a
// bill looks like. The date leads in condensed type, the act is set at title
// scale, and a rule runs between them.
//
// The states matter more than the styling here, because this page is the one
// public route whose content comes from the API and the school may genuinely
// have nothing scheduled. It previously showed the word "Loading…" in grey and,
// on failure, exactly the same sentence as an empty calendar — so a broken
// backend and a quiet month were indistinguishable to a visitor, and both read
// as "this school does nothing". They are three different states now and each
// says something true.
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
        eyebrow="Community"
        title="Events"
        intro="Recitals, showcases, and performances throughout the year."
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
                <span className="rw-bill-date">{p.date}</span>
                <div>
                  <h2 className="rw-bill-title">{p.title}</h2>
                  <p className="rw-bill-desc">{p.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* An empty calendar is not an error and should not apologise like one:
            the school runs recitals, and "nothing listed yet" is a scheduling
            fact. A broken fetch IS an error, and saying so lets a visitor know
            to try again rather than concluding the school is dormant. */}
        {posts && posts.length === 0 && (
          <div className="rw-empty">
            <p className="rw-empty-lead">
              {failed
                ? "The events list would not load just now."
                : "Nothing on the calendar yet this season."}
            </p>
            <p className="rw-empty-body">
              {failed
                ? "That is our end, not yours. Try again in a moment, or ask us what is coming up."
                : "Bands rehearse weekly and finish at a Rock Works recital, so dates go up as they are set. Ask us what is coming up, or come and see a lesson first."}
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <Button href="/contact">Ask what&apos;s coming up</Button>
              <Button href="/trial" variant="quiet">
                Book a free trial &rarr;
              </Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
