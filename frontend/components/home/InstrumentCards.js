"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { instruments } from "@/lib/content";
import { nextEnrolmentStep } from "@/lib/auth/enrolment";
import T from "@/components/T";
import styles from "./InstrumentCards.module.css";

const photos = {
  Guitar: { file: "guitar", position: "50% 50%" },
  Piano: { file: "piano", position: "50% 50%" },
  Bass: { file: "bass", position: "50% 50%" },
  Drums: { file: "drums", position: "50% 62%" },
  Voice: { file: "voice", position: "50% 35%" },
  Ukulele: { file: "ukulele", position: "50% 48%" },
};

export default function InstrumentCards() {
  const { user, isLoading } = useAuth();
  const enrolled = !isLoading && user?.emailVerified && user?.profileComplete && user?.paymentComplete;
  const pending = !isLoading && user ? nextEnrolmentStep(user) : null;

  return (
    <>
      <p className={styles.lead}>
        {enrolled ? "Explore songs and pick up where you left off in the practice library." : pending ? "Continue setting up your membership to start learning." : (
          <T k="home.instruments.lead">Lesson videos in the member area are organised by instrument. Pick yours and we&apos;ll carry it into signup.</T>
        )}
      </p>
      <div className={styles.grid}>
        {instruments.map(({ name }) => {
          const photo = photos[name];
          const action = enrolled ? "Open practice library" : pending ? "Continue signup" : `Start with ${name.toLowerCase()}`;
          return (
            <Link
              key={name}
              href={enrolled ? "/member/library" : pending || `/signup?instrument=${encodeURIComponent(name)}`}
              className={styles.card}
              aria-label={`${name} — ${action}`}
            >
              <span className={styles.photo}>
                <Image
                  src={`/images/instruments/${photo.file}.jpg`}
                  alt=""
                  fill
                  sizes="(max-width: 380px) calc(100vw - 48px), (max-width: 700px) calc(50vw - 32px), (max-width: 1200px) calc(33.333vw - 32px), 368px"
                  style={{ objectPosition: photo.position }}
                />
              </span>
              <span className={styles.caption}>
                <span className={styles.name}>{name}</span>
                <span className={styles.action}>{action} <span aria-hidden="true">↗</span></span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
