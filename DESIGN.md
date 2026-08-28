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

This system replaced its predecessor wholesale on 2026-08-28. That world was cream ground, high-contrast slab serif, one warm orange — the look AI-generated interfaces converge on regardless of subject — and it produced a page with no loud element anywhere on it: the largest, brightest thing on a homepage selling rock and roll was a small button. The replacement's first obligation is energy.

**Key Characteristics:**

- **Three grounds, three jobs.** Flare field for the loud moments, lacquer for the bands, label stock for anything anyone reads.
- **Two faces, sharply divided.** Condensed signage type shouts, Franklin Gothic reads. Neither does the other's job.
- **Surface or ink.** Every accent is one or the other, decided by measurement rather than taste.
- **Corners, not curves.** A printed label and a signage panel have edges; radii top out at 4px.
- **Two worlds ship.** The previous design is preserved and switchable.

## Colors

The strategy is **committed**: one saturated colour owns whole regions rather than accenting a neutral ground. Flare covers the homepage's opening and closing viewports outright.

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

- **Poster** (Big Shoulders 800, `clamp(58px, 11.5vw, 158px)`, `-0.03em`, uppercase): the homepage field only. Line height goes under 1 because condensed caps have short extenders and the stack should read as one block of lettering.
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

**The list drifted once already, which is the thing to watch.** It was written naming four roles and the stylesheet reached ten without the sentence changing — every addition individually defensible, none of them checked against the rule that was supposed to bound them. That is precisely the quiet widening the exception exists to prevent, so adding a fluid role means adding a row here in the same commit.

**The 0.22em Rule.** Small uppercase labels are tracked at `0.22em`, and it is a signature rather than a coincidence. Poster and display type track *negative* (`-0.03em`): the direction reverses with size.

## Layout

Three measures do the entire site: **1200px** wide grid, **900px** reading column, **520px** forms. Every container carries 24px of side padding at every width.

**Page headers are left-aligned.** A centred banner over a centred intro is the arrangement every school site ships, and condensed poster type needs a left edge to push against — centring it wastes the one thing the face is good at.

Breakpoints: **940px** (nav collapses to the drawer), **860px** (multi-column grids collapse, the CTA watermark hides), **720px**, **560px** (six-up grids go two-up).

**The Three Grounds Rule.** Every section is a field, a border band, or label stock. The homepage runs field → band → lacquer → label → label → sand → field, and no two adjacent sections share a topology. An arrangement that is none of the three is a sign the section has not been designed yet.

**The Field Is Rationed Rule.** The flare field belongs to the homepage's opening and closing viewports. Inner pages get lacquer headers with a flare *rule* instead. If all nineteen routes opened on full red, the homepage would stop being the loud one and the site would be back to every band looking alike — the fault this system was built to fix.

## Elevation & Depth

Depth is nearly absent by design: this is printed matter, and printed matter does not float. There is exactly one shadow.

- **Card lift** (`0 22px 44px -22px rgba(90, 40, 70, 0.45)`): hover only, warm-tinted, with a real offset and a soft blur.

Separation is carried by ground changes and 1px edges instead. A resting surface never gets a shadow to make it feel separated.

Motion is short and few: `0.16s ease` for colour and border changes, `0.18s ease` for transform and filter, `0.2s ease` for the instrument marks' accent. Interactive lifts run `translateY(-2px)` to `translateY(-5px)`. Everything transform-based is disabled under `prefers-reduced-motion`.

## Shapes

**The wave.** The signature edge — a single cubic (`M0,40 C360,80 1080,0 1440,40`) drawn as a positioned SVG so a band can carry one at its top, foot or both; the top copy is flipped on Y. It is the one shape the system reuses everywhere, and it survived the redesign with a changed job: it was the seam between dark bands and paper, and it is now the seam where the print stops.

**Radii are small.** 3px buttons and fields, 4px panels, 999px for the auth submit pill only. Tags are square. A printed garment label and a signage panel have corners; rounding everything was the friendly-SaaS reflex the previous world never questioned.

**The No Accent Border On A Radius Rule.** A thick coloured rule curving around a corner reads as a mistake at every size. When the two conflict the corner goes: the tag's 5px flare rule is why tags are square.

## Components

- **Button** — five variants. `primary` (Flare Action, white), `field` (Lacquer, for use on the flare ground, because red on red is not a button), `secondary` (white, ink, 1px line), `danger` (secondary with flare-ink text), `quiet` (a text link with a 1.5px underline). Sizes md `15px 32px`, sm `10px 18px`, xs `7px 12px`. Solid variants lift 2px and brighten 4% on hover; `quiet` does not lift, because a text link rising off its own underline reads as a glitch.
- **Tag** — the replacement for a row of equal rounded cards. Label stock, 1px edge, square, and a 5px flare rule across the top where a sewn tag carries its band of colour. The rule is what makes a row read as one set rather than three boxes. `.rw-tag-link` makes the whole panel the target.
- **Field** — full-bleed flare carrying the motif repeat and poster type. Type on it is lacquer, never white.
- **Border band** — lacquer, carrying the offer: both products named, both actions, and the price.
- **Page header** — lacquer, left-aligned, flare rule above a gold label, poster-scale title, 54ch lead, wave at the foot.
- **Nav** — sticky, lacquer at 90% with a 14px backdrop blur, gold active link with a 2px inset underline, chrome wordmark. Seven `--rw-nav-*` tokens so it inverts with the world.
- **Instrument marks** — six drawn SVGs, butt caps and miter joins, one accent per mark placed where the sound comes out. The flat terminals were chosen to match the display face's blunt terminals; Big Shoulders shares that trait, so the rationale survived the type change.
- **The motif repeat** — the six marks tiled behind the field at ≤9% opacity. Decoration only, `aria-hidden`, and it never carries meaning the copy does not also carry.
- **Skip link** — first focusable element, solid Flare Action, off-canvas until focused, targeting `#main` which carries `tabIndex={-1}`. Styled on `:focus`, **not** `:focus-visible`: focus-visible is a heuristic, and a skip link the heuristic declines to reveal is a control that silently does not exist.
- **World switch** — a two-option radiogroup in the footer writing `data-world` on `<html>`.

**The Focus Ring Rule.** A 2px Lagoon outline at 2px offset on every interactive element, form fields included. The skip link is the only element that uses `:focus` instead of `:focus-visible`.

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

## Accessibility floor

Non-negotiable, and verified by measuring rendered pages rather than reading source:

- Body and small text ≥4.5:1, large text ≥3:1, focus rings and UI edges ≥3:1 — checked against the ground the element actually sits on, including alternate bands.
- Interactive controls ≥44×44, except inline links inside running prose.
- The skip link is the first focusable element on every page.

Headless browsers report no window focus, so `:focus` never matches and focus states read as broken. Enable CDP focus emulation before concluding a focus style is missing.

## Known state, not prescription

1. **The school has no photograph of itself.** The type-led design is a deliberate holding position, not the finished state. A real photograph of the room, a recital or the 1982 sign would change what this system should do with imagery.
2. **The footer's three social links point at `#`.** The marks are real; the destinations are not.
3. **Five public routes keep their previous body compositions** — `/program/curriculum`, `/program/how-it-works`, `/community/events`, `/community/alumni` and the legal pages. They inherit the header, palette, type and radii, so they are consistent, but their interiors have not been rethought.
4. **`Card` and `Prose` primitives exist and are still barely adopted.** Pages hand-roll both. New work should use the primitives.
5. **Labels above headings are used throughout** (`SectionHead`, the page header, `.rw-field-tag`). Recorded as what the build does, **not** as a pattern to reach for: a kicker above a heading is a device to justify each time, and a new section should first ask whether the heading can carry its own weight.
