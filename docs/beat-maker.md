# The beat maker

`/tools/beats`, listed in the tools hub as **Beat Maker**. Built 2026-11-06 after Denny asked for "a
place for drum sampling … like EZdrummer but simpler, a lot of room for input, a sort of creative zone".

It is a drum kit you can play (pads, or the computer keyboard), a library of grooves and fills to start
from, a grid for writing your own, parts (Verse, Chorus, Fill…) strung into a song, recording what you
play into a part, and saving, sharing and MIDI export. Drummers practise with it; anyone else makes a
backing beat for their own instrument.

**Access: members only for now**, beside the piano (`app/tools/(members)/beats`). That was a default, not
Denny's decision: if it should be free like the tuner and metronome, move the folder out of `(members)`
and set `free: true` on its entry in `app/tools/page.js`.

## Where the code is

| | |
|---|---|
| `frontend/lib/drums/kit.js` | The 13 drums: names, keys (by physical key, `KeyboardEvent.code`), recordings per level, chokes, voice limits, GM notes |
| `beat.js` | The beat as plain data (tempo, meter, swing, one-bar parts, the song) and every edit, all pure; swing timing; `sanitizeBeat` for anything read back |
| `grooves.js` | 24 grooves and fills written out by hand (standard beats), and the example song a first visit opens on |
| `sequencer.js` | Turns a beat into timed events one step at a time (bars, steps, clicks, hits, end). Pure; reads the beat at every step so edits are heard at once |
| `samples.js` | Loads and decodes the recordings once per visit (see below) |
| `voices.js` | Plays hits: a gain per drum (the mix), overlap, voice limits, the hi-hat choke, round robins |
| `engine.js` | The AudioContext, the transport, the 25 ms scheduler (the metronome's ticker), the click, recording, `snapshot()` for the screen |
| `share.js`, `midi.js`, `storage.js` | Share links (`?beat=`), Standard MIDI Files, this browser's saved beats and settings |
| `frontend/components/beats/` | The page: `BeatMaker` (layout, keys, the audio-clock frame loop), `Transport`, `PartTabs`, `StepGrid`, `PadKit`, `SongStrip`, four settings tabs, one CSS module |
| `frontend/scripts/make-drum-kit.mjs` | Rebuilds the drum MP3s from the original recordings |

Unit tests sit beside the modules (`lib/drums/*.test.js`, 41 tests) and run with `npm test` in `frontend`.

## The drum sounds

**Source:** DRSKit, made by Jes Eiler of DRSDrums with the DrumGizmo team: one kick, a rack tom, two
floor toms and a snare, with Paiste cymbals (a Formula 602 hi-hat, a Giant Beat crash, and a Formula 602
thin crash played as the ride). It was recorded with 13 mics: a close mic on every drum (two each on the
kick and the snare, one on the hi-hat and one on the ride), a pair of overheads, and two room mics further
back. Every drum was recorded many times from soft to hard (the snare 49 times, the kick 22).
**Licence: CC BY 4.0** ([drumgizmo.org](https://drumgizmo.org/wiki/doku.php?id=kits:drskit)): free on a
paid site, with credit wherever credits are shown, so under the tool the page says: "Drum sounds: DRSKit by
Jes Eiler of DRSDrums and the DrumGizmo team, CC BY 4.0, mixed and shortened for this page."

**Why this kit** (2026-11-07): the first kit, Karoryfer Samples' "Big Rusty Drums" (CC0), sounded "ok, but
kind of basic" to Denny. It has close and overhead mics only, so it could only sound dry. Also looked at:
Naked Drums (CC BY 4.0; the GitHub copy has no kick, tom or cymbal files), SM Drums (public domain; one
2.2 GB download), MuldjordKit and CrocellKit (CC BY 4.0 metal kits; Muldjord has no side-stick, rimshot or
pedal hat, Crocell is a 5.5 GB download), Virtuosity Drums (CC0, a jazz kit), and Karoryfer's Swirly and
Unruly Drums (brushes; all snares). Free packs from commercial sample companies don't allow the sounds on
a website.

**What was downloaded** (with Denny's OK, 2026-11-07): 241 FLAC files, 26.8 MB, from the kit's SFZ edition
at [github.com/sfzinstruments/DrumGizmo.DRSKit](https://github.com/sfzinstruments/DrumGizmo.DRSKit), commit
`b014489`: for each hit used, that drum's close mics, both overheads and both room mics. Not the 719 MB
library, and not in this repository.

**What ships:** 45 MP3s in `frontend/public/samples/drums/`, 750 KiB, served from this site only:

| Drum | Recordings: soft / main / hard | Key |
|---|---|---|
| Kick | 2 / 3 / 2 | J |
| Snare | 2 / 3 / 2 | F |
| Rimshot | – / 2 / – (the snare's hardest hits with more of the top mic: the kit has no rimshots) | R |
| Side-stick | – / 2 / – | E |
| Closed hi-hat | 2 / 3 / 2 (the hard ones on the edge of the hat) | D |
| Open hi-hat | – / 2 / – | S |
| Hi-hat pedal | – / 2 / – | A |
| High tom (the rack tom), mid tom and floor tom (the two floor toms) | – / 2 / 1 each | K, L, ; |
| Crash | – / 1 / 1 | W |
| Ride | – / 2 / 1 | O |
| Ride bell | – / 2 / – | I |

A level a drum has no recording for plays its main one louder (+3 dB, accent) or softer (−11 dB, ghost).

**How they were made** (`node scripts/make-drum-kit.mjs <download folder>`; needs ffmpeg; reruns give
the same files byte for byte):

1. Each hit is mixed from its drum's close mics, the overheads and the room mics on one mixer for the
   whole kit: close mics at 0 dB (snare bottom −2, hi-hat −3, ride −4), overheads −3 (the left one a
   further −1.8 to match the right), rooms +4. The snare's bottom mic and the kick's back mic are
   polarity-flipped and lined up with their partners (0.4 and 2 ms): measured, each pair otherwise
   cancelled 3–5 dB of the drum's low end. The overheads are moved 1–4 ms earlier to line up with the
   drum's close mic: left as recorded, the snare's top mic and an overhead summed 8 dB weaker around
   200 Hz. The rooms stay 8–11 ms behind, which is the room. Close mics are panned from the drummer's
   seat (hi-hat and rack tom left, floor toms and ride right); overheads and rooms left and right as
   recorded.
2. Cut to a set length with a raised-cosine fade (crash 4.2 s, ride 3.2 s, open hat 2.6 s, toms 1.8–2.4 s,
   kick 0.9 s, snare up to 0.75 s: its recordings end after 0.4–0.7 s).
3. Round robins of one layer evened to the layer's mean loudness. Soft and hard layers keep their recorded
   distance (kick −5.9 / +2.7 dB, snare hard +2.9, closed hat soft −11.2, crash hard +4.1) except where it
   didn't suit: the snare's soft hits, a real soft stroke but only 6.7 dB down, are set to −12 dB for ghost
   notes; the hi-hat's edge hits to +5 (+10.7 as recorded); the toms' hardest to +3 (+1.2 to +1.6); the
   ride's to +4.
4. Each drum's level set against the snare by K-weighted loudness (loudest 400 ms): kick −1 dB, rimshot
   +1.5, toms −1, crash −4, open hat −4, closed hat −8, side-stick −8, ride −8, ride bell −8, pedal −11.
5. One gain for the whole kit (loudest peak −1.5 dBFS), then MP3, LAME VBR quality 4.

Measured against the first kit: the toms keep about 6 dB more of their sound after the first 150 ms; the
kick has more beater click (+5 dB above 5 kHz), rings longer (the drum itself: its close mics alone
measure the same) and, mono before, now has the room around it; the crash is brighter, and the ride darker
and washier (it is a thin crash played as a ride). The snare is shorter, as its recordings are.

Only Denny's first impression of the old kit has been heard; this one's balance was set by measurement.
The Kit tab's mixer lets anyone change it in their own browser, and the mixer and targets in the script
are where to change it for everyone.

## How it plays

- **No audio until a tap or key.** The recordings are fetched when the page opens and decoded in an
  `OfflineAudioContext` as each arrives (it needs no gesture), so the first pad already has its sound.
  The one `AudioContext` is made by the first click, tap or key anywhere on the page (for touch, the lift:
  phones allow audio only then). Once it exists, the same bytes are decoded again in it, in the
  background, so playback runs at the device's own rate instead of being resampled on the fly.
- **MP3 encoder silence** is skipped: each buffer's first sound is found and playback starts there.
- **Pads fire on `pointerdown`**, several at once with several fingers; Enter, Space or a screen reader
  activate a focused pad. Keys are physical positions, so the kit sits under the same fingers on any
  layout; the pads show what the key prints where the browser can say (Chrome, Edge). Shift plays an
  accent. Ghost / Hit / Accent above the pads sets how hard the pads, the keys and the grid play.
- **Overlap and limits:** hits ring over each other; a drum hit again keeps ringing until it has too many
  voices (2–4 by drum), then the oldest fades in 30 ms. A closed or pedalled hi-hat chokes an open one
  (12 ms fade). Sequenced hits vary ±0.6 dB, like a player.
- **The transport** loops the chosen part or plays the song (going round again, or stopping at the end
  and letting the last crash ring). Choosing another part while looping switches at the next bar line.
  Edits, tempo and swing are heard from the next step. A limiter at the end keeps stacked hits from
  clipping. Space plays and stops; Ctrl+Z / Ctrl+Shift+Z undo and redo.
- **Recording:** Record while stopped counts in one bar of clicks, then every note played lands on the
  nearest step of the part sounding when it was heard (allowing for output latency), late halves rolling
  into the next bar. A note recorded just before its step isn't played twice. One pass undoes as one.
- **Swing** (0–100) falls on the eighths or the sixteenths (Beat tab); 67 is a triplet feel. 12/8 and 6/8
  are written in triplets, so their shuffle is in the grid and the slider is off.
- **Saving:** the beat on screen is kept in this browser as you work; named beats (up to 50) are saved
  in this browser per person, like the metronome's presets. Nothing goes to the account yet.
- **Sharing:** "Copy a link" packs the whole beat (parts, song, tempo, name; never the mix or anything
  about the person) into `?beat=`. Opening one offers it before replacing anything; Undo brings the old
  beat back. A damaged link opens what it can. **MIDI:** the song (or the looped part, four times) as a
  type-0 file, General MIDI drums on channel 10, swing and crashes where they are heard.

## Checked, and not checked (2026-11-06)

Checked in headless Chrome over CDP (muted), with `AudioBufferSourceNode.start`, `setTargetAtTime` and
an AudioWorklet tap on the output recorded from before the page loaded:

- No AudioContext exists until the first input. The first mouse tap makes one and books the snare at
  once on its clock; the first sound reaches the output 5 ms after its start time. Making the context
  itself took about 120 ms in headless Chrome on this PC, a one-off on the very first tap.
- Later taps and keys: booked 1.5–3 ms after the event, on the current clock. Shift+F used the harder
  recording (peak 0.64 against 0.44). No measurable silence after the start offset (0.2 ms).
- Kick, snare and crash within 8 ms all rang together; the crash still sounded (−31 dB) a second later.
- An open hat measured −30 dB at 0.8–1.2 s on its own and −68 dB when a closed hat followed at 0.3 s.
- The looped Verse at 100 BPM landed every hit on the 150 ms grid exactly; after Stop the output read
  digital silence within 0.2 s.
- Record counted in and a crash played mid-bar was written into the part (13 → 14 notes).
- Phone (390×844, touch): the first touch sounded once the finger lifted; later touches 2.4 ms after
  touchdown; two fingers on two pads played both.
- Layout at 390 and 1280 px, Silkie and Classic, Grid and Pads: no sideways scroll, every control at
  least 44 × 44 px (including the 208 grid squares), no text under 4.5:1 (3:1 for large) against the
  ground it sits on, a visible focus ring on the grid (sea glass, 2 px, inset), arrows move it, Enter
  adds a note. No console errors or hydration warnings.
- On the real route as a paying member (the API's `/auth/me` answered inside the browser, so no account
  was made): the hub lists Beat Maker as Open with the new intro; the page loads behind sign-in; saving
  goes under that member's own key; a shared link is offered first and opens on request (tempo 100 → 92),
  then leaves the address bar; dragging along the crash row painted four notes and one Undo removed all
  four; Use in Verse loaded Punk at 180 BPM; Add put the Verse in the song and the block editor gave it a
  fifth bar; a muted snare was digital silence while the kick played at −4.5 dB; Download MIDI saved
  `smoke-test-punk.mid` (a valid MThd file); after a reload the beat and the saved list came back.
- 41 unit tests: swing positions, meters and remapping, every edit and the song, sanitising damaged
  beats, every groove's rows, the sequencer's timing, clicks, count-in, crashes, song end and loop, bar-line
  part switching, recording quantise and its edge cases, finding a buffer's first sound, share links,
  MIDI bytes, and that every recording the kit names is shipped (and nothing else), under 1 MB.
- `npm test` (all 138 frontend tests), ESLint on every new and changed file, and `next build`.

Again with the DRSKit sounds (2026-11-07), the same way: all 45 recordings load; keys booked 1.4–2.4 ms
after the event; Shift+F plays the harder snare (peak 0.77 against 0.52); kick, snare and crash ring
together (the crash −32 dB a second later); the open hat −26.6 dB on its own and digital silence once a
closed hat follows; the Verse loop on the grid at 100 BPM, silence after Stop; Record 13 → 14 notes;
phone touches, two fingers; and the member-route run above (drag and Undo, Punk at 180, the song editor,
a muted snare silent while the kick plays at −5.1 dB, MIDI, reload). The very first tap in a freshly
started test browser took 0.5–0.6 s before it sounded: all of it inside `new AudioContext()`, Windows
opening the audio device (the same call on a blank page: 46–570 ms; on later pages 46–50 ms; the beat
maker's own part, 5 ms). Tests, ESLint and `next build` pass.

Not checked: a person listening to the new kit (Denny heard only the first one), real phones (iPhone
Safari, Android Chrome), Firefox and Safari on a desktop, Bluetooth output latency, a real sign-in (the
member was simulated in the browser), very long sessions.
