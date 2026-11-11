---
name: Rock Works School of Music
description: A Honolulu rock school dressed as a 1950s Hawaiian silkie — lacquer, flare red, and condensed signage type.
colors:
  ink: "#16121c"
  ink-deep: "#0c0910"
  page: "#eef0ec"
  surface: "#f8faf6"
  label-stock: "#f2e7cb"
  rule: "#cdd3c9"
  border: "#d8ddd4"
  line: "#b9c1b5"
  flare: "#ff2d55"
  flare-action: "#c2143c"
  flare-ink: "#96082c"
  flare-wash: "#ffe8ec"
  lagoon: "#0c735d"
  gold: "#ffc93c"
  sea-glass: "#5ce1c6"
  meta: "#5d6459"
  body: "#4a5147"
  body-cool: "#46514c"
  prose: "#2b312a"
  white: "#ffffff"
typography:
  poster:
    fontFamily: "Big Shoulders Display, Haettenschweiler, Arial Narrow, sans-serif"
    fontSize: "clamp(58px, 11.5vw, 158px)"
    fontWeight: 800
    lineHeight: 0.85
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Big Shoulders Display, Haettenschweiler, Arial Narrow, sans-serif"
    fontSize: "clamp(44px, 7vw, 104px)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Big Shoulders Display, Haettenschweiler, Arial Narrow, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.01em"
  lead:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "18.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  caption:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  none: "0"
  sm: "3px"
  field: "3px"
  md: "4px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "44px"
  "8": "64px"
components:
  button-primary:
    backgroundColor: "{colors.flare-action}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "15px 32px"
  button-field:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    rounded: "{rounded.sm}"
    padding: "15px 32px"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "15px 32px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "4px 0 6px"
  tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "26px 22px 24px"
  field:
    backgroundColor: "{colors.flare}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "76px 24px 92px"
  border-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    rounded: "{rounded.none}"
    padding: "0 24px 54px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
---

# Design System: Rock Works School of Music

## Overview

**Creative North Star: "The 1950s Hawaiian silkie — the tailored, saturated, collector-grade shirt, not the souvenir rack."**

Rock Works is a music school in Honolulu, teaching since 1982. The site does two jobs: it convinces a prospective student to join, and it delivers the paid member area afterwards. This system serves the first. Its reader is a teenager who wants to look like a musician.

The world is a printed garment. A silkie is built from a saturated ground, a repeating motif field, and an engineered border band at the hem where the print concentrates and the object states what it is. The site is that object: a **field**, a **border band**, and **label stock** wherever something has to be read. *Blue Hawaii*, 1961, is the hinge that makes this rock and roll rather than tourism — the one place old-school rock and Hawaii genuinely meet, which is what PRODUCT.md's binding constraint asks for in the owner's own words: "make it look cool to rockers, but give it a hawaiian vibe."

This system replaced its predecessor wholesale on 2026-08-28. That world was cream ground, high-contrast slab serif, one warm orange, a generic look that had nothing to do with the subject, and it produced a page with no loud element anywhere on it: the largest, brightest thing on a homepage selling rock and roll was a small button. The replacement's first obligation is energy.

**Key Characteristics:**

- **Three grounds, three jobs.** Flare field for the loud moments, lacquer for the bands, label stock for anything anyone reads.
- **Two faces, sharply divided.** Condensed signage type shouts, Franklin Gothic reads. Neither does the other's job.
- **Surface or ink.** Every accent is one or the other, decided by measurement rather than taste.
- **Corners, not curves.** A printed label and a signage panel have edges; radii top out at 4px.
- **Two worlds ship.** The previous design is preserved and switchable.

## Colors

The strategy is **committed**: one saturated colour owns whole regions rather than accenting a neutral ground. Flare covers the homepage's closing viewport outright. The opening viewport became a lit stage on 2026-11-05, at the user's direction: lacquer, with flare kept as the glow off the stage floor (see Stage under Components).

### Grounds

- **Lacquer** (`#16121c`) and **Lacquer Deep** (`#0c0910`): the dark grounds and all primary text. Black with plum in it, because a warm-shifted black reads as finished surface — sprayed and buffed — where a neutral black reads as absence.
- **Page** (`#eef0ec`): the page itself, deliberately cool. A warm off-white would have left the old world's most recognisable trait in place while claiming a redesign.
- **Surface** (`#f8faf6`): panels sitting on the page.
- **Label Stock** (`#f2e7cb`): the alternate band — warm where the page is cool, because it is the woven tag sewn into the garment. Every text role clears 4.5:1 on it: ink 15.01, lagoon 4.71, meta 4.97, flare-ink 7.21.

### Accents

- **Flare** (`#ff2d55`): a **surface**, never an ink. Large areas and display type at 40px and up. White on it is 3.65:1, which clears the large-text floor and nothing else, and that constraint is the point.
- **Flare Action** (`#c2143c`): the button fill. White on it is 6.07:1 at rest, 5.73:1 under the hover's 4% brightening.
- **Flare Ink** (`#96082c`): all red **text** — links in running text, tag calls to action, small labels. 7.73:1 on the page.
- **Lagoon** (`#0c735d`): the Hawaii note and the cool counterweight. Section labels and the focus ring.
- **Gold** (`#ffc93c`) and **Sea Glass** (`#5ce1c6`): the dark-ground accents, 12.02:1 and 12.28:1 on lacquer.

### Text tones

**Meta** (`#5d6459`, 12.5px captions), **Body** (`#4a5147`), **Body Cool** (`#46514c`), **Prose** (`#2b312a`, long-form).

**White** (`#ffffff`) is a token because the system genuinely uses it, in exactly two places and nowhere else: as type on a dark ground, and as an input’s field. It is not a ground and never a page background — see The No-Grey Rule.

### Named rules

**The Surface-or-Ink Rule.** Every accent is one or the other and they are not interchangeable. If a colour sits *behind* white it is a surface; if the colour *is* the letterform at reading size it is an ink. Display numerals at 24px and up are the one exception, where the large-text floor is 3:1 and Flare Action clears it at 4.76:1. This is why there are three reds and not one; collapsing them reintroduces a failure this project has already paid for twice.

**The Lagoon Squeeze.** Lagoon is the only token doing two jobs with opposing contrast needs: as label text it must clear 4.5:1 on the *darkest* paper it lands on, which is Label Stock and not the page; as the focus ring it must clear 3:1 on the dark grounds. At `#0c735d` those measure 4.62:1 and 3.19:1. Both ends are live — darkening Lacquer breaks the ring as surely as darkening Lagoon does.

**The Hover Counts Rule.** Contrast is checked in the state a control is *used* in, not only the state it is read in. `.rw-cta` brightens 4% on hover, and a previous palette passed at rest while failing at 3.31:1 under the pointer. Any new fill is measured both ways before it ships.

**The No-Grey Rule.** There is no neutral grey in this palette. Darks carry plum, lights carry green, the label stock carries yellow. `#fff` appears only as type on a dark ground and as an input's field.

## Typography

**Display:** Big Shoulders Display (with Haettenschweiler, Arial Narrow)
**Body:** Libre Franklin (with system-ui)

Both self-hosted from `app/fonts` as latin-subset woff2; the build must never depend on reaching a font CDN.

Big Shoulders is a condensed American signage face, built to be read tall and loud at distance. Libre Franklin descends from Franklin Gothic — the American newspaper and poster workhorse, and therefore the right company for a signage face. It has no opinion at 15px, which is the job.

### Hierarchy

- **Poster** (Big Shoulders 800, `clamp(58px, 11.5vw, 158px)`, `-0.03em`, uppercase): the homepage's stage and closing field only. Line height goes under 1 because condensed caps have short extenders and the stack should read as one block of lettering.
- **Display** (Big Shoulders 800, `clamp(44px, 7vw, 104px)`, uppercase): page headers.
- **Headline** (Big Shoulders 800, 32px, uppercase): section and sub-section headings.
- **Tag title** (Big Shoulders 800, 26px, uppercase): panel headings.
- **Lead** (Libre Franklin 400, 18.5px/1.55): the standfirst under a heading, and the statement lines in the proof band.
- **Body** (Libre Franklin 400, 15px/1.6): the default.
- **Prose** (Libre Franklin 400, 16.5px/1.7): long-form pages.
- **Caption** (Libre Franklin, 12.5px): meta and labels.

### The scale

Ten steps and no eleventh: 11 · 12.5 · 13.5 · 15 · 16.5 · 18.5 · 22 · 26 · 32 · 44px. The half-points are real — measured off built pages, not rounded to a theory. The scale survived the redesign unchanged because it was never the thing that was broken.

### Named rules

**The Signage Face Shouts Rule.** Big Shoulders sets headings, numerals, labels and buttons. It never sets a paragraph. Condensed type is built for distance, and asking it to carry five full sentences is asking a poster to be a paragraph — it fatigues immediately. The proof band was built that way once and had to be undone.

**The Twenty-First Size Rule.** The scale has ten steps. If a new design needs a *fixed* size that isn't in it, the answer is almost always the nearest existing step, not a new token.

**The Fluid Endpoint Exception.** Text set in `clamp()` may use endpoints that are not on the scale; fixed sizes may not. Confirmed by the owner on 2026-08-27. A clamp's two numbers are the ends of a range rather than sizes anyone chose — at most window widths the text renders at neither — so holding them to a ten-step scale constrains a value nobody reads. What it does not license is reaching for `clamp()` to dodge the scale: type that does not need to grow with the viewport is a fixed size and the ten steps apply. The sanctioned fluid roles are listed below and the list is the safeguard: if it is not on it, it is a fixed size.

| Role | Selector | Range |
|---|---|---|
| Poster | `.rw-poster` | 58 → 158px |
| Poster (ask) | `.rw-poster-ask` | 42 → 92px |
| Display | `PageHero` title | 44 → 104px |
| Band promise numeral | `.rw-promise-n` | 96 → 200px |
| Band promise headline | `.rw-promise-head` | 32 → 60px |
| Level numerals | `.rw-level-n` | 56 → 92px |
| Tracklist numerals | `.rw-track-n` | 48 → 84px |
| Price figure | `.rw-price-figure` | 44 → 68px |
| Record lead | `.rw-record-lead` | 25 → 38px |
| Empty-state lead | `.rw-empty-lead` | 28 → 44px |
| Metronome tempo | `.tempoValue` (metronome module) | 88 → 136px |
| Metronome focus tempo | `.console[data-size="focus"] .tempoValue` | 120 → 280px |
| Player focus: chord to play now | `.rw-play-along-stage .rw-chord-name` | 88 → 220px |
| Player focus: next chord | `.rw-play-along-stage [data-role="next"] .rw-chord-name` | 56 → 120px |

**The list drifted once already, which is the thing to watch.** It was written naming four roles and the stylesheet reached ten without the sentence changing — every addition individually defensible, none of them checked against the rule that was supposed to bound them. That is precisely the quiet widening the exception exists to prevent, so adding a fluid role means adding a row here in the same commit.

**The 0.22em Rule.** Small uppercase labels are tracked at `0.22em`, and it is a signature rather than a coincidence. Poster and display type track *negative* (`-0.03em`): the direction reverses with size.

## Layout

Three measures do the entire site: **1200px** wide grid, **900px** reading column, **520px** forms. Every container carries 24px of side padding at every width.

**Page headers are left-aligned.** A centred banner over a centred intro is the arrangement every school site ships, and condensed poster type needs a left edge to push against — centring it wastes the one thing the face is good at.

Breakpoints: **940px** (nav collapses to the drawer), **860px** (multi-column grids collapse, the CTA watermark hides), **720px**, **560px** (six-up grids go two-up).

**The Three Grounds Rule.** Every section is a field, a border band, or label stock. The homepage runs stage → band → lacquer → label → label → sand → field, and no two adjacent sections share a topology. An arrangement that is none of the three is a sign the section has not been designed yet. The stage is the one exception, a lit lacquer ground rather than a field. Since 2026-11-05 it sits directly on the border band, and both are dark: the wave cut against the floor glow is what separates them, so the glow must never be removed on its own.

**The Field Is Rationed Rule.** The flare field belongs to the homepage's closing viewport; the opening is the stage. Inner pages get lacquer headers with a flare *rule* instead. If all nineteen routes opened on full red, the homepage would stop being the loud one and the site would be back to every band looking alike — the fault this system was built to fix.

## Elevation & Depth

Depth is nearly absent by design: this is printed matter, and printed matter does not float. There is exactly one shadow.

- **Card lift** (`0 22px 44px -22px rgba(90, 40, 70, 0.45)`): hover only, warm-tinted, with a real offset and a soft blur.

Separation is carried by ground changes and 1px edges instead. A resting surface never gets a shadow to make it feel separated.

Motion is short and few: `0.16s ease` for colour and border changes, `0.18s ease` for transform and filter, `0.2s ease` for the instrument marks' accent. Interactive lifts run `translateY(-2px)` to `translateY(-5px)`. Everything transform-based is disabled under `prefers-reduced-motion`.

**The one authored moment is the stage's opening** (about 4.4s, then still). The floor glow comes up, then each lamp fades in and sweeps to its mark, the left one crossing behind the headline on its way. Only opacity and rotation animate, and nothing is blurred. The settled lights are the base style and the sequence only plays into them, so reduced motion, phones and tablets get the finished composition at once. It is gated on `(hover: hover) and (pointer: fine)`, not on width, because a query that flips (a phone turned sideways, a window resized) would start it again. It is CSS on server-rendered markup, so a re-render never replays it. It never loops.

## Shapes

**The wave.** The signature edge — a single cubic (`M0,40 C360,80 1080,0 1440,40`) drawn as a positioned SVG so a band can carry one at its top, foot or both; the top copy is flipped on Y. It is the one shape the system reuses everywhere, and it survived the redesign with a changed job: it was the seam between dark bands and paper, and it is now the seam where the print stops.

**Radii are small.** 3px buttons and fields, 4px panels, 999px for the auth submit pill only. Tags are square. A printed garment label and a signage panel have corners; rounding everything was the friendly-SaaS reflex the previous world never questioned.

**The No Accent Border On A Radius Rule.** A thick coloured rule curving around a corner reads as a mistake at every size. When the two conflict the corner goes: the tag's 5px flare rule is why tags are square.

## Components

- **Button** — five variants. `primary` (Flare Action, white), `field` (Lacquer, for use on the flare ground, because red on red is not a button), `secondary` (white, ink, 1px line), `danger` (secondary with flare-ink text), `quiet` (a text link with a 1.5px underline). Sizes md `15px 32px`, sm `10px 18px`, xs `7px 12px`. Solid variants lift 2px and brighten 4% on hover; `quiet` does not lift, because a text link rising off its own underline reads as a glitch.
- **Tag** — the replacement for a row of equal rounded cards. Label stock, 1px edge, square, and a 5px flare rule across the top where a sewn tag carries its band of colour. The rule is what makes a row read as one set rather than three boxes. `.rw-tag-link` makes the whole panel the target.
- **Field** — full-bleed flare carrying the motif repeat and poster type. Type on it is lacquer, never white.
- **Stage** — the homepage's opening, a stylised concert bill. Lacquer, with two spotlight beams: narrow conic wedges (12–14°) from lamps just above the upper corners. Each is brightest where it enters and fades with distance, so it reads as one shaft with a clear direction. They pass each other right of the headline without pooling. The only haze is a thin veil under each lamp, decided 2026-11-06 after a broad glow muddied the middle. A flare glow rises off the floor and the wave cuts across it. Poster type in warm white with the last line in gold, then the lead (a fluid 18.5–22px over 44ch, so it reads as the headline's second voice), then two actions: membership as `primary`, the trial outlined in warm white. Below them is the venue line ("Honolulu · Est. 1982"), at the foot as on a bill rather than as a label above the headline. No motif repeat, because it fought the lighting. Every class is `rw-stage-*`. The headline and the padding also scale with the window's height (`min(11.5vw, 17svh)`), so both actions clear the fold on a 1280×720 laptop. Measured through the whole opening sequence: headline ≥10.1:1, gold line ≥10:1, lead ≥11.7:1; on phones, ≥8.1:1.
- **Border band** — lacquer, setting the two offers side by side under the stage: both products named, the price, and text links into each. It used buttons until 2026-11-06; the stage carries those now, so the band doesn't repeat them. A console-edge hairline divides the columns, and the labels are `h2`s.
- **Page header** — lacquer, left-aligned, flare rule, poster-scale title, 54ch lead, wave at the foot. No label above the title (decided 2026-11-05): the labels repeated the menu group and disagreed with it. A header with nothing under its title is shorter (`heroBare`), so a phone's first screen isn't mostly empty lacquer. Classic hides the rule.
- **Nav** — sticky, lacquer at 90% with a 14px backdrop blur, gold active link with a 2px inset underline, chrome wordmark. Seven `--rw-nav-*` tokens so it inverts with the world. Links are padded `10px 9px` (`.rw-nav-link`, since 2026-11-06): the row is capped at 1200px, and at the old 14px a side the visitor's header no longer fit on one line once the Demo tab joined it. At 9px it fits with 26px to spare (69px under Classic). A further top-level link needs that room checked again.
- **Instrument marks** — six drawn SVGs, butt caps and miter joins, one accent per mark placed where the sound comes out. The flat terminals were chosen to match the display face's blunt terminals; Big Shoulders shares that trait, so the rationale survived the type change.
- **The motif repeat** — the six marks tiled behind the closing field at ≤9% opacity (the stage has none). Decoration only, `aria-hidden`, and it never carries meaning the copy does not also carry.
- **Skip link** — first focusable element, solid Flare Action, off-canvas until focused, targeting `#main` which carries `tabIndex={-1}`. Styled on `:focus`, **not** `:focus-visible`: focus-visible is a heuristic, and a skip link the heuristic declines to reveal is a control that silently does not exist.
- **World switch** — a two-option radiogroup in the footer writing `data-world` on `<html>`.
- **Footer** — the full footer (mark, tagline, social links, the Explore and Visit columns, the world switch) on every public page. Inside the student area (`/member/*`) it is one slim row instead (`.rw-foot-slim`, since 2026-11-06): the copyright, FAQ · Contact · Terms · Privacy (44px targets) and the world switch, so the practice room isn't framed by the school's site map. Same lacquer and link colours as the full footer.
- **Student demo** (added 2026-11-06) — a **Demo** tab in the visitor's header (before Sign In) opens `/demo`: a page header, then the passcode in the site's form panel (flare-ruled, 520px). The right passcode turns the page into the choice itself (since 2026-11-06): the page header goes, and "Choose your instrument" is set like the dashboard's title (44px, 32px on a phone) over one short line, so the cards sit in the first screen. The cards are the instruments the demo offers (Guitar, Bass and Drums for now, one row on a desktop), the homepage's photo cards rebuilt as buttons: photo, name in the display face, one body line on what that student gets, then the action in flare ink with an arrow along the foot of every card, "Explore bass", or "Continue guitar demo" on the current one (edged in lagoon and marked Current). Nothing else links back to the demo. Below 560px they go one a row with a 2:1 photo so the choice stays a few swipes long. While a passcode is set, the sign-in card ends on a short "Have a demo passcode?" with a full-width `secondary` Button to the Demo tab. In the demo, a label-stock band runs under the header on every page: a 4px flare rule on top, "Student demo · Guitar" as a 0.22em small-caps label in flare ink, then "Explore with sample data. Nothing is booked, charged or sent to a real teacher, and changes reset when you leave.", then `secondary` "Change instrument" (back to `/demo`) and "Leave demo", both 44px. The band scrolls away, so the header's account button carries a square "Student demo" chip in flare ink. Measured on label stock: sentence 6.67:1 and label 7.21:1 (Classic 4.93:1 and 5.06:1). The demo's practice player is the full mixer (a strip per stem, as staff have it, since 2026-11-06), but it keeps a student's "Your instrument" line and that instrument's chart with no part tabs. Global classes are `rw-demo-*`; the page's own are in `app/demo/demo.module.css`.
- **Monthly checklist** (added 2026-11-06) — the teacher's work on the student dashboard, a month at a time, under the practice panel (and kept right under it on a phone by its `.rw-dash-work` wrapper). The month in the display face ("November tasks") with "3 of 7 sent" at the right, a 4px Lagoon bar that measures it, the song named once when the month is all one song, then a row per task in the order it was set: a drawn 20px mark for its state (a note in Meta to practise, a clock in Flare Ink while the teacher has it, a reply bubble in Lagoon once they've answered; since 2026-11-06, never a box, because the practice panel's Today list above it has real checkboxes), the section in bold ink, one meta line of sends and replies ("Sent twice, last Nov 4 · Brian replied Nov 5"; dates kept whole with no-break spaces), the status pill, and a chevron that says the row opens (it darkens and steps 2px right on hover). The pill says in words what the mark shows, so colour and shape are never the only sign. The task on the practice panel is edged in Flare Ink and carries a square "Today" chip (Flare Ink on Label Stock, 0.22em caps). Earlier months fold into a `<details>`. When the list is under 480px wide (a container query), the tags go under the task, lined up with it. Each row opens the task's page, which lists every attempt newest first with the teacher's reply and sends it again at any time. Classes are in `components/member/MonthlyChecklist.module.css`.
- **Planning a month** (added 2026-11-07, moved onto saved plans 2026-11-08) — Teacher Studio pages (`/teacher/plans/new`, then `/teacher/plans/[id]`; a published student's own month is still `/teacher/months/[id]`) in the Studio's own panels and fields. A song and a start date suggest four weeks from the song's chart, and nothing reaches the student until "Review and publish". On a desktop the weeks fill the left and Details, Who it's for and Individual changes sit in a 280–360px column at the right; below 940px they stack under the weeks. Each week is a surface panel: "Week 1" in the display face beside its editable name, then Milestones as plain white rows and the Weekly assessment as a square sewn tag (a 4px flare rule across the top on label stock), so the week's big piece of work reads apart from the small ones without a word. Each row says what the task asks for in one meta line ("Audio · Guide me · 80% speed · due Nov 8", dates kept whole); Edit opens its fields in place, so the week stays in view. On the review page each criterion gets three square tiles (Got it, Getting there, Work on this) where the chosen tile takes label stock, an ink edge and a 4px flare band at its foot, as the chart's help modes do. All controls are 44px. Classes are in `components/teacher/Month.module.css`.
- **Decision panels** (added 2026-11-08) — anything that reaches students stops at a tag first: Publish this month, Review changes for students, a template's changes, Save as a template, and the single-task "Review this change" on a student's month. Label stock, 1px edge, square, 5px flare rule, in the flow of the page (not a modal, so it works the same on a phone), and focus moves to its heading. It says who is affected and what happens, in words, then one primary key naming the count ("Publish to 3 students", "Apply to 2 students") and a way out. A student's own setting that a change leaves alone is said too ("Kai's own target speed stays: 60%"). Classes are in `components/teacher/Plans.module.css`.
- **The inbox** (added 2026-11-08) — `/teacher/inbox`, one queue of submitted assessments, the longest wait first, in rows that are whole links on surface panels. Bold name and instrument, the song and task, when it was sent and how long it has waited, what was sent against what was asked. At the right, chips say First submission or "Resubmission, attempt 2", "Audio instead of video" and Waiting or Reviewed, so nothing depends on colour. Filters are selects that keep their place in the address. Waiting, Reviewed and Milestones are tabs in the Studio's own tab style. Opened from here, an assessment has a bar across its top with the way back, "2 of 3 waiting" and the next one as a primary key ("Next: Mia Tanaka, week 1"), repeated under the feedback once it's sent.
- **The month by week** (added 2026-11-07) — on the student dashboard, under the practice panel, when the teacher has planned a month (`components/member/WeeklyMonth.js`, on the monthly checklist's own rows). The song in the display face with "3 of 15 done" and the 4px Lagoon bar, the teacher's priorities on label stock, then "Still to practise" naming the milestones with nothing saved, up to this week. Each week is a `<details>` that opens on the current one: "Week 2" in the display face at 26px, its name, a square "This week" chip, and "1 of 4 done · due Nov 15" at the right. Inside, "Milestones" are the plain rows and "Weekly assessment" is the sewn tag (label stock, 4px flare rule, square), each row saying what it asks for, then what's happened. A tick marks a saved milestone; the pills say Saved, Not submitted, Submitted, Reviewed in words. A row says when a take is waiting in this browser. Work set outside a month follows as "Other tasks". The practice panel picks this week's next open task. The student demo opens on a month that began 16 days ago, so a visitor lands in week 3 with two weeks of marked work behind them. None of its sample work has a recording, because nobody played it, and each attempt says "the recording isn't part of the demo". Since 2026-11-11 the small practice takes are called milestones wherever anyone reads about them (the code's kind is still `checkpoint`), and a weekly task's page carries one line for its level's video under the instructions: a play mark in Lagoon, then "The Level 1 · Sing-a-long video for this song is coming soon." or "…is ready." with "Watch it with the song" in flare ink (`components/member/LevelVideo.js`). It says nothing when the videos can't be checked.

**The Focus Ring Rule.** A 2px Lagoon outline at 2px offset on every interactive element, form fields included. The skip link is the only element that uses `:focus` instead of `:focus-visible`. The stage's actions use Sea Glass at 3px offset instead: under the lamps, Lagoon's 3.19:1 on lacquer has no margin left (see The Lagoon Squeeze).

**The One Name Rule.** `globals.css` is shared by every route, so a class name means one thing site-wide. The practice console once reused `.rw-field`, `.rw-timeline` and `.rw-record`, and in production that turned the homepage field white and painted the History page as a dark console. Console classes now stay inside their own vocabulary (`rw-console-*`, `rw-tl-*`, `rw-recorder`, …). Before adding a top-level class, search the stylesheet and the components for the name.

**Two Button Treatments, Not Three.** The `Button` primitive and the auth submit (pill, gradient, glow) coexist deliberately. They must not multiply into a third.

## Do's and Don'ts

### Do

- **Do** reach for an existing token. The palette, the ten-step scale, the 8px spacing scale and the three measures are all named.
- **Do** decide surface-or-ink before picking a red.
- **Do** measure a new fill against white in both its resting and hovered states.
- **Do** end a dark band on the wave.
- **Do** keep the display face out of paragraphs.
- **Do** give a new section one of the three grounds.
- **Do** track small uppercase labels at `0.22em` and poster type at `-0.03em`.

### Don't

- **Don't** set body copy, labels or buttons in Big Shoulders.
- **Don't** put white text on Flare — it is 3.65:1 and clears large text only.
- **Don't** introduce a neutral grey or a pure-white page ground.
- **Don't** open an inner page on a full flare field.
- **Don't** put a thick accent border on a rounded element.
- **Don't** hardcode a colour, radius or size a token already names — this redesign found 23 inline radii that had silently missed two system changes.
- **Don't** give a resting surface a shadow to make it feel separated.
- **Don't** draw a second wave shape, or a second chrome object. Chrome belongs to the wordmark alone; a page with two chrome objects has none.
- **Don't** let this drift toward **generic SaaS** — purple gradients, glassmorphism, floating cards on white. Confirmed rejection.
- **Don't** let it drift toward a **kids' learning app** — bubble corners, cartoon mascots, confetti, badges. The reader wants to look like a musician. Confirmed rejection.
- **Don't** let the Hawaiian half become **tourist clip-art** — hibiscus borders, tiki lettering, palm silhouettes. The island shows up as the wave, the light, the palette and the silkie's own structure, never as decoration. Confirmed rejection.

## The two worlds

Two complete designs ship. `data-world="classic"` on `<html>` switches the site to the previous design; the default is the Silkie described above.

The mechanism is worth protecting: **every token name is shared between the worlds**, so all 48 routes change appearance without one of them knowing a second world exists. A blocking inline script applies the stored choice before first paint, and the footer switch persists it per browser.

Two consequences bind new work:

1. **A value written as a literal cannot switch.** Every world-specific colour must come from a token. This has been caught twice: a hardcoded lacquer nav left Classic's wordmark at 1.15:1, and a hardcoded stitch rule painted the wrong hue under Classic.
2. **Structural changes serve both worlds** unless overridden. Shared components carry `[data-world="classic"]` overrides restoring the old composition. Only the homepage forks outright, because only its structure changed beyond recovery; forking every page doubles the DOM and every future edit with it.

Classic runs the **audited** palette, not the values it originally launched with. Switching design must never switch accessibility off.

## The practice console

The member song player (`StemPlayer`) is an Operate surface and runs on its own composition: a **lacquer console** for the transport, the multitrack timeline and the studio (mixer, recorder, effects), around a **paper** practice panel for the chart, because notation reads best black on white. It shipped on 2026-11-05.

- **Console tokens.** `--rw-console` (lacquer), `--rw-console-well` (lanes, meter wells, fader slots), `--rw-console-raised` (strips, headers), `--rw-console-edge`, `--rw-console-text`, `--rw-console-meta` (7.4:1 on the console). All are mixed from the shared tokens, so they switch with the world.
- **One colour per part**, the same in every lane, mixer strip and chart tab: `--rw-part-vocals` (gold), `--rw-part-guitar`, `--rw-part-keys` (sea glass), `--rw-part-bass`, `--rw-part-drums`, and `--rw-part-take` (flare, red like the Rec lamp). All clear 4.5:1 on the console and all but the take clear 7:1. On paper they appear only as swatches with an edge, never as text.
- **Meter zones**: `--rw-meter-low` (sea glass), `--rw-meter-mid` (gold), `--rw-meter-high` (flare).
- **State is never colour alone.** A part's state is a word (In mix, Muted, Solo, Not soloed, Left out) plus a mark (dot, M, S, dash) plus dimming. "In mix", not "Playing" (changed 2026-11-06): the word describes the part, so it has to be true while the song is paused too. Toggles carry a lamp. Selected modes carry a bar or fill as well as a colour.
- **Indicators only show measured data.** Meters read AnalyserNodes in the real signal path (post-fader per part, the master after the soft clipper, the mic before anything). The master's Clip light means the clipper is bending peaks. The EQ curve is the browser's own frequency response of the real filters.
- **Motion follows the audio clock**, not React renders: the playhead, waveform veil, beat lights, meters, reels and VU needle are written to the DOM on animation frames. All of it honours `prefers-reduced-motion`.
- **The hardware objects are a deliberate exception** to the one-chrome-object rule, asked for by the owner: the reel-to-reel tape deck around the record key and the console fader caps (dark with a white line, red for the master).
- **Layout.** The song page is the one route wider than the 1200px grid: 1320px, so the player works in 1272px on a desktop. The transport sticks under the site header on desktop. On a phone it scrolls with the page and a compact bar appears at the bottom once it is out of sight. At 1000px of player width and up, the chart and the studio sit side by side, the studio at `clamp(520px, 42%, 560px)` so all seven mixer strips (five parts, a take, the master) fit without scrolling.
- **Sizes on the console.** The clock is 44px display numerals; lane names 15px; states, markers and labels 12.5px; hints 13.5px. Nothing on the player is under 11px, and nothing drawn in a graphic is under 10px on screen. Transport and mode controls are 44px tall.
- **The chart's states.** The current chord sits in a Play now card (label stock, red rule, 44px name, a large diagram); Next is smaller and quieter. In the grid the current bar is outlined in red with its chord filled, the next bar is dashed in lagoon, and the rest recede.
- **Rendering.** The player re-renders with the song position about 15 times a second, not every frame: constant renders starved the router, so links did nothing mid-song. Cursors and other moving parts read the audio clock directly (`player/clock.js`).
- **The homepage preview.** The method band ends on a silent preview of the player (`components/home/ConsolePreview.js`): the real `Timeline` and `ChordChart`, driven by a timer through the `PlayClock` context instead of the audio engine, over eight bars of one song. It never plays sound, because the stems are the original recording and aren't licensed for public use: the lanes are loudness outlines and the chart is chords plus the finished bass and drum parts, never the vocal line or lyrics. `backend/scripts/make-home-preview.py` builds that data file from a chart and local stems. It loads only when scrolled near, never autoplays, has no page-wide keys, steps a bar at a time under reduced motion, and leaves the member player's remembered choices alone (`ephemeral`). It opens small (since 2026-11-06): the transport, the speed row and the Play now / Next cards (`ChordChart compact`). "Explore the player" is a disclosure button (`aria-expanded`, `aria-controls`). It opens the band timeline and the full chart in place, in the same instance, so the choices made there survive closing it. The button sits beside the speed row, above everything it reveals, so it never moves. Closing it pauses playback. The timeline's wrapper stays in the page while hidden, so `aria-controls` always resolves. On a phone the full player is the Simple view. With a demo track the school owns, the same component can take sound.
- **Simple and Studio views.** Simple shows the transport, the Band and Loop keys, the loop strip and section ruler, and the chart across the full width. Studio adds the part lanes and the studio column (mixer, recorder, effects). The studio is hidden, not unmounted, so a recording or mic check survives a switch. Since 2026-11-06 Simple is the default for anyone who hasn't chosen otherwise in this browser, practice work included; only a teacher's review opens in Studio. The switch is one disclosure button at the end of the band row, "Open studio mixer" / "Close studio mixer" (`aria-expanded`, `aria-controls` the studio column, a gold faders mark), and the choice is remembered per browser (`rw-player-view`). Simple only applies to a song with a chart: one without keeps its lanes and studio, with no button. A first-visit note on paper explains Play, Speed and Loop until it's dismissed (`rw-player-intro`).
- **Record your take.** The transport carries "Record your take" at its right, beside the master meter: a console key edged in the take's red with a red record mark, so Play stays the one filled button. It opens the studio on the Recorder tab and brings the deck's Record key into view with focus on it, without changing the remembered view. It hides while recording (the transport shows the Recording timer then) and in a review. On practice work the chart's coaching line no longer climbs a speed ladder against the teacher's "at full speed": below 100% it says "Start slowly, then record your final take at 100%." (a take records at full speed unless its task sets a speed of its own, which then says "at 80%").
- **Guided practice session.** For practice work on a song, the dashboard's panel leads with "Start today's practice" (primary), says the plan in one line ("Step by step: tune up, practise Verse 2, then record a take and send it to Brian."), keeps "View assignment", and offers "Open the player without the steps" as a quiet link. The session (`?session=1`, `components/member/PracticeSession.js`) sits above the player on label stock under the flare rule: the steps across the top (numbered; the current one a flare-ink disc, done ones lagoon with a tick), "End session" at the right, then the step as a heading with one plain paragraph, its own action, and Back / "Next: …" along the foot. The steps reuse the tools: Tune up (the tuner itself, `components/tuner/Tuner.js`, which the tuner page also renders, preset to the student's instrument; only for guitar, bass and ukulele), Practise the section ("Start the speed trainer", which climbs to the task's target speed), Record your take ("Open the recorder"; Next waits for a take), Listen back ("Play your take", with what the teacher listens for), and the last step, which for a weekly task is "Save milestone" or "Submit Take 2 for the Week 2 assessment" and says why when the take stayed as practice. Finishing a session never submits anything: only that key does. It ends on "Sent to Brian · That's today's practice done" (or "Saved", or "Submitted to Brian") with the way back to the dashboard. The player drops its first-visit note while guided. Each step done is ticked on the dashboard's Today list, which now starts with "Tune up" for string instruments; the step reached survives a reload in the tab.
- **Focus view.** "Focus" in the transport (beside Record your take) opens the player at stage size for when the screen is across the room: a native `<dialog>` filling the screen like the metronome's, drawn inside the player so the song carries on through it (`player/FocusView.js`). Lacquer, with what to play on paper in the middle: Play now and Next at their largest (ChordChart's `stage`: the chord name a fluid 88–220px, see the table), or for bass, drums and voice the bar being played and the next (PartChart's `stage` mode), the drum key on the paper with them. Along the foot, keys made to be hit from a step away: bar back and forward (84px), Play (84px, flare action), Loop this section / Repeating… Stop repeating, the speed keys (60px), and Record edged in the take's red (solid while recording). It opens on Play, gives focus back to the Focus key, closes on Esc or Exit focus, and keeps the screen awake while open (Wake Lock, where supported). On a phone the cards stack as rows, the clock gives way to Exit, and every key still clears 52px.
- **Assessment takes.** A task opens the player at the help and speed it asks for, and the chart's help level lives in the player (ChordChart's `helpMode`), which counts the most help used during a take: raising the mode, a peek, or Focus view opening. Above the record key a weekly assessment shows a console-raised panel (`.rw-brief`): "Week 2 assessment: …" as a 0.22em gold label, what it asks in one bold line ("Audio · Chart only · 90% speed"), what the teacher will listen for, and either "The player is set for this take." or "Set the player to this". Pressing Record with the player set otherwise asks first: "Set it and record" or "Record as practice", never a block. A take that didn't fit stays in the browser as practice and a gold line under it says why and what to do next, with no submit key. One that fits offers "Submit Take 2 for the Week 2 assessment", then a second step before anything is sent. A milestone's key is "Save milestone". Takes can be recorded below full speed for a task that sets a speed: the take remembers it, so it stays in time with the band in the player, on the timeline, in Compare takes and on the teacher's page (`lib/takeRules.js`, with the same rules on the server). A slowed take downloads on its own, since it doesn't fit the band at full speed.
- **Video takes.** A task that asks for video records through the camera, for a student who can be filmed (a minor needs a guardian's yes on the family page; until then the recorder says so and audio is what's sent). The recorder shows a 16:9 well: "Your camera is off…" until "Turn camera on", then a mirrored preview, and the deck's Record key waits for it. The take plays back in a native video player in the same panel, with the same verdict, keys and status line as an audio take. MP4 where the browser can record it, otherwise WebM, 720p at about 2.5 Mbps, up to 8 minutes and 300 MB, with a gold warning 30 seconds before it stops by itself (`lib/video/capture.js`). An unsent video is kept in the browser, and only said to be once the browser has it. It goes up in 8 MB pieces (`lib/video/upload.js`): a piece that fails is tried again, and if it still won't go the key becomes "Resume upload", which sends only what hasn't arrived, even after a reload. Microphones are offered as a select once the browser will name them, for audio too. A filmed take plays on its own on the teacher's page and in Compare takes, not with the band: a browser's recorder can't say exactly when it started, so its place in the song is only near enough for notes.
- **Speed trainer.** "Speed trainer" in the transport's speed group (a toggle-style key whose lamp is lit while it runs) opens a row under the speed controls: Start, Step, Passes each and Up to, as console selects with 0.22em labels, then "Start trainer". Running, the row says where it is ("Pass 1 of 2 at 60% · next 70%", then "At 100%, your top speed") with "Stop trainer". It repeats the loop (or the chart section you're in when none is set), counts passes where the loop restarts and steps up only there, so a change of speed always lands on the loop's start; it never goes past the top speed and never starts itself. A speed between the keys' own shows beside them in gold ("Now 70%"). Picking a speed by hand, clearing the loop or recording stops it. The arithmetic is `lib/speedTrainer.js` (with tests), on the metronome's tempo-builder stages; the settings are remembered (`rw-speed-trainer`).
- **Notes on moments.** A teacher's reply can carry notes pinned to moments in the song (`Submission.notes`: `[{ at, text }]`, up to 20 of 280 characters, sorted by time). On the review page, "Add a note at this moment" takes where the teacher is: the band player's position (StemPlayer's `positionRef`) or the recording's own time plus where it starts; each note has an editable m:ss time and its line, saved with the feedback. The student sees them under the reply as ruled rows (`.rw-moment`): the time in the display face in flare ink, the note, then "Hear it" (that recording from a second before, when the recording reaches it) and "Practise this part", which opens the player at `?at=` looping from the bar before to the bar after, with the note above the player on label stock under the flare rule (`.rw-moment-pinned`). The demo's replies carry notes on the first section's first beat and the first verse's first change.
- **Compare takes.** On the practice work's page, once two sent attempts have recordings, a surface panel above the list (`components/member/CompareTakes.js`) plays one take at a time: a two-way switch of square tiles (attempt in the display face, its date under it; the playing one on label stock with a 4px flare band at its foot, like the chart's help modes), then Play, the time at 26px and a scrubber in song time. Switching mid-play carries on at the same point in the song (a take's own time plus where it starts in the song), and when the other take doesn't reach that point it says so in flare ink instead of jumping. With more than two, two selects choose which. It plays the takes only, without the band.
- **Where a take is.** An unsent take is kept in the browser (IndexedDB, `lib/takeStore.js`, one per song and practice work), so a reload or a visit elsewhere doesn't lose it, and it comes back as it was left, name and line-up included. Nothing is stored on the server until it's sent. One status line under the take says where it is: a sea-glass lamp for "Kept in this browser since 4:12 PM, and not sent yet…", gold lamp and words when leaving would lose it ("Not safely kept…", when the browser won't store it), and "Uploading…" while it goes up. The page warns before closing only in those at-risk moments (recording, sending, not kept). Away from the player, `UnsentTake` says "Take 1 isn't sent yet" with "Open it in the player": a label-stock note on the practice work's page, the closing line of the dashboard's practice panel. Each sent attempt on the practice work's page carries a pill: "Waiting for Brian" (newest, no reply), "Brian replied Nov 5", or "Sent" (an older one, passed over).
- **Narrow studio.** Below 1000px the columns are one `minmax(0, 1fr)` track, so no panel can push the player past a phone's edge, and the recorder's mic meter is fluid (Meter's `fluid`): at most 260px, shrinking with its scale to fit.
- **A student's player.** Students get their own part and one backing band, never the other parts (`docs/instrument-access.md`), so their player is simpler than staff's. A line above the transport names the instrument in its part colour. The Band keys become **Play: Whole song / Band without guitar / Guitar only**, named for their instrument, with no part chips. A player with every stem (staff, the demo, the homepage preview) names its keys the same way for the part in focus, "Band without bass" / "Bass only" once Bass is chosen in the chips (`bandModes` in `player/Timeline.js`). The studio mixer is two faders, **Your guitar** and **Backing band** (`--rw-part-backing`, neutral, so their own colour leads), then the take and the master, with no mute or solo. A fader its mode silences is disabled and dimmed, and the sentence under the strips says why. A mode the song can't play is disabled with the reason beside the keys. The chart shows one fixed view (a label in place of the tabs): their chords voiced for guitar, piano or ukulele (`--rw-part-ukulele`), or their own tab, drum part or melody, or a plain note when theirs isn't written out yet.
- **Video tutorials.** Between the song's heading and the player sit its videos for the student's own instrument (`components/member/SongTutorials.js`). It's a tag (surface, 1px edge, 5px flare rule, square), so it reads apart from the lacquer console and from the player's warm first-visit note. Until something is published for that instrument it is one panel, never five empty cards: the instrument's heading, Coming soon at 44px (32px on a phone), one line, and "Go to practice player". The link scrolls to the player, instantly under reduced motion, and moves focus into it. With videos, one native player sits beside the five levels; Lesson and Playthrough are named on their buttons and in the caption tag (outlined against solid). A level with nothing yet stays listed as a quiet Coming soon row. A failed load, a video that won't play and a shut song each get their own words, never Coming soon.
- **Known gap.** The mixer's M and S keys are 28px square, under the 44px floor, to fit seven strips in the studio column. They clear WCAG's 24px minimum, and mute and solo keys carry gold and sea-glass edges so they read apart before they're pressed.

## Accessibility floor

Non-negotiable, and verified by measuring rendered pages rather than reading source:

- Body and small text ≥4.5:1, large text ≥3:1, focus rings and UI edges ≥3:1 — checked against the ground the element actually sits on, including alternate bands.
- Interactive controls ≥44×44, except inline links inside running prose.
- The skip link is the first focusable element on every page.

Headless browsers report no window focus, so `:focus` never matches and focus states read as broken. Enable CDP focus emulation before concluding a focus style is missing.

## The metronome

`/tools/metronome` is an Operate surface built like the song player: a **lacquer console** (the instrument) beside **paper settings**, quieter than the console. It shipped on 2026-11-06. Its styles are a CSS module (`components/metronome/metronome.module.css`), so none of its names can collide with `globals.css`; the engine and rhythm maths live outside React in `lib/metronome/`.

- **The console** holds what a beginner needs first: a state lamp with the bar and elapsed time, the tempo, the beat cells, the counting line and Start/Tap. Everything else sits in three tabs (Metronome, Training, Presets), and advanced rhythm (swing, polyrhythms) is a closed disclosure at the foot of the first.
- **The tempo is the input.** The big numeral is typed into directly, with the note it counts drawn beside it (♩ =, ♩. =, ♪ =) and a plain caption ("quarter notes per minute"). It checks itself on Enter or blur and says what it did with a number out of range. ±1 and ±5 keys and a slider sit underneath; precise entry never depends on dragging.
- **Beat cells carry the accent as a shape.** Each cell has the tag's top rule: thick and gold for Strong, thin for Normal, none for Silent, which also goes dashed and shows the sound-off mark. Every cell says its level in words. The cell sounding now fills flare with ink type; during the count-in it fills gold; in a silent bar with the lights left on it is only outlined in sea glass, because nothing is sounding. Groups in odd meters get a bracket with their size underneath.
- **Choices are square tiles**, like a sewn tag: the checked one turns label stock with a flare band across the top. Classic, being rounded, swaps the band for a 2px orange border on the orange tint.
- **Notation is drawn** (`NoteValue`), never typed: the music symbols in fonts differ on every device.
- **Motion follows the audio clock.** Beat lights, the counting line and the polyrhythm cycle are written to the DOM on animation frames from the engine's snapshot of what is audible now, allowing for output latency. React renders only when settings change, and once a bar or a second for the readouts. Under reduced motion the cycle view's sweeping line is hidden and lights change without transition; the lit beat stays.
- **Phone.** Below 560px the console runs edge to edge like a band so the beat cells get the width. While its transport is out of sight, a compact bar (Start/Stop, tempo, a beat strip, Tap) stays at the foot of the screen.
- **Focus view** is a native `<dialog>` filling the screen: the same console at stage size, closed with Esc or Exit focus, returning focus to the Focus key.
- **Sizes.** The tempo numeral is fluid (see the table above); beat numbers 32px (44px in focus view); transport keys 60px tall (84px in focus view); every control is at least 44px. The state lamp follows the 0.22em label rule.
- **Classic.** The lit cell takes light type there: Classic's darker red puts ink at 3.3:1 against 4.8:1 for light type.

## The beat maker

`/tools/beats` (added 2026-11-06) is the metronome's composition grown into a small studio: one **lacquer console** holding the instrument, then **paper settings** in four tabs (Grooves, Kit, Beat, Save & share). Its styles are one CSS module (`components/beats/beats.module.css`); the audio and the beat's data live in `lib/drums/` (see `docs/beat-maker.md`).

- **The console, top to bottom:** the state lamp (Stopped, Playing, Count-in, Recording, Song finished) with the bar readout, a MIDI lamp while a device is connected (it blinks in the drums' colour on every note), and Undo/Redo; Play/Stop, Record and the Click key; what Play plays, as two square tiles (Loop part, Song), the chosen one carrying a gold band; Tempo (typed into its 44px display numeral, ±1, Tap) and Swing; the parts as tabs; Ghost / Hit / Accent and the Grid / Pads switch; the grid or the pads; the song.
- **Notes are drawn in the drums' part colour** (`--rw-part-drums`, the same lime as their lane in the player), and their **shape carries the strength**: a ghost is a small hollow square, a hit a solid one, an accent a larger square with a gold cap. The same three marks label the Ghost / Hit / Accent keys, so colour is never the only sign.
- **The grid** is a row per drum (cymbals at the top, kick at the foot, the way drum parts are written) and a column per step. Beat lines are 2px and every other beat sits on a slightly lighter ground, so a bar reads in beats. The column header counts it (`1 e & a` in sixteenths, `1 & a` in triplets, `1–6` in 6/8). Drum names stay pinned at the left while a phone scrolls the bar sideways. The step sounding now fills its header cell flare with ink type, like the metronome's lit beat (light type in Classic), and a translucent flare band with a 2px edge runs down the column. Squares are 44 × 44px at every width; their dividers are inset shadows so a line never eats into a square.
- **The grid's focus ring is Sea Glass, 2px, inset 3px**, an exception to the Focus Ring Rule like the stage's: the squares sit edge to edge on the darkest well, where an outside ring would be hidden under the next square and Lagoon has least margin.
- **The pads** are grouped by where each drum sits (Cymbals, Toms, Hi-hat, Snare, Kick), labelled with the 0.22em small caps, the drum's name in the display face and its computer key in a small square. A hit, by hand or by the beat, lights the pad in the drums' colour with ink type at once and lets it fade back over 0.2s (no fade under reduced motion). Two pad groups a row on a tablet, four columns on a desktop, one group a row on a phone.
- **The song** is a row of blocks, each wider the more bars it plays, so the song's shape shows. The block playing carries a flare band on top and fills a sea-glass line along its foot as it goes. Choosing a block opens its editor below the row (part, bars, Start with a crash, Play from here, move, take out).
- **Phone.** The console runs edge to edge. Play, Record and the Click key share a row, the part actions shorten to one row (`+ New`), and once Play and Record have scrolled out of sight a compact bar (Play/Stop, Record, the part and tempo) waits at the foot of the screen, as on the metronome. Pads are the default view on a phone, the grid elsewhere; the choice is remembered.
- **Motion follows the audio clock.** The playhead, the lamps on the part tabs and song blocks, the readout and the lit pads are written to the DOM on animation frames from the engine's snapshot of what is audible now; React renders only when the beat or a setting changes.
- **Paper.** Grooves are cards on the surface with a small drawing of their rows (ink marks, hollow for ghosts), style chips above them, and two actions each: Use in the chosen part, Add as a part. The Kit tab is the volume, MIDI (connect a device; the last note played, large, with the drum it plays) and the mixer (a level and a mute per drum); the Beat tab holds the meter as square choice tiles; Save & share lists saved beats like the metronome's presets.
- **Sizes.** Transport keys 60px tall; every other control at least 44px. Pad names 22px display caps (18.5px on a phone), the tempo 44px display numerals, notes 12/20/26px.

## Known state, not prescription

1. **The school has no photograph of itself.** The type-led design is a deliberate holding position, not the finished state. A real photograph of the room, a recital or the 1982 sign would change what this system should do with imagery.
2. **The footer's three social links point at `#`.** The marks are real; the destinations are not.
3. **Five public routes keep their previous body compositions** — `/program/curriculum`, `/program/how-it-works`, `/community/events`, `/community/alumni` and the legal pages. They inherit the header, palette, type and radii, so they are consistent, but their interiors have not been rethought.
4. **`Card` and `Prose` primitives exist and are still barely adopted.** Pages hand-roll both. New work should use the primitives.
5. **Labels above headings remain in places** (`SectionHead`, the homepage record). The homepage's "Honolulu · Est. 1982" label moved to the foot of the stage on 2026-11-05. The page header dropped its label on 2026-11-05. Recorded as what the build does, **not** as a pattern to reach for: a kicker above a heading is a device to justify each time, and a new section should first ask whether the heading can carry its own weight.
