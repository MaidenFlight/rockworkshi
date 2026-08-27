# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: a prospective student who signs themselves up.** Confirmed by the
user: "for students looking to sign up." They arrive not yet enrolled, decide
this is their school, and complete signup, verification, the onboarding
questionnaire and payment on their own. Design choices are resolved in their
favour when groups conflict.

Two further audiences the product genuinely serves, but which do not outrank the
primary:

- **Enrolled members** working through the member area between lessons —
  per-instrument lesson videos, the song library, and the practice tools.
- **School staff** using `/admin` to manage lessons and their videos, teachers,
  songs, FAQs, on-stage posts, resources, media, pages, trial requests, contact
  messages and student records.

## Product Purpose

Rock Works School of Music is a music school in Honolulu. The site does two jobs
at once: it convinces a prospective student to join, and it delivers the paid
member area to them afterwards.

The teaching method is the product: every student learns through a real song
from the first lesson rather than through drills, and each song is taught across
five levels — sing-a-long, chords, scales & fills, melody, improv. Success is a
student who is playing music they chose, in front of people.

## Positioning

Songs first, theory through them — the inverse of a programme that starts with
scales and hopes songs arrive later. Two things a neighbouring school could not
truthfully copy without rebuilding what it teaches:

- **The five-level treatment of a single song.** A song is not "learned" when a
  student can play along; it is learned at the end of five passes through it.
- **A stated ten-year path.** The school will tell a student where they will be
  at six months, and at one, two, three, five and ten years.

Everything aims at a stage. One-on-one or in a Rock Band with friends, students
are always building toward performing.

## Operating Context

- A physical Honolulu school plus an online member area. **The membership is sold
  both ways** (confirmed): enrolled in-person students get it, *and* it is sold
  on its own to people who are not taking lessons at the school.
- **Access is what is priced; teaching is not.** The plan catalogue sells entry
  to the member area. Arranging actual lessons is a conversation with the school
  — deliberately never priced on the site.
- Two plans: **Monthly, $55**, cancel any time; **Term, $135** paid up front for
  three months (~$45/mo), renewing each term. Amounts live only on the server;
  the client sends a plan name, never a price.
- The enrolment path is a gate sequence, and a user is held at the first step
  they have not cleared: sign up → verify email → onboarding questionnaire →
  payment. Only a verified payment event sets paid status; returning to a success
  page does not.
- Public marketing lives across ~40 routes (philosophy, history, curriculum,
  format, how-it-works, teachers, alumni, events, on-stage, programs, song
  library, FAQ, contact, trial, and the legal set).

## Capabilities and Constraints

- **Six instruments, and the six names are load-bearing strings**: Guitar, Piano,
  Bass, Drums, Voice, Ukulele. Signup stores the string on the user; the backend
  matches lesson videos against the same list. A rename on either side silently
  hides every video, so the set is not casually editable.
- **A lesson video is one of two kinds** — the teaching video (`lesson`) or the
  song played straight through (`playthrough`) — across levels 1–5, per
  instrument. Staff paste a host id in the admin editor rather than uploading.
- **Video hosting is Bunny Stream, and playback is not finished.** Signed URLs
  are unimplemented, so a pasted Bunny id deliberately shows "coming soon"
  rather than a player that fails silently. Plain URLs play directly.
- **Practice tools in the member area:** tuner, metronome, chord library,
  on-screen piano, rhythm trainer.
- Members can cancel their own membership.
- Contact addresses must resolve to a real mailbox. Verifying a sending domain
  does not create one, so a visible address that bounces is a defect, not a
  detail.

## Brand Commitments

- **Name and location:** Rock Works School of Music, Honolulu. The site is
  `rockworksschoolofmusichawaii.com`. `rockworkshi.com` belongs to the owner and
  is a different, unrelated business — never treat it as this product's.
- **Binding visual constraint, in the user's words:** "make it look cool to
  rockers, but give it a hawaiian vibe." Recorded as given; not expanded here.
- **The identity must be the school's own.** A borrowed logomark (another
  company's registered trademark) was previously standing in as this school's
  identity and was removed for exactly that reason. Nothing borrowed goes back.
- **Voice:** warm, plain, local. The copy uses ʻohana and keiki naturally and
  addresses the reader directly. It does not oversell.

## Evidence on Hand

**Real, confirmed by the user, and must be preserved:**

- The school was **established in Honolulu in 1982**.

**Not real. Placeholder content currently on a live site that takes payment.
Future work must not repeat any of it as fact, and must not invent more:**

- The homepage testimonials ("My daughter looks forward to Rock Works more than
  anything else in her week," and the two beside it).
- The statistics band — **96%** of families, **9 in 10** students still playing
  after five years — and its attribution to a "Rock Works Family Survey, 2026".
  No such survey is confirmed to exist.
- The teacher profiles on `/teachers`.

**Absences to respect:** there are no confirmed customer quotes, no outcome data,
and no confirmed staff roster. Where a design calls for proof, ask for it rather
than writing it.

## Product Principles

1. **A real song from the first lesson.** Anything that puts drills, theory or
   setup between a student and playing music is wrong for this school.
2. **Address the player, not their parent.** The primary reader is the person who
   will pick up the instrument and enrol themselves.
3. **Sell access, arrange teaching.** The site prices the member area and opens a
   conversation about lessons; it never prices the teaching.
4. **Claim only what the school can stand behind.** This product is currently
   carrying invented proof. Every number, quote and named person must trace to
   something real, or come out.
5. **Everything points at a stage.** Performing is the destination, so the path
   toward it should stay visible rather than being a surprise at the end.
