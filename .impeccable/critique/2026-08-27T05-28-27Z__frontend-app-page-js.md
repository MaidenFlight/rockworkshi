---
target: homepage
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-27T05-28-27Z
slug: frontend-app-page-js
---
**Method: dual-agent** (A: design review · B: detector + browser evidence, run isolated and in parallel; neither saw the other's output)

# Critique — Rock Works homepage

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Hover/active/focus states are correct, but six instrument tiles promise six destinations and deliver one |
| 2 | Match System / Real World | 2 | "Start Lessons" goes to `/signup`, which sells member-area *access* — lessons are arranged by conversation and deliberately never priced |
| 3 | User Control and Freedom | 3 | Nothing traps, but the last three links before the CTA point *off* the page, two to the same place |
| 4 | Consistency and Standards | 2 | Levels band skips the `SectionHead` pattern and the signature wave; two 3-col rows misalign by 34px; six off-scale type sizes |
| 5 | Error Prevention | 2 | A visitor can click into paid signup having never seen a price, a plan, or the access-vs-teaching distinction |
| 6 | Recognition Rather Than Recall | 3 | Levels are named *and* described in place; but price lives only behind a hover dropdown |
| 7 | Flexibility and Efficiency | 3 | Primary + quiet secondary is right; no in-body path for the ready-to-decide visitor — the trial is nav-only |
| 8 | Aesthetic and Minimalist Design | 2 | Stick-figure hero, 400px orange wash, clipped caption chip, watermark smudging the mobile headline |
| 9 | Error Recovery | 2 | Three `href="#"` social links focus and announce as links but do nothing; alt text describes a photo that doesn't exist |
| 10 | Help and Documentation | 2 | Answers none of: what it costs, where it is, do I need my own instrument, can I try first |
| **Total** | | **24/40** | **Below average — real voice, unfinished body** |

All ten scored as applicable. On a Persuade surface #7 and #10 are often `n/a`, but here the visitor's unanswered questions *are* the conversion, so they count.

## Design Specificity Verdict

**LLM assessment:** partly authored, and the authored parts are outnumbered. Three things could only belong to this school — the five-levels band, the six instrument marks, and the type voice with its single gold italic. Everything else re-skins onto a bootcamp or a gym by swapping nouns.

The headline problem is **structural sameness**. Strip the copy and the page is: dark hero -> row of 3 -> row of 6 -> row of 5 -> row of 3 -> centered dark CTA. Every section between hero and CTA is a horizontal row of equal columns divided by hairlines. No asymmetry, no change of measure, no full-bleed moment, no image after the hero. The value-props row and the audience row are *the same component built twice*, 900px apart. The reader learns the page's one move by the second screen and coasts.

The one bespoke composition is buried at section four, 1,357px down — the only dark band on the page that doesn't get the signature wave.

**Deterministic scan:** the CLI detector returned **0 findings** across both the homepage import set and the full 67-file tree — clean, and verified as a real rule engine rather than a stub. The in-page browser detector, running against live computed styles, returned **25 findings** the static scan structurally cannot see. That gap is the story: this page's problems are in rendered values, not in source patterns.

Confirmed real from the browser pass: `skipped-heading` (H1 -> three H3s before the first H2), `undersized-ui-text` at 10.5px and 8.5px, `clipped-overflow-container`, and four contrast failures.

**Called as false positives:** `cream-palette` flagging the cream ground and `ai-color-palette` flagging "cyan gradient" both fire on the committed world — that palette and that ink->teal gradient are the documented design system, not drift. The reported **1.90:1 sea-glass-on-orange** is wrong: sampling the real pixels behind the hero eyebrow gives `rgb(7,32,52)` for **9.81:1**. The detector took the section's final gradient stop instead of the backdrop under the element.

**No visual overlay is available** — injection ran headless in a throwaway browser, so there is nothing to look at in the user's own Chrome.

**Where the detector beat the review:** Assessment A flagged two contrast failures and missed the biggest one. White on Lava Orange is **3.57:1** at 16px/700 — the primary button on every page of the site, including checkout.

## Overall Impression

The page has a voice but not a body. It knows how to *sound* like this school and doesn't yet know how to *behave* like it. The hero headline is genuinely good and lands in under a second — then the eye moves right into a stick figure, and the emotional read flips from "serious school" to "unfinished." The single biggest opportunity is that the page's best asset, the five-levels band, is section four and unmarked, while its most valuable pixels go to a claim anyone could make.

## What's Working

**The five-levels band argues with layout instead of listing.** The hairline is drawn per-item across each gap rather than as one line behind the row, so the composition itself says *one path, five passes, one song*. On mobile it rotates into a vertical spine — same argument, not a degraded fallback. Contrast measures 9.75:1 for the numerals and 4.80:1 for descriptions even at the gradient's lit end.

**The typographic voice does the brand work the imagery doesn't.** 82px Zilla Slab on warm paper with the italic used *exactly once*. An italic appearing twice would be a style; once, it's a moment.

**The evidence discipline is visible in the source.** Fabricated proof removed rather than restyled, with a documented empty slot warning against refilling it with invention.

## Priority Issues

**[P0] The primary CTA asks for money the page never priced.** "Start Lessons" and "Sign Up Now" both reach `/signup` -> account -> payment. The page states no price, no plan, and never distinguishes member-area access from actual lessons — which per the product record are arranged by conversation and deliberately unpriced. A visitor clicks a button labeled "Start Lessons," and discovers both a price they never saw and a different product. That sequence produces refund requests, and the site is taking cards today.
*Fix:* rename the hero primary to what it does; add "$55/month, cancel any time · or $135 a term" beside the closing CTA; one sentence distinguishing access from teaching.
*Suggested command:* `/impeccable clarify`

**[P1] The hero's largest element is a placeholder stick figure.** `/band.svg` is 300x113 natural, rendered at 613x462 desktop and 342x340 mobile — `object-fit: cover` cropping a wide drawing to nearly square. Captioned as documentary, with alt text describing a photograph that doesn't exist. Reads as unfinished *and* as cartoon — the confirmed "kids' app" rejection. Graded P1 rather than Assessment A's P0: it doesn't block completion, but it is the most damaging single element on the page.
*Fix:* until a real photo exists, delete the image column and give the hero one full-measure column.
*Suggested command:* `/impeccable layout`

**[P1] Six instrument tiles, one destination.** All six link to `/program/format` — confirmed in source. The page's most inviting interaction, and the moment a visitor first commits an intention. The click discards it. Screen-reader users get it louder: six differently-named links, one URL.
*Fix:* route to `/signup?instrument=Bass` — signup already stores that string, so the plumbing exists.
*Suggested command:* `/impeccable shape`

**[P1] Nothing stands between the last exits and the ask.** Removing the fabricated testimonials left: audience columns ending in three off-page links -> cold CTA. The page carries zero evidence of any kind. Removing the invented quotes was right; leaving the slot empty on a Persuade surface is not the finished state.
*Fix:* fill it with facts the school can stand behind — Est. 1982, the street address, six instruments, five levels, one song every 4-6 weeks, cancel any time. Move the trial into the CTA as the low-commitment neighbour.
*Suggested command:* `/impeccable bolder`

**[P2] Accessibility failures, measured.** Four AA contrast misses: **white on Lava Orange 3.57:1** (every primary button, needs 4.5), section eyebrows **3.80:1**, audience links **4.42:1**, meta captions **3.71:1**. Plus: H1->H3 heading skip; the mobile burger at **42x36** — the primary mobile control, under the 44px floor; footer social at 34x34; no skip link, so a keyboard user tabs **26 times** to reach the primary action.
*Suggested command:* `/impeccable audit`

**[P2] Orange has stopped meaning "act."** The hero gradient ends in a large orange field — orange as decorative background, which the system bans — and three orange elements share the first viewport. The documented threshold is "three means the page has no hierarchy."
*Fix:* end the hero gradient at the teal stop; one orange CTA per viewport.
*Suggested command:* `/impeccable quieter`

## Persona Red Flags

**The self-enrolling teenager** (the recorded primary user): the section whose job is to say *where you belong* opens with "Keiki (ages 5+) — built for little hands," addressed to a parent, in the first and most-read column. The stick figure confirms it. A 16-year-old has been told twice, in the two highest-attention slots, that this school is for children. The one thing that would land for them — "solo over the changes" — is 1,600px down in an unlabeled band.

**The "just tell me the price" skimmer:** scrolls 2,852px and finds four numbers, none of them dollars. No address. Pricing is a child of a hover dropdown. Hits an unpriced "Sign Up Now" and reads it as a trap — bouncing at the worst possible place.

**The skeptical evaluator:** zero third-party evidence. The boldest claim on the page — "we can tell you exactly where you'll be in 10 years" — has no artifact behind it. The one photograph is a stick drawing, which reads as *this school cannot produce a single image of itself*. Then they click Instagram and nothing happens.

## Minor Observations

- **34px misalignment**, confirmed by arithmetic: section headings start at x=144 (1200 container + 24 padding), audience columns at x=178 (extra 34px inset).
- **`fontWeight: 560`** on the value-prop headings — Zilla Slab ships discrete 500/600/700, so this snaps to 500 while the identical-looking audience headings next door are 600.
- **Hero eyebrow uses `0.24em`** — a third tracking value beside the sanctioned 0.22em and 0.16em.
- Six off-scale type sizes: 14.5, 15.5, 17.5, 19, 23, 52, 82px.
- Instrument tiles lift -5px inside an `overflow: hidden` parent, so the top of the lift is clipped.
- The 420px watermark lands dead-centre behind the mobile CTA headline as a grey smudge.
- `<title>` is "Rock Works School of Music" — no "Honolulu." Cheapest unused local-search signal there is.
- Console clean, network clean: 114 requests, zero failures, zero errors.
- `prefers-reduced-motion` is handled correctly throughout.

## Questions to Consider

1. If the five-levels band is the one thing a competitor couldn't truthfully copy, **why is it section four?** What would this page be if the method *were* the hero?
2. The page offers four ways to begin above the fold and prices none. If you could keep **exactly one action**, which would a cold Honolulu sixteen-year-old actually take?
3. With the invented proof gone, **what real proof does the school already own that nobody has photographed?** The room. A recital flyer. A wall of song sheets. The 1982 sign.
4. Every section between hero and CTA is a row of equal columns. If **exactly one** were allowed to break the grid, which earns it — and what does the obviousness of the answer say about the other three?
