---
name: Rock Works School of Music
description: Dusk over the Pacific with the house lights already up — a Honolulu rock school set in slab type on sun-warmed paper.
colors:
  ink: "#0a2338"
  ink-deep: "#06192d"
  cream: "#fbf5ec"
  surface: "#fffdf9"
  sand: "#f6ecdd"
  rule: "#e6d8c6"
  border: "#ece0d5"
  line: "#d8cab8"
  orange: "#c94428"
  orange-deep: "#b6371c"
  orange-tint: "#fdece6"
  teal: "#0e8a97"
  gold: "#ffd89a"
  sea-glass: "#82d4dd"
  meta: "#8a7d6a"
  body: "#6a6560"
  body-cool: "#5f6f79"
  prose: "#33454f"
typography:
  display:
    fontFamily: "Zilla Slab, Georgia, serif"
    fontSize: "clamp(38px, 5vw, 58px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Zilla Slab, Georgia, serif"
    fontSize: "clamp(28px, 3.4vw, 40px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Zilla Slab, Georgia, serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  lead:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "18.5px"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "normal"
  body:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  prose:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  eyebrow:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.22em"
rounded:
  sm: "8px"
  field: "10px"
  md: "14px"
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
    backgroundColor: "{colors.orange}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "15px 32px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "15px 32px"
    typography: "{typography.body}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "0 0 3px"
    typography: "{typography.body}"
  button-stage:
    backgroundColor: "{colors.orange}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.5}"
  input-field:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.prose}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  nav-link-active:
    backgroundColor: "transparent"
    textColor: "{colors.orange}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  page-hero:
    backgroundColor: "{colors.ink-deep}"
    textColor: "#ffffff"
    padding: "70px 24px 90px"
  band-sand:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
---

# Design System: Rock Works School of Music

## Overview

**Creative North Star: "Last Light on the North Shore"**

The whole system is one moment: the sun is gone, the water still holds the light,
and the house lights are already up. Everything dark in this design is that sky —
`#06192d` falling through `#0b2f43` to a lit teal `#0b5563`, warm at the edges,
never neutral. Everything light is what sits below the waterline: sun-warmed
paper, not white. And the two are always separated by the same wave, cut into the
foot of every dark banner on the site.

It reads as a concert venue with a Hawaiian twist, and that is deliberate. The
gradient behind a page title is stage lighting; the gold on it is the warm spill
off a rig; the single hot orange is the only thing on screen allowed to shout.
The energy is meant to feel warm, loud and alive — a room where people are
actually playing — but the loudness comes from contrast and restraint, not from
volume everywhere. A page is mostly quiet paper so that one orange button lands
like a downbeat.

The type carries the rock half. Zilla Slab is a slab with blunt, flat terminals
and no politeness about it; it sets every heading and is never asked to set a
paragraph. Source Sans does the reading. Beneath both runs an editorial
discipline the site inherited and should keep: uppercase eyebrows at 0.22em, a
hairline rule under every section heading, and exactly three column measures for
the entire site. Forty-plus years of school, set like a broadsheet, lit like a
stage.

**Key Characteristics:**

- Warm-first: there is no neutral grey ground and no pure white page anywhere.
- One hot ink. Orange means *act*, and nothing else is allowed to mean it.
- A hard waterline: teal belongs to paper, gold belongs to the dark.
- Flat at rest; light and lift arrive only as a response to touch.
- The wave is the signature — the same cubic on every dark banner.
- Slab headings, sans body, and a 0.22em eyebrow that never varies.

## Colors

A palette taken from the island rather than from a UI kit: volcanic darks, reef
accents, and paper the color of sun-bleached sand. Nothing in it is grey.

### Primary

- **Lava Orange** (`#c94428`): the action color, and the system's only voice for
  "do this". Primary buttons, large display numerals, the hover state of an
  instrument mark. Never decorative, never a background for a large area.
  **White on it measures 4.84:1, and 4.52:1 under the `.rw-cta` hover's 4%
  brightening** — the state a visitor is pointing at has to pass too.
- **Lava Orange Deep** (`#b6371c`): all orange *text* — inline links in running
  text, the active nav link and its underline, small labels — and the far stop
  of the CTA gradient. The reading-weight sibling. **5.45:1 on cream, 5.82:1 on
  Bleached Shell, and white on it is 5.91:1.**

  The division between the two is the whole point and is easy to get wrong:
  **Lava Orange is a surface, Lava Orange Deep is an ink.** If orange is behind
  white, it is Lava Orange; if orange *is* the letterform at reading size, it is
  Lava Orange Deep. The one exception is display numerals at 24px and up, where
  the large-text floor is 3:1 and Lava Orange clears it at 4.76:1.

  Both were darkened on 2026-08-27. The previous pair (`#ef5130` / `#cf3f20`)
  put white on orange at 3.57:1 — every primary button on the site, against a
  4.5:1 floor — and orange-deep as link text on cream at 4.42:1. The darkening
  holds hue: the green-to-red ratio that makes this read as orange rather than
  red is 0.339 before and 0.338 after, and the CTA gradient's step is preserved.
  See the reasoning block in `app/tokens.css`.
- **Lava Wash** (`#fdece6`): orange at 8% strength. Notices, tinted callouts, and
  the ground beneath a warning. The only tinted surface in the system.

### Secondary

- **Reef Teal** (`#0e8a97`): the quiet accent. Every section eyebrow, every focus
  ring, the instrument marks at rest, the "School of Music" line under the
  wordmark. It carries structure, never action.
- **Last-Light Gold** (`#ffd89a`): the dark-ground accent. Hero eyebrows, the
  logo mark on the page hero, stat figures on an ink band. It exists because
  Reef Teal goes muddy on the gradient and disappears.
- **Sea Glass** (`#82d4dd`): the pale sibling of Reef Teal, used only for a
  section eyebrow sitting on a dark band, where gold would compete with a stat.

### Neutral

- **Basalt** (`#0a2338`): all primary text, all headings, and the standard dark
  section ground.
- **Volcanic Ink** (`#06192d`): the darkest stop in every hero and CTA gradient.
  It is a gradient terminus, not a text color.
- **Coral Sand** (`#fbf5ec`): the page itself. Warm, and never substituted with
  white.
- **Bleached Shell** (`#fffdf9`): cards and panels sitting on Coral Sand. The
  near-white that makes a card read as lifted without a shadow.
- **Dune** (`#f6ecdd`): the alternate band, for the section that needs to
  separate from its neighbours without going dark.
- **Bleached Rule** (`#e6d8c6`) / **Shell Edge** (`#ece0d5`) / **Driftwood
  Stroke** (`#d8cab8`): three hairlines, warm to cool, doing three different
  jobs — section rules and column dividers, card and band edges, input and
  button borders. They are close on purpose; they are not interchangeable.
- **Four secondary text tones**, kept apart because they differ in temperature
  and were each tuned to a size: **Driftwood** (`#8a7d6a`, warm, 12px captions),
  **Warm Body** (`#6a6560`, 14–15px on cream), **Cool Body** (`#5f6f79`, 15–16px
  and hero standfirsts), **Slate Prose** (`#33454f`, 16.5px long-form).

### Named Rules

**The One Hot Ink Rule.** Lava Orange is the only color in the system that means
*act*. One primary orange element per viewport is the target; two is a smell;
three means the page has no hierarchy. Its rarity is what makes it work.

**The Waterline Rule.** Reef Teal lives above the waterline, on paper. Last-Light
Gold lives below it, on the dark. Teal on a hero gradient is nearly invisible and
is a bug, not a style choice — this is why `PageHero` and `SectionHead onDark`
carry different eyebrow colors.

**The No-Grey Rule.** There is no neutral grey and no pure white ground in this
palette. If a surface needs to recede, it goes to Coral Sand or Dune; if text
needs to soften, it takes one of the four warm/cool tones. `#fff` appears only as
type on a dark ground and as an input's field.

## Typography

**Display Font:** Zilla Slab (with Georgia, serif)
**Body Font:** Source Sans 3 (with system-ui, sans-serif)

Both are self-hosted from `app/fonts` rather than fetched at build time. Zilla
Slab has no variable cut, so it ships as one file per weight — 500, 600, 700,
plus a single 600 italic. Source Sans 3 is one variable file covering 400–700.
Adding a weight means adding a woff2; only the faces actually used are shipped.

**Character:** A slab with flat, blunt terminals against a humanist sans that
gets out of its way. The slab is the rock in "Rock Works" — it has weight and
edge without being a novelty face — and the sans is what makes ten years of
curriculum readable. The one italic in the system (the hero's *"From day one."*)
is the single moment the type is allowed to sing.

### Hierarchy

- **Display** (Zilla Slab 500, `clamp(38px, 5vw, 58px)`, `-0.015em`): page hero
  titles only. Set at 500, not bold — at this size the slab has enough presence,
  and bold turns it into a headline scream.
- **Headline** (Zilla Slab 600, `clamp(28px, 3.4vw, 40px)`, `-0.01em`): section
  headings, always paired with the hairline rule beneath.
- **Title** (Zilla Slab 700, 22px): card and panel headings.
- **Lead** (Source Sans 400, 18.5px/1.62, Cool Body): the standfirst under a
  heading. One per section, never two.
- **Body** (Source Sans 400, 15px/1.6): the default. Interface copy, card text,
  lists.
- **Prose** (Source Sans 400, 16.5px/1.7, Slate Prose): long-form reading —
  philosophy, history, curriculum, the legal set. Held to the 900px measure.
- **Eyebrow** (Source Sans 700, 11px, `0.22em`, uppercase, Reef Teal): the label
  above or beside a heading.

The rest of the scale exists and should be used rather than extended: 11 · 12.5 ·
13.5 · 15 · 16.5 · 18.5 · 22 · 26 · 32 · 44px. The half-points are real — they
were measured off the built pages, not rounded to a theory.

### Named Rules

**The Slab Stays Short Rule.** Zilla Slab sets headings and nothing else. It
never sets a paragraph, a form label, a table cell, or a button. A slab at
reading size is fatiguing, and this one especially.

**The 0.22em Rule.** The eyebrow's letterspacing is a signature, not a
coincidence — it is identical on every section heading across the site. Do not
tune it per page. The only sanctioned variant is the hero eyebrow at `0.16em`,
which is tighter because it sits at 12.5px on a dark ground.

**The Twenty-First Size Rule.** The scale has ten steps for a reason. If a new
design needs a size that isn't in it, the answer is almost always the nearest
existing step, not a new token.

## Layout

Three measures do the entire site, and there are no others: **1200px** for the
wide grid, **900px** for a reading column, **520px** for forms. Every container
carries 24px of side padding at every width.

Vertical rhythm comes from two section sizes — 64px top and bottom for a standard
section, 44px for a tight one — on an 8px-derived scale (4 · 8 · 12 · 16 · 24 ·
32 · 44 · 64). Bands are full-bleed: the colored ground runs the full window
width while the container inside holds the measure, which is why a band and its
contents are always two elements rather than one.

Responsive behavior is a small set of deliberate collapses, not a fluid system:

- **940px** — the desktop nav is replaced by the burger and a full-screen sheet.
- **860px** — the hero grid, and the 2/3-column grids, go to a single column;
  5-column goes to 3, 4-column goes to 2; editorial columns swap their right
  border for a bottom one.
- **720px** — the admin shell stacks and its sidebar becomes a wrapping row of
  chips; the video player trades its row of speed pills for a native select.
- **640px** — the section heading stacks, eyebrow beneath title.
- **560px** — the 5- and 6-column grids go to 2.

Density is generous on marketing surfaces and tighter in the member area and
admin, where scanning beats expression.

### Named Rules

**The Three Measures Rule.** 1200, 900, 520 — and nothing else. Before this
system there were ten container widths across the site and no two pages agreed.
A new surface picks one of the three; it does not introduce a fourth.

**The Band-and-Container Rule.** A colored ground and its contents are always
two elements: the band runs full-bleed, the container inside holds the measure.
Never put a max-width on the thing carrying the background.

## Elevation & Depth

The system is **flat at rest and lit on interaction**. A card on Coral Sand is a
Bleached Shell fill with a 1px Shell Edge border and no shadow at all; depth at
rest comes from the warm tonal step between the three grounds, not from a shadow
ramp. Everything below is a *response* — to hover, to focus, to a surface
genuinely floating above the page.

When light does arrive, it behaves like stage lighting rather than a drop shadow:
long, soft, heavily negative-spread, and warm-tinted rather than black. The
signature case is the auth submit button, which carries an orange glow of its own
color — the only colored shadow in the system.

### Shadow Vocabulary

- **Stage glow** (`box-shadow: 0 12px 26px -12px var(--rw-orange)`): under a
  primary CTA on paper. The button appears to be lit rather than to cast.
- **Hover lift** (`box-shadow: 0 22px 44px -22px rgba(90, 40, 70, 0.45)`): paired
  with `translateY(-6px)` on a lifting card. The tint is warm plum, not black.
- **Floating panel** (`box-shadow: 0 18px 40px -20px rgba(6, 25, 45, 0.4)`): nav
  dropdowns and menus — surfaces genuinely above the page.
- **Deep panel** (`box-shadow: 0 26px 54px -34px rgba(90, 40, 70, 0.4)`): the
  largest resting panels, where the card border alone is not enough separation.
- **Active underline** (`box-shadow: inset 0 -2px 0 var(--rw-orange)`): the nav's
  current-page marker. A shadow used as a rule, so it costs no layout.

Motion is short and uniform: 0.16s for menus and backgrounds, 0.18s for buttons,
0.20–0.22s for cards, all `ease`. Lifts are −2px for a button, −5px for an
instrument card, −6px for a content card. A global `prefers-reduced-motion` block
reduces every animation and transition to 0.01ms.

### Named Rules

**The Flat-At-Rest Rule.** Surfaces are flat until touched. If a new component
needs a resting shadow to feel separated, the separation is wrong — change the
ground or the border instead.

**The Glow Belongs to Orange Rule.** The only colored shadow in the system is
orange, beneath an orange element. Never tint a shadow teal, gold or ink to
"match" a component.

**The Black Shadow Ban.** No shadow uses neutral black. Every one is tinted warm
plum or deep ink, because a black shadow on Coral Sand reads grey and drags the
whole page cold.

## Shapes

A calm, low-radius form language with one recurring organic gesture cutting
across it.

Corners: **8px** on buttons, **10px** on fields, **14px** on cards and panels,
**999px** for pills. A field is a step softer than a button on purpose — the
button is the thing you strike, the field is the thing you rest in. Borders are always exactly 1px and always one of the three hairlines —
there is no 2px border in the system, and no border on a solid button.

The exception, and the signature, is **the wave**. Every dark banner ends in the
same cubic — `M0,40 C360,80 1080,0 1440,40` on a 1440×70 box, rendered 50px tall
and filled Coral Sand — so the dark never meets the paper on a straight line. The
homepage hero uses a deeper variant of the same gesture. It is also the shape
cleaving the logo mark in two, which is what ties the identity to the pages.

The logo mark itself is the other piece of form language: a guitar pick — wider
than it is tall (50 × 48.7 on a 64 grid), which is the ratio that stops it
reading as a teardrop — split by that wave. One color, always; no gradient and no
second fill, because it has to survive as a 16px favicon and as a 10%-white
watermark at 420px.

### Named Rules

**The Wave Is the Signature Rule.** Dark meets paper on the wave, never on a
straight edge. Reuse the existing cubic rather than drawing a new curve; a second
wave shape would dilute the first. A dark band sitting *between* two cream
sections meets paper twice and carries the wave twice — the top copy is the same
path flipped on Y, so the paper spills down into the dark rather than the dark
rising into the paper.

**The One-Pixel Rule.** Every border in the system is 1px. Weight comes from the
hairline's color — Bleached Rule, Shell Edge or Driftwood Stroke — not from
thickness.

## Components

### Buttons

- **Shape:** gently rounded (8px), except the stage variant, which is a full pill
  (999px).
- **Primary:** solid Lava Orange, white text, 700 weight, 15px/32px padding.
- **Secondary:** white fill, Basalt text, 1px Driftwood Stroke border.
- **Quiet:** a text link that behaves like a button — transparent, no radius, a
  1.5px underline at 32% ink that goes full-strength on hover.
- **Stage (auth submit):** pill, `linear-gradient(135deg, Lava Orange, Lava Orange
  Deep)`, 800 weight, wearing the stage glow. This is the "lit from the stage"
  treatment and it is reserved for the single most important action on a page.
- **Sizes:** md 15px/32px at 16px type; sm 10px/18px at 13.5px; xs 7px/12px at
  12.5px.
- **Hover:** `translateY(-2px)` plus `brightness(1.04)`, 0.18s ease — on solid
  variants only.
- **Focus:** a 2px Reef Teal outline at 2px offset. This is the system-wide focus
  ring; it is identical on nav links, menu items and CTAs.
- **Disabled:** 50% opacity, no lift, `not-allowed`.

### Cards / Containers

- **Corner Style:** 14px.
- **Background:** Bleached Shell on a Coral Sand or Dune page.
- **Border:** 1px Shell Edge.
- **Shadow Strategy:** none at rest. Lifting cards opt in via a modifier and take
  the hover-lift shadow with `translateY(-6px)`.
- **Internal Padding:** 24px.

### Inputs / Fields

- **Style:** white fill, 1px Driftwood Stroke, 10px radius, 12px/14px padding at
  15px type, inheriting the body font.
- **Focus:** the 2px Reef Teal ring at 2px offset, identical to buttons and nav
  links. Applied globally to `input`, `select`, `textarea`, `summary` and any
  element carrying a non-negative `tabindex`, so a new field inherits it without
  opting in.

### Navigation

- **Style:** a sticky header on 86% Coral Sand with a 14px backdrop blur and a
  1px Shell Edge bottom border. Links are 14.5px/600 in Slate Prose, 8px radius,
  10px/14px padding.
- **Hover:** a 5% ink wash behind the link.
- **Active:** Lava Orange Deep text plus the inset 2px underline in the same
  ink. It is text, so it takes the ink, not the surface color.
- **Dropdowns:** Bleached Shell panel, 11px radius, floating-panel shadow, fading
  in over 0.16s with a 6px rise, opened on hover *and* focus-within.
- **Mobile (≤940px):** the row is replaced by a burger and a full-screen sheet
  that locks body scroll and closes on Escape.

### Page Hero

The system's most-used composition and the clearest statement of the North Star:
a `linear-gradient(155deg, Volcanic Ink 0%, #0b2f43 52%, #0b5563 100%)` ground,
centered content, an optional logo mark, a gold eyebrow, the display title, an
optional lead at 82% warm white, and the wave cut into the foot. Two sizes —
marketing pages at 70/90px of padding, auth and onboarding at 56/70px so the form
sits closer to the fold.

### Instrument Marks

Six hand-drawn 24×24 marks — Guitar, Piano, Bass, Drums, Voice, Ukulele — sharing
one construction: 1.5px strokes, **butt caps and miter joins**, and an accent on
the sound-making part of each instrument (the soundhole, the pickup, the key
under the finger, the drum head, the voice leaving the mic). The squared
terminals are the point: they echo Zilla Slab's flat terminals and are what keeps
the set from looking like an off-the-shelf icon library. The accent is Reef Teal
at rest and Lava Orange on hover, driven by a `--rw-icon-accent` custom property
on the card so one variable serves both a stroke and a fill.

### Section Topologies

The homepage runs six sections and no two share a shape. That is deliberate: a
page whose every section is a row of equal columns teaches the reader its one
move by the second screen, and then nothing else registers. Each topology is
chosen for what its content actually is.

- **Type-led hero** — one full-measure column, left-aligned, display type sized
  to carry the band (`clamp(46px, 7.4vw, 106px)`). No image column. The warm end
  of the gradient is a radial bloom that falls off to nothing, not a field.
- **Strapline** — three parallel facts, set tight: 18.5px slab headings, one
  hairline above the row rather than rules between items. The densest type on
  the page, immediately under the hero wave.
- **Threaded path** — the five levels. Numbered markers joined by a rule drawn
  per item across each gap. Rotates to a vertical spine below 860px.
- **Grid** — the six instrument tiles. A real grid for genuinely equivalent
  options, inside one bordered container.
- **Asymmetric split** — heading held in a narrow sticky left column against a
  vertical list on the right. The only place the page changes measure
  mid-section, and the only place rules run horizontally between stacked items
  rather than vertically between columns.
- **Centered ask** — the closing CTA.

**The One-Shape-Per-Section Rule.** Two sections on one page may not share a
topology. If a new section wants to be a row of equal columns and one already
is, the new one is wrong — change its shape or merge it into the existing row.

### Browser Surfaces

The parts of the page nobody draws still ship with somebody's design, and by
default it is the browser's. All of these are themed from the palette:

- **Selection:** Lava Orange at 22%.
- **Caret:** Lava Orange. **Native control accent** (checkbox, radio, range,
  progress): Reef Teal.
- **Scrollbar:** Driftwood Stroke thumb on a Coral Sand track, 12px, pill-capped
  with a 3px track-coloured border so it reads inset; Driftwood on hover. Both
  the Firefox two-value form and the WebKit pseudo-elements are set.
- **Underlines:** unclassed links take a `0.18em` offset and a 1px thickness, so
  the rule clears descenders instead of striking them.
- **Figures:** `.rw-tnum` switches to tabular numerals wherever numbers must
  align down a column.
- **Anchors:** `:target` carries 96px of scroll margin so a jump lands clear of
  the sticky header rather than beneath it.

**The Nothing-Ships-Blue Rule.** This palette contains no blue. Any browser
default that arrives blue — caret, checkbox, focus ring, selection — is an
unstyled surface, not a neutral one, and is themed before the component
counts as finished.

### Named Rules

**The Border Tax Rule.** Only the outlined variant carries a border. A
`1px solid transparent` on a base button silently makes every solid button 2px
larger than the inline one it replaced — this has already broken the system once
and is why the base class declares `border: none`.

**The Lift Is for Solids Rule.** The −2px hover lift belongs to solid buttons.
A text link that rises off its own underline reads as a glitch, so the quiet
variant is explicitly excluded and answers with its underline instead.

## Do's and Don'ts

### Do:

- **Do** reach for an existing token. The palette, the ten-step type scale, the
  8px spacing scale and the three measures were read out of the built pages —
  everything a new surface needs is already named in `app/tokens.css`.
- **Do** put the eyebrow in Reef Teal on paper and Last-Light Gold on the dark,
  per **The Waterline Rule**.
- **Do** give a new section the `SectionHead` pattern — slab title left,
  uppercase eyebrow right, hairline rule beneath. It is the site's connective
  tissue.
- **Do** end a dark band on the wave.
- **Do** use the 2px Reef Teal focus ring at 2px offset on every interactive
  element, including new form fields.
- **Do** keep colored shadows orange and shadow tints warm.
- **Do** let one orange element own the page. If a second wants to be orange, one
  of them is not the primary action.

### Don't:

- **Don't** introduce a neutral grey, a pure-white page ground, or a black
  shadow. This palette has no cold values and should not acquire one.
- **Don't** set body copy, labels or buttons in Zilla Slab.
- **Don't** put a border on a solid button. A `1px solid transparent` base makes
  every solid button 2px larger than the inline one it replaced — this bug has
  already been fixed once.
- **Don't** give a resting surface a shadow to make it feel separated.
- **Don't** re-tune the 0.22em eyebrow tracking, or add an eleventh type size.
- **Don't** draw a second wave shape or a second logo mark; reuse the existing
  geometry.
- **Don't** let this drift toward **generic SaaS** — purple gradients,
  glassmorphism, floating cards on white, stock illustration of people
  high-fiving. Confirmed rejection.
- **Don't** let it drift toward a **kids' learning app** — bubble corners, cartoon
  mascots, confetti, badges shouting at you. The primary reader is a student who
  wants to look like a musician. Confirmed rejection.
- **Don't** let the Hawaiian half become **tourist clip-art** — hibiscus borders,
  tiki lettering, palm silhouettes on a sunset gradient. The island shows up as
  the wave, the light and the palette, never as decoration. Confirmed rejection.

### Known drift (accurate as of this writing, not prescriptive)

1. ~~Radius drift below the token scale~~ — **resolved.** `--rw-radius-field`
   (10px) now names the value every text input was already hardcoding, and nav
   dropdowns moved from a stray 11px to `--rw-radius-md`.
2. ~~Two golds~~ — **resolved.** `#ffd89a` and `#ffcf8f` were nine units apart
   doing the same job across 19 hardcoded hexes; they are now one `--rw-gold`,
   with `--rw-sea-glass` named alongside it.
3. **Two primary button treatments coexist** — the `Button` primitive (8px, flat
   orange) and the auth submit (pill, gradient, glow). Both are deliberate; they
   should not multiply into a third.
4. **`Card` and `Prose` primitives exist but are not adopted anywhere.** Pages
   still hand-roll both. New work should use the primitives.
5. **The school has no photograph of itself.** The homepage hero previously
   carried `/band.svg` — a drawn stick figure captioned as though it were
   documentary — and the image column was removed rather than restyled, so the
   hero is now type-led. That is a deliberate holding position, not the finished
   state: a real photograph of the room, a recital or the 1982 sign would earn
   the column back. `/band.svg` is still in `public/` and still referenced
   nowhere else.
6. **The footer's social links point at `#`.** The marks are real; the
   destinations are not.
