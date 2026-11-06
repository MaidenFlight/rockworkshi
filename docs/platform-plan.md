# Rock Works platform expansion: architecture and Phase 1 plan

Written 2026-11-05 from the code as it stands on `feature/practice-library-and-terms`. Nothing in
this document has been built yet. It covers the four features asked for (Live, Teacher Studio,
Insights, Bands), what already exists that they can stand on, and a Phase 1 that is small enough to
ship and verify.

---

## 1. What exists today

**Stack.** Express 5 API with Prisma 7 on Postgres (Neon in production, Docker locally), deployed on
Render. Next.js 16 website (Netlify config in the repo). Expo phone app. Recordings and stems in
Cloudflare R2 behind short-lived signed links. Email through Resend. Payments through Stripe.
Sessions are `express-session` cookies stored in Postgres; the phone uses a bearer token
(`lib/mobileToken.js`). `express-rate-limit` is already installed and used.

**Accounts and roles.**

| Who | How it works now |
|---|---|
| Student | `User.role = "student"` (the default). Paid access from a verified Stripe event (`paidAt`). |
| Teacher | `User.role = "teacher"`, set by the admin. Sees only students linked in `TeacherStudent`. |
| Admin | Not a role: whoever signs in with `ADMIN_EMAIL`. One person. |
| Guardian | Doesn't exist. A minor's signup stores `isMinor`, `sponsorName` and `sponsorEmail` as plain text. |

Checks live in `middleware/auth.js` (`requireAuth`, `requirePaid`, `requireTeacher`,
`requireAdmin`) and `lib/termAccess.js`. They are enforced on the server.

**Teaching that already works, and that the new features should grow from rather than replace:**

- **Assignments and submissions** (`Assignment`, `Submission`, `routes/assignments.routes.js`,
  `/teacher`, `/member/assignment/[id]`). A teacher sets work on a song section or lesson, the student
  records against the band in the player and sends it, the teacher reviews with written feedback. The
  recording keeps its offset in the song so it plays in time.
- **Term groups** (`TermGroup`, `TermSlot`, `TermEnrollment`, `TermGrant`). Three-month groups with
  scheduled, published song unlocks in Honolulu time. This is the school's existing idea of a class
  group.
- **Practice state per song** (`SongPractice`): favourite, private notes, last opened, and a resume
  session (position, speed, loop, mix). `User.practiceStats` is a JSON placeholder with no writer.
- **The song player** (`StemPlayer` and its parts): multitrack playback, loops, speed, chart,
  recording, effects. Reusable as-is inside a classroom page and for "assign from the player".

**What's missing for the new features.** No calendar, classes, attendance, guardian accounts, consent
records, interest profiles, practice event history (only the latest resume state is kept), video
provider connections, notifications, audit log or general time-zone handling (`lib/honolulu.js` covers
one zone).

**Things to keep in mind.**

- `User` mixes login, billing and student profile fields. New profile data should go in its own
  tables, not more columns on `User`.
- The six instrument names are load-bearing strings (`lib/lessonVideos.js`); new tables must reuse
  them.
- Assignments are one teacher to one student. Class-wide assignments should create one assignment
  per student, so the existing review flow keeps working unchanged.
- There's no general job runner. Render can run a cron job; until then, work that must happen on a
  schedule (reminders, aggregation) has to be computed on read or triggered by a cron route.

---

## 2. Feature architecture

Each feature is a service boundary in the API (its own routes file and `lib/` module), sharing one
permissions module and one database.

```
                   +-------------------- permissions (lib/policy.js) --------------------+
                   |                                                                      |
  Teacher Studio --+-- people: roles, profiles, guardians, consent, rosters             |
  (scheduling,     +-- calendar: classes, occurrences, enrolments, attendance           |
   rosters,        +-- teaching: assignments, submissions, feedback (exists today)      |
   admin)          +-- video: provider connections, meetings, webhooks (pluggable)      |
                   +-- insights: practice events -> daily rollups -> reports            |
                   +-- bands: interest profiles, matching, bands, rehearsals            |
                   +----------------------------------------------------------------------+
```

- **Permissions in one place.** A `can(user, action, resource)` module replaces the scattered checks
  over time. Every route calls it; the frontend only hides what the API would refuse anyway.
- **Video behind an interface.** `createMeeting`, `updateMeeting`, `deleteMeeting` and
  `fetchAttendance`, with a Google Meet adapter first (decided 2026-11-05); Zoom can be added later as a
  second adapter. A plain "meeting link" field works
  with no provider at all, so classes are usable before any integration exists.
- **Analytics from events, not guesses.** The player records a small practice event when a session
  ends (song, seconds played, speed, loop used). Nightly or on-demand rollups produce per-student daily
  totals. Reports read rollups, never raw events.

---

## 3. Page and navigation map

| Role | Area | Pages (tabs within, not one long page) |
|---|---|---|
| Student | `/member` | Dashboard (this week, next lesson, pending work, feedback) · Library · Song player · Lessons · My classes · Assignments · Recordings · Profile and privacy · Bands (only if opted in) |
| Guardian | `/family` | Children · each child's schedule, assignments and teacher feedback · consents · messages from the school |
| Teacher | `/teacher` (Teacher Studio) | Today · Calendar · Classes (create, recur, roster, attendance) · Students (search, profile, notes, goals) · Assignments and reviews · Insights · Bands |
| Teacher, in a class | `/class/[occurrenceId]` (Live) | Video or join link · agenda · song and loop · participants · questions · notes · assignments |
| Admin | `/admin` (exists) | adds: People and roles · Teachers' workload · Enrolment and waitlists · School reports · Audit log |

---

## 4. Database schema and migration plan

All changes are additive: new tables and new nullable columns, so existing data and the phone app
keep working. Times are stored as UTC instants **plus** the IANA time zone the teacher scheduled in,
so recurring lessons keep their wall-clock time across daylight-saving changes.

**Phase 1 tables**

```prisma
// Roles: "student" | "teacher" | "admin" | "guardian". ADMIN_EMAIL stays as the first admin.
// User.role remains for compatibility; a user can hold more than one role (a teacher who is a parent).
model UserRole {
  userId String
  role   String
  grantedBy String?
  createdAt DateTime @default(now())
  @@id([userId, role])
}

model StudentProfile {           // all optional, all student-editable
  userId        String  @id
  ageBracket    String?          // "under-13" | "13-17" | "18+" , self-declared, never inferred
  area          String?          // general area by choice, e.g. "Windward O'ahu"; never from IP
  goals         String?
  rehearsalFormat String?        // "online" | "in-person" | "either"
  interests     Json?            // genres, artists, songs, activities, self-described learning preferences
  bandInterest  Boolean @default(false)
  performInterest Boolean @default(false)
  productionInterest Boolean @default(false)
  visibility    String  @default("teachers")   // who can see it: "private" | "teachers"
  updatedAt     DateTime @updatedAt
}

model InstrumentSkill {          // one row per instrument a student plays
  userId     String
  instrument String               // one of the six INSTRUMENTS
  primary    Boolean @default(false)
  selfLevel  String?              // what the student says
  teacherLevel String?            // what a teacher assessed, kept separate on purpose
  @@id([userId, instrument])
}

model Availability {             // weekly windows, in the person's own time zone
  id String @id @default(uuid())
  userId String
  weekday Int                      // 0-6
  startMinute Int                  // minutes after local midnight
  endMinute Int
  timeZone String
}

model Class {                    // a lesson, group class, workshop, rehearsal or performance
  id String @id @default(uuid())
  teacherId String
  kind String                      // "lesson" | "group" | "workshop" | "rehearsal" | "performance"
  title String
  description String?
  level String?
  instruments String[]
  capacity Int?
  timeZone String                  // IANA, e.g. "Pacific/Honolulu"
  recurrence Json?                 // { every: "week"|"month", interval, until, weekdays } ; null = one-off
  meetingUrl String?               // a pasted link works before any video integration
  songId String?                   // optional song and section to practise
  sectionStart Float?
  sectionEnd Float?
  status String @default("active")
  createdAt DateTime @default(now())
}

model ClassOccurrence {          // one dated session; recurrences are materialised a few months ahead
  id String @id @default(uuid())
  classId String
  startsAt DateTime                // UTC
  endsAt   DateTime
  status String @default("scheduled")   // "scheduled" | "cancelled" | "moved"
  movedFrom DateTime?
  notes String?                    // the teacher's private lesson notes
  @@index([startsAt])
}

model ClassEnrollment {
  classId String
  userId  String
  status  String @default("enrolled")   // "invited" | "enrolled" | "waitlisted" | "left"
  createdAt DateTime @default(now())
  @@id([classId, userId])
}

model Attendance {
  occurrenceId String
  userId String
  status String                    // "present" | "late" | "absent" | "excused"
  source String @default("teacher") // "teacher" | "provider"; a teacher's entry always wins
  @@id([occurrenceId, userId])
}

model ConsentRecord {            // who agreed to what, when; withdrawn by a new row, never edited
  id String @id @default(uuid())
  userId String                    // the student
  givenBy String                   // the student, or their guardian
  purpose String                   // "share-practice-with-teachers" | "band-matching" | "recordings-kept" ...
  granted Boolean
  createdAt DateTime @default(now())
}

model AuditEvent {               // role changes, enrolments, consent, deletions
  id String @id @default(uuid())
  actorId String?
  action String
  targetType String
  targetId String
  detail Json?
  createdAt DateTime @default(now())
}
```

```prisma
model GuardianLink {             // made only when a guardian accepts the admin's invite
  guardianId String
  studentId  String
  relationship String?             // "parent" | "guardian"
  invitedBy  String                // the admin
  acceptedAt DateTime?
  inviteTokenHash String?          // sha-256, single use, like the password reset token
  inviteExpiresAt DateTime?
  @@id([guardianId, studentId])
}
```

**Later phases** (designed now, built when their phase starts): `VideoConnection`
(encrypted OAuth tokens), `Meeting`, `PracticeEvent` and `PracticeDaily`, `Milestone`,
`TimedFeedback` (comments at a time in a submission), `Band`, `BandMember`, `BandRehearsal`,
`Setlist`, `Notification`, `Announcement`, `Message` (school-managed and teacher-mediated only).

**Migration rules.** One Prisma migration per phase step. Backfill `UserRole` from `User.role` and
`ADMIN_EMAIL` in the same migration. Copy `User.instrument`, `experience` and `level` into
`InstrumentSkill` without deleting the old columns. Production migrations run only when you deploy,
never from a development session.

---

## 5. API routes and service boundaries

| Boundary | Routes (Phase 1 in bold) |
|---|---|
| people | **`GET/PUT /me/profile`**, **`GET/PUT /me/instruments`**, **`GET/PUT /me/availability`**, **`POST /me/consents`**, **`GET /teacher/students?search&instrument&level`**, **`GET /teacher/students/:id`**, **`PUT /admin/users/:id/roles`** |
| guardians | **`POST /admin/students/:id/guardian-invite`** (to the sponsor email), **`POST /family/accept`**, **`GET /family/children`**, **`GET /family/children/:id/schedule`**, **`POST /family/children/:id/consents`** |
| calendar | **`GET /calendar?from&to`** (me, by role), **`POST /teacher/classes`**, **`PATCH /teacher/classes/:id`**, **`POST /teacher/classes/:id/duplicate`**, **`POST /teacher/occurrences/:id/cancel`**, **`POST /teacher/occurrences/:id/move`**, **`PUT /teacher/occurrences/:id/attendance`**, **`GET /teacher/conflicts?start&end`** |
| enrolment (admin only) | **`POST /admin/classes/:id/enrolments`**, **`DELETE /admin/classes/:id/enrolments/:userId`**, **`GET /admin/classes?search`** (rosters and waitlists) |
| teaching | exists: `/assignments/*`, `/teacher/assignments/*`; later `POST /teacher/classes/:id/assign` (one assignment per student), timestamped feedback |
| video | later: `GET /video/google/connect`, `GET /video/google/callback`, `POST /teacher/occurrences/:id/meet` |
| insights | later: `POST /practice/events`, `GET /me/insights`, `GET /teacher/insights`, `GET /admin/reports` |
| bands | later: `PUT /me/band-interest`, `GET /teacher/bands/suggestions`, `/teacher/bands/*` |

---

## 6. Roadmap

| Phase | Scope | Depends on |
|---|---|---|
| **1** | Roles and the permission module, student profiles and instruments, consent records, **guardian accounts and the family area**, Teacher Studio shell, rosters with search, classes with recurrence and conflicts, calendar, **admin enrolment** with capacity and waitlist, attendance, a pasted meeting link | — |
| 2 | Class-wide assignments, assign from the player, timestamped feedback on recordings, Google Meet links created through Google Calendar, attendance read back from Meet, reminders by email | 1 |
| 3 | Practice events from the player (with consent), daily rollups, student weekly summary, teacher and admin reports with small-group suppression | 1, consent |
| 4 | Interest survey, guardian approvals for bands, band interest, explainable matching, band management | 1, 3 for availability and interests |
| 5 | Classroom page around the meeting (Meet opens beside it, see below), shared song position, deeper recommendations | 2 |

---

## 7. Third-party integrations

**Google Meet (chosen 2026-11-05).** The Google account that hosts lessons (decided per school or per
teacher when Phase 2 starts) connects to Rock Works with Google OAuth.

- **Creating the meeting.** The Google Calendar API creates the lesson as a calendar event with a Meet
  link: `conferenceData.createRequest` with `conferenceSolutionKey.type = "hangoutsMeet"` and
  `conferenceDataVersion=1`. The link is generated asynchronously, so the event is read back until its
  status says the link is ready. Google's notes from February 2026 say not to reuse Meet codes across
  events, so every occurrence gets its own conference. A bonus: the lesson lands in the teacher's
  Google Calendar.
- **Attendance.** The Google Meet REST API keeps a conference record per meeting, with each
  participant's first join and last leave and per-join sessions. Rock Works reads these after the
  lesson to propose attendance, which the teacher confirms or corrects. Join and leave events can also
  arrive live through the Workspace Events API and Pub/Sub, but reading after the lesson is simpler and
  enough. Participants who join without signing in show as anonymous, so matching them to students is
  only a suggestion.
- **To verify before building:** which OAuth scopes the Calendar and Meet calls need and whether any
  are "restricted" (restricted scopes need Google's app verification, which takes time); whether the
  Meet REST API needs a particular Google Workspace edition for the hosting account; and whether the
  school uses Workspace or personal Gmail accounts.
- **Video inside the website.** I found no Google SDK for embedding a Meet call in another website.
  Meet's add-ons SDK works the other way round, putting an app inside Meet. So the classroom page sits
  beside the Meet window: the lesson's agenda, song and loop, notes and assignments in Rock Works, the
  video in Meet. If a fully embedded call matters later, that would mean adding a provider with an
  embeddable SDK, such as Zoom's Meeting SDK, as a second adapter.
- **Sound for music.** I didn't find a documented music mode for Meet comparable to Zoom's "original
  sound for musicians". Meet's noise cancellation can be switched off. This needs testing with a real
  instrument before promising teachers anything about sound quality.
- **Costs.** The Google APIs are free within quota. Meeting length and participant limits depend on
  the hosting account's Google plan.

**Ensemble playing over the network.** Separate connections add tens to hundreds of milliseconds of
latency, so playing together in time over Zoom isn't realistic. Classes should support demonstrating
and taking turns. A shared song position means each student's own player jumps to the same bar; it
does not mean synchronised audio.

**No new paid services are needed for Phase 1.** Time zones use the built-in `Intl` API; recurrence
is a small in-house expander (weekly or monthly, materialised ahead), so no date library is added.

---

## 8. Privacy and security review

- **Guardians (Phase 1).** The admin sends an invite to the sponsor email recorded at signup; the
  guardian creates or uses an account and accepts, which creates a `GuardianLink`. A guardian sees
  their child's schedule, assignments and feedback, and gives or withdraws consents, but can't see other
  students or edit teacher notes. Links are made only by the admin's invite, never by a student or
  guardian searching for each other.
- **Minors.** Signup already records `isMinor`. Children under 13 bring COPPA into play for an online
  service: verifiable parental consent before collecting personal information from them. Hawaii also has
  a student online privacy law for K-12 operators. Both need a check with the school's lawyer before
  Phase 3 or 4 collects interests, analytics or band data from minors; Phase 1 collects nothing new from
  minors without a recorded consent.
- **Educational records.** Teacher notes, assessed levels, attendance and feedback are visible only to
  the student, their guardians, their linked teachers and admins. Never public.
- **Collect less.** Area is a free choice of region, never from IP. Age is a self-declared bracket. No
  background tracking: practice events are sent only from the player, only when a session ends, and
  only with consent.
- **Bands.** Matching runs within one age band (under 18 and adults kept separate). Introductions for
  minors go through a teacher, with guardian approval. No contact details are shown, and there's no
  direct messaging between students.
- **Small groups.** School reports hide any figure that comes from fewer than 5 students.
- **Tokens.** OAuth tokens encrypted at rest with a key from the environment; refresh tokens never
  sent to the browser.
- **Audit.** Role changes, enrolment, consent, exports and deletions write an `AuditEvent`.
- **Export and deletion.** A student (or guardian) can download their data and ask for deletion; the
  existing account deletion cascades to the new tables.
- **Abuse.** Rate limits on profile, class and webhook routes; every input validated on the server.

---

## 9. MVP recommendation

**Essential (Phase 1):** a teacher can see their students, look someone up, schedule a one-off or
weekly lesson or group class in their own time zone, paste a Meet link, cancel or move a single
session, take attendance, and see it all on a calendar. The admin grants roles and enrols students into
classes up to capacity (the rest wait). Students see their upcoming classes on the dashboard. A
guardian, invited by the admin, sees their child's classes and assignments and manages consents.

**Later:** Google Meet through the API, analytics, bands, the classroom page, messaging, invoices.

---

## 10. Testing and deployment

- Backend tests (`node --test`, as now) for every permission rule (a teacher can't see another
  teacher's student; a student can't read another student's class notes), for recurrence across the
  March and November daylight-saving changes in a zone that has them, and for conflict detection.
- Browser checks (headless Chrome, as for the player) for the Teacher Studio flows at desktop, tablet
  and phone widths, using throwaway local accounts.
- Each step ships behind its own migration, deployed to production only when you choose to.

---

## Phase 1 status (2026-11-06)

Built and tested locally, not yet committed or deployed:

- Migrations `20261106005947_phase1_roles_profiles_classes` (with backfill of teacher roles and
  signup instruments) and `teacher_student_notes`. Production still needs both; run them only when
  deploying. After `prisma migrate dev`, run `prisma generate`: Prisma 7 doesn't do it for you.
- API: `lib/roles.js`, `lib/zoned.js`, `lib/classes.js`, `lib/audit.js`,
  `routes/classes.routes.js`, `routes/people.routes.js`.
- Pages: Teacher Studio tabs (Assignments, Calendar, Classes, Students), `/admin/people`,
  `/admin/classes`, `/family`, `/family/accept`, the music profile on `/member/profile`, and
  "Your next classes" on the dashboard.
- Tests: `backend/test/phase1.test.js` (permissions, daylight saving, clashes, waitlists, guardians,
  consent) and a browser walk-through of the whole flow.

Left for later phases: weekly availability and time off for teachers (conflicts only check classes
today), messaging, notifications and reminders, and video provider integration.

## Decisions (2026-11-05)

1. **Guardians:** built in Phase 1, invited by the admin to the sponsor email.
2. **Enrolment:** only the admin adds students to classes. Teachers schedule classes and take attendance.
3. **Schools:** Rock Works only. Tables can gain a school later with one migration.
4. **Video:** Google Meet instead of Zoom, kept behind the provider interface. Whose Google account
   hosts lessons is still open and only needed for Phase 2.
