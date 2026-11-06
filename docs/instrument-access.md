# Instrument access

Each student learns and practises only the instrument the school has on file for them. The rules
live in `backend/src/lib/instrumentAccess.js` and are enforced by the API; the player only shows what
the API sends.

## The permission model

1. **Entitlement to the song comes first, unchanged.** A paid membership (`requirePaid`), then the
   term rules in `lib/termAccess.js`: a published, unlocked month in the student's group, a month they
   kept after it opened (`TermGrant`), or an assignment from a teacher who still teaches them. Songs in
   no term stay open to every paying member.
2. **The instrument then narrows what they get.** The authority is `User.instrument`, read through
   `canonicalInstrument()` (case and spaces don't matter; anything that isn't one of the six names is
   no instrument at all). Nothing in a request (query, body, headers, a saved setting) widens it. The
   instruments a student lists on their own profile (`InstrumentSkill`) are a description and never
   grant anything.
3. **Staff keep everything.** The admin and teachers get every stem, every chart part and every lesson
   video (staff can preview another instrument's videos with `?instrument=`), whatever their own
   profile says.
4. **No valid instrument, nothing instrument-specific.** `/songs/:id/tracks` answers 403 with
   `reason: "no_instrument"`, lesson videos are empty, saved mixers are refused, and the pages say to
   ask the school.

## The mapping

| Instrument (`User.instrument`) | Stem (`SongTrack.part`) | Chart | Lesson videos (`LessonVideo.instrument`) |
| --- | --- | --- | --- |
| Guitar | `Guitar` | the song's chord chart, guitar shapes (`SONG_GUITAR` in `frontend/lib/chords.js`) | `Guitar` |
| Piano | `Keys` (the recording's keyboard track, whichever keyboard plays it) | chord chart, keyboard voicings (`SONG_KEYS`) | `Piano` |
| Bass | `Bass` | `chart.parts.Bass` (tab) | `Bass` |
| Drums | `Drums` | `chart.parts.Drums` | `Drums` |
| Voice | `Vocals` | `chart.parts.Vocals` (melody guide; lyrics are never stored) | `Voice` |
| Ukulele | `Ukulele`, only where one was uploaded (none so far) | chord chart, ukulele shapes from the chord library | `Ukulele` |

- The guitar is never handed out in place of a missing ukulele stem, and no part stands in for another.
- **Shared, by design:** song metadata, and the chart's form and chords (`end`, `sections`: section
  names, bar times and chord names). Every part's chart is laid out on them, and they drive the
  bar-by-bar arrows, loops, count-in and metronome. Only the transcriptions in `chart.parts` and the
  voicings are instrument-specific.
- **Missing pieces are reported, not filled.** `available: { own, backing, chart }` comes with every
  student response. No stem for their instrument: they get the whole song as one mix and the other two
  modes are off, with the reason. No transcription yet: "The drum part for this song isn't written out
  yet". No backing band yet: their own stem alone.

## How the audio is delivered

Students are never sent another instrument's stem on its own. They get two tracks:

- **their own stem**, the original file, and
- **one backing band**: every other stem mixed into a single MP3 (`SongMix`, `without = "<their stem>"`).
  Without a stem of their own, the whole song as one mix (`without = ""`).

Whole song plays both, so it sounds exactly as before. The mixes are made ahead of time with ffmpeg by
`npm run songs:backing` (and at the end of `npm run songs:upload`), never while someone waits.

- **Level.** A mix is turned down only if it would clip (most summed stems do: Rain's mixes peak at
  1.4–2.2× full scale) and the gain is stored. The API sends `makeup = 1 / gain` and the player
  turns the backing band back up by that, so the balance against their own stem is the recording's.
- **Timing.** Mixes are written to a real file, not a pipe, so the MP3's gapless header lets decoders
  drop the encoder's padding. Checked in Chrome on Rain: the band-without-guitar lines up with the sum
  of the original stems at 0 samples of lag (−29 dB residual, the MP3 noise floor; one sample off is
  −17 dB).
- **Versioning.** Each mix records a fingerprint of the stems it came from, and its storage key
  includes it (`songs/<id>/mixes/<fingerprint>/without-guitar.mp3`). Replace a stem and the old mixes
  stop being served (students see "still being prepared") until `songs:backing` runs again.
- **Links.** Signed and short-lived, as before: 10 minutes for term songs, an hour otherwise.

## Saved settings and instrument changes

- A student's mixer (presets and resume state) only holds their own part and `Backing`, no mute or
  solo, focus on their own part, and it's stamped with their instrument. Anything else sent is dropped.
  Presets and resume state made for another instrument, or before this existed, are never restored.
- After enrolment (they've paid at some point, or are in a term or with a teacher) a student can't
  change their own instrument: `PATCH /auth/me` answers 403 `instrument_locked`. Before that, signup and
  onboarding choose it as before, from the six names only.
- A student asks for a change in Account settings (`POST /me/instrument-request`). It leaves a note in
  Admin → Messages ("Instrument change"); no email is sent.
- The admin changes it in Admin → Students (`PUT /admin/students/:id/instrument`). It's audited
  (`instrument.set`), takes effect on the next request, and clears the saved mixers in the student's
  resume states.
- A teacher can only set work for the student's own instrument; the assignment form fills it in.

## Trying it locally

Development can keep all song audio in a local folder instead of R2: set `MEDIA_DIR` (it's refused in
production). Files are served by `GET /media/<key>` with the same kind of signed, expiring links.

`npm run seed:fixtures -- --confirm <local database> --stems <folder of Rain's stems>` makes the test
accounts (all `@example.com`, one per instrument, one without an instrument, unpaid, outside the term,
kept-a-month, assigned-by-a-teacher, a teacher and an admin), a term with Rain in month 1, and a
"TEST FIXTURE: Tone Band" song of plain tones with no keys stem and only a bass chart. It refuses
databases that aren't on this machine, needs `MEDIA_DIR`, sends no email and takes no payment. The
password and account list go to `backend/.local/fixture-accounts.md` (gitignored).

## Deploying

1. Apply the migration to Neon: `20261106114609_song_mixes` (adds `SongMix`). Render's start command
   doesn't migrate, so run `npx prisma migrate deploy` against the production database first.
2. Make the mixes for the songs that have stems, from a machine with ffmpeg and the R2 settings:
   `npm run songs:backing` (or `-- --from <folder> --song <id>` to mix from the local stems). This only
   adds objects under `songs/<id>/mixes/` and `SongMix` rows; nothing existing is changed.
3. Deploy the backend, then the frontend. Until step 2 is done, students hear their own stem only and
   the other modes say the backing band is being prepared; staff are unaffected.
4. Students whose `User.instrument` isn't one of the six (older free-text entries) see the "ask the
   school" state. Admin → Students shows what's on file and sets it.

## Limits worth knowing

- **Links already handed out.** Before this change every entitled student was sent links to all five
  stems. R2 presigned links can't be revoked by the app: they lapse on their own within an hour (10
  minutes for term songs), or immediately only by rotating the R2 access key. Anything a student
  downloaded while it was allowed is theirs.
- **A link works for whoever holds it until it expires.** That's how presigned links work; the app
  checks the person when it issues one, not when it's used.
- **Bucket exposure isn't visible from the code.** Whether the R2 bucket has a public r2.dev address or
  a custom domain is set in the Cloudflare dashboard; it should be off.
- **"Direct" lesson videos are plain URLs.** A student is only ever sent their own instrument's, but a
  plain URL can't expire. Bunny Stream videos aren't playable yet (signed playback is unbuilt).
- **No member download area exists.** `Resource` rows are admin-only and have no instrument field; if
  they're ever shown to members they'll need one.
- **The homepage preview is public by design**: eight bars of Rain's chords, bass and drum parts, no
  audio.
- **The phone app wasn't changed.** It receives the same two tracks (its mixer shows "Backing" as a
  lane) but doesn't apply `makeup` yet, so the backing band plays about 4–8 dB quieter there until it
  does.
- **Practice tools are general, not song material.** The chord library still shows every instrument's
  shapes to every member.
- **Old mixes stay in storage** when stems are replaced; nothing deletes superseded mix files yet.
