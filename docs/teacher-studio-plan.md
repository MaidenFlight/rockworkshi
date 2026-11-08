# Teacher Studio and Admin: planning, templates and the assessment inbox

Written 2026-11-08 on top of the weekly practice system (PRs #15 and #18). Priorities 1 to 3 below are
built on `feature/teacher-studio`. Priorities 4 to 8 are later phases and nothing in them exists yet.

## The shape of it

A **plan** is a teacher's working document. It can't reach a student, because students only ever read
`PracticeMonth` and `Assignment` rows, and a plan isn't either of those. Publishing makes one ordinary month
per student, so student pages, the phone app, takes, feedback and the review page need no changes.

| Table or column | What it's for |
|---|---|
| `MonthPlan` | A plan or a template (`kind`): song, weeks and tasks as JSON, `revision` for saves, `version` for snapshots |
| `MonthPlanStudent` | Who a plan is for, and what's different for each of them |
| `MonthPlanVersion` | The content at each publish, each apply and each save of a template |
| `PracticeMonth.planId`, `planVersion` | Which plan a month came from, and the version this student last took |
| `Assignment.planTaskId` | Which task of the plan a row came from |

The migration, `20261108100000_month_plans`, only adds tables and nullable columns.

## How changes work

A due date is kept as days after the first day, so a new start date moves them all.

A later change is a three-way comparison against the version this student last took. A field changes
only if the plan changed it **and** the student still has what the plan used to say. Anything else was
set for that student on purpose, so it stays and is reported. Order is handled apart, because taking one
task out renumbers the rest without changing them.

- Nothing reaches a student until the teacher has seen the impact and pressed Apply.
- If the picture has changed since they looked, like a student sending a take, the apply is refused.
- `Submission` rows are never written, and a task with takes is never removed.
- Editing a template makes a new version and stops there. Bringing that into a plan is one step; applying
  it to students is another.

## Permissions

- A plan or template belongs to the teacher who made it. Anyone else gets a 404, and that includes an
  admin who isn't its teacher. Teaching data isn't an admin view.
- Publishing and applying only reach students linked in `TeacherStudent`. Links and enrolment stay in
  Admin, so a class member who isn't linked is shown with the reason and left out.
- Someone who holds both teacher and admin uses both areas (the web guard used to allow only one).
- Students and guardians have no route to plans, overrides or drafts.

## Later phases

| Phase | Priority | Scope | Notes |
|---|---|---|---|
| 2 | 4. Feedback | Editable rubrics, reusable phrases, a "Your next step" field, feedback drafts published on purpose | Builds on `Submission.marks`, `notes` and `priorities`. A draft must stay hidden from the student, so it needs its own columns. No automatic grades. |
| 3 | 5. Student overview | Current work, submitted, reviewed and overdue, latest feedback, next priority, upcoming lessons, private lesson notes | Must say "not submitted", never imply no practice: browser-only takes and offline practice leave no record. Notes need their own table and access rules. |
| 4 | 6. Content readiness | Per song and instrument: audio and stems or backing, chart, instrument part, videos | Flags while planning and never blocks. Starts from `lib/instrumentAccess.js`. |
| 5 | 7. Deadlines and reminders | Extensions for one or several students, prepared reminders with a recipient list and exact preview, delivery log | Extensions can reuse this release's impact review. Sending is real email, respects guardian rules, and is never automatic. Needs Denny's approval before anything is sent. |
| 6 | 8. Preview and history | Read-only "see as this student" across the whole account, change history, archive instead of delete | The review page's "Delete this practice work" is still a hard delete behind a browser confirm until this phase. |

## Deploying this

Render and Netlify deploy on every push to master, and the API reads the new columns straight away. So
migration `20261108100000_month_plans` has to reach Neon **before** the merge, with Denny's yes.
