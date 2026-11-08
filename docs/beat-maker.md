# The beat maker

`/tools/beats`, listed in the tools hub as **Beat Maker**. Built 2026-11-06 after Denny asked for "a
place for drum sampling … like EZdrummer but simpler, a lot of room for input, a sort of creative zone".

It is a drum kit you can play (pads, the computer keyboard, or an electronic kit, pad controller or keyboard over MIDI), a library of grooves and fills to start
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
| `voices.js` | Plays hits: a level per drum and a mute that only the beat's hits go through (the mix), overlap, voice limits, the hi-hat choke, round robins |
| `engine.js` | The AudioContext, the transport, the 25 ms scheduler (the metronome's ticker), the click, recording, `snapshot()` for the screen |
| `share.js`, `midi.js`, `storage.js` | Share links (`?beat=`), Standard MIDI Files, this browser's saved beats and settings |
| `midiInput.js` | Playing the kit over MIDI: which note plays which drum, how a velocity becomes a recording and a volume, and `MidiLink`, the connection (permission, devices coming and going) |
| `frontend/components/beats/` | The page: `BeatMaker` (layout, keys, the audio-clock frame loop), `Transport`, `PartTabs`, `StepGrid`, `PadKit`, `SongStrip`, four settings tabs, `MidiSection` and `useMidiInput`, one CSS module |
| `frontend/scripts/make-drum-kit.mjs` | Rebuilds the drum MP3s from the original recordings |

Unit tests sit beside the modules (`lib/drums/*.test.js`, 65 tests) and run with `npm test` in `frontend`.

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
- **MIDI in** (see below): an electronic kit, pad controller or keyboard plays the kit, with how hard you
  hit setting the recording and the volume.
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
  beat back. A damaged link opens what it can. **MIDI download:** the song (or the looped part, four
  times) as a type-0 file, General MIDI drums on channel 10, swing and crashes where they are heard.
- **The mix:** faders set a drum's level for everything. A mute only stops the beat's hits, so a drum
  muted to play along with still sounds when it is played by hand or over MIDI.

## MIDI in

Added 2026-11-07, because Denny asked for MIDI integration. Web MIDI only exists in Chrome, Edge, Firefox
and Chrome on Android (no Safari, nothing on an iPhone), and only on HTTPS, so the page says so where it
isn't there. The Kit tab has it, above the long list of drums.

- **Connecting.** Connect MIDI asks the browser (no sysex; Chrome now asks permission for all Web MIDI).
  Every input and every channel is listened to, because pads and keyboards send on channel 1 and drum
  modules on 10. Devices plugged in or pulled out while the page is open come and go by themselves. Nothing
  is opened until someone asks. After that a return visit reconnects by itself, but only if
  `navigator.permissions` already says granted, so opening the page never puts up a prompt. Disconnect, or
  leaving the page, closes the ports, because Windows lets only one program at a time use a device.
- **Which note plays what.** `DEFAULT_NOTES` is General MIDI's drum notes folded onto the 13 sounds, plus
  the notes Roland-style modules send for a rim or a cymbal's edge, so a kit's notes mostly work untouched;
  a pad controller's sixteen pads from note 36 all play something. Anything else is set on the page: it
  shows the last note played with a drum to choose, so you hit the pad, then pick. Those changes, and
  "Nothing" for a note to silence, are kept in this browser, and the MIDI download's own notes play back
  as the same drums.
- **How hard.** A velocity picks the recording: under 69 a ghost, 69–105 a hit, 106 up an accent, the
  midpoints between the velocities the download writes (46, 92, 120), so a file played back in records
  the same levels. The volume on top follows General MIDI's curve (velocity squared, 92 as 1), divided
  by how loud that recording already is (`layerDb` in `kit.js`, measured from the shipped MP3s). So
  loudness is one smooth line across the changes of recording: without it the kick, whose soft recordings
  are only 5.8 dB down rather than 12, would have got quieter as you hit harder at velocity 69. If the
  MP3s are ever rebuilt, measure `layerDb` again.
- **What counts as a note.** Note-on with velocity above 0, on any channel. Note-offs (including note-on
  at velocity 0, which is how many devices send them), clock, controllers and aftertouch are ignored. So
  the hi-hat pedal's position (CC 4) isn't read, since modules send the open or closed note themselves, and
  a grabbed cymbal doesn't choke (aftertouch).
- **Record** writes MIDI notes like any other, at the level the velocity chose. Ghost / Hit / Accent has no
  effect on them.
- **The first note on an untouched page.** A MIDI note isn't a user gesture, so it can't start audio on
  a page nobody has clicked since it loaded, which is what a return visit is. Those notes are dropped (booked
  on a clock that isn't moving, they would all sound at once when it started) and the console says to
  click anywhere. Arriving from another page of the site counts as touched: the first note sounds.
- **The screen.** Each note lights its drum, and a small MIDI lamp beside the transport shows a device is
  connected and blinks on every note. The last note has its own small store, so only its line redraws on
  a hit, not the whole page. No time is taken from the MIDI message's own timestamp: a note plays the
  moment it arrives.

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

**MIDI in (2026-11-07), with no MIDI hardware to hand.** On the real members' route in headless Chrome, a
stand-in device delivering real `MIDIMessageEvent`s through the page's own handlers, with the audio
instrumented (43 checks):

- Opening the page asks nothing and makes no AudioContext. Connect MIDI asks once, without sysex, names the
  device and shows the lamp; it is remembered.
- A snare note: one hit, booked within 2.1 ms, gain 1 at velocity 92, the drum and the lamp lit, the note
  shown. Velocities 30, 46, 68, 69, 92, 105, 106, 120, 127 each got exactly the gain on the curve, soft,
  normal and hard from different recordings (peaks 0.11, 0.51, 0.77); the output measured −25.2, −4.8 and
  −0.7 dB at velocities 30, 92, 127.
- Note-offs, velocity 0, clock, active sensing, controllers, aftertouch and pitch bend: no sound. Channels
  1 and 10 both play.
- Note 72 (no drum): silent, shown as Nothing. Choosing Crash saved it and it played; a standard note could
  be silenced; Reset the notes brought it back and left nothing saved.
- The hi-hat choke; Record writing an accent (velocity 120) and a ghost (30) on the grid, one Undo taking
  the pass back; every drum muted, the beat digital silence and a MIDI snare still −3.4 dB.
- Devices plugged in and pulled out, all of them gone (says so, lamp out), one plugged back. Disconnect
  closes the port and stops the notes; leaving the page closes it too.
- A return visit: reconnects with one request, no AudioContext, the page's first notes dropped and the note
  asking for a click shown, a click clearing it with nothing queued played, the next note sounding. Arriving
  from `/tools` by a link, the first note sounded. With permission gone, no prompt on opening.
- Chrome's real Web MIDI API (156), real permission: allowed, it connected and said no device is plugged in
  (0 inputs on this PC), and a return visit reconnected; refused, it said how to allow it. The `midi`
  permission in CDP has to be set with `sysex: true` for `requestMIDIAccess` to succeed.
- A browser without Web MIDI gets one sentence and no button. Six states (not connected, asking, refused,
  no device, connected with a note, no Web MIDI) at 390 and 1280 px in both worlds: no sideways scroll,
  every control at least 44 px, contrast passes, no console errors.
- 24 more unit tests (162 in all): the note map, the velocity curve for every drum and velocity, saved
  settings, the connection against a stand-in browser, and what a mute lets through.

Not checked: any real MIDI device, which is the point that matters most, so real note numbers from a real
module, how the velocity curve feels under the hands, a pad's real latency, and whether Windows lets the
browser share a device with another program. Firefox's MIDI prompt. Also: a person listening to the new kit
(Denny heard only the first one), real phones (iPhone Safari, Android Chrome), Firefox and Safari on a
desktop, Bluetooth output latency, a real sign-in (the member was simulated in the browser), very long
sessions.
