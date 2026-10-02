---
timestamp: 2026-08-28T14-26-28Z
slug: rockworksschoolofmusichawaii-com
---
---
target: public site (19 routes, 10 reviewed)
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-28T00-00-00Z
slug: rockworksschoolofmusichawaii-com
---
**Method: dual-agent** (A: design review · B: detector + browser evidence, run isolated and in parallel; neither saw the other's output, neither inherited the build session)

# Critique — Rock Works public site (19 routes, 10 reviewed)

Scope note: the prior snapshot scored **24/40 on the homepage alone**, under the previous visual world. This run scores **19/40 across ten routes** of the current one. These are not comparable and the drop is not a regression signal — the earlier number never looked at /trial, /contact, /signup, /song-library or /teachers, which is where this run found the damage.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Signup stepper shows 4 steps; the real gate adds verification and payment — told 4-from-done at 6 |
| 2 | Match System / Real World | 3 | Voice is genuinely local; "Format & Pricing" prices membership while the formats it names carry none |
| 3 | User Control and Freedom | 1 | Song detail changes no URL — Back exits the site; /program/format has zero links or buttons in main |
| 4 | Consistency and Standards | 2 | Three form languages; radii 3/4/7/8/14/50%/999px against a documented 4px cap; the retired world's tokens still live |
| 5 | Error Prevention | 2 | Signup does this well; /trial marks nothing required or optional across 8 fields |
| 6 | Recognition Rather Than Recall | 2 | Guitar/bass/ukulele marks read as one silhouette; price absent from signup step 1 |
| 7 | Flexibility and Efficiency | 2 | Search + filters over a corpus of three songs; no route from reading the price to paying it |
| 8 | Aesthetic and Minimalist Design | 3 | Strongest axis; held down by kickers as default and three undesigned form pages |
| 9 | Error Recovery | 1 | /trial and /contact have no error design — native OS bubbles; "Could not reach the API" shown to users |
| 10 | Help and Documentation | 1 | Three FAQs, none about money; /contact has no phone, address or hours for a physical school |
| **Total** | | **19/40** | **Poor — an authored homepage on a generic template site** |

## Design Specificity Verdict

**The homepage is authored. Almost nothing else is.**

Assessment A's judgment, formed before any detector output: the Silkie homepage could not be lifted by another business — the flare field, the tiled instrument motif, the wave seam, the tag rule, the record spec table are decisions. Then authorship stops at the page header. /trial, /contact and /signup — where money and commitment happen — are a 520px card with a resting shadow, native OS selects and a pill button on a neutral ground. /trial is 100% inline styles and touches not one system class.

**Deterministic scan agreed, and explained why nobody had noticed.** The commanded detector returns 0 findings on this repo — not because the code is clean, but because `findDesignRoot()` stops at the first project-root marker, and `frontend/package.json` is one. DESIGN.md sits one level above that barrier, so every `design-system-*` rule silently abstains for every file under `frontend/`. With DESIGN.md made reachable: **92 findings** (80 colour, 11 font-size, 1 radius). Heaviest live files: `app/on-stage/page.js` (10), `app/song-library/page.js` (9), `app/onboarding/payment/page.js` (7).

Both assessments landed on the same place from opposite directions: **the retired design is still running inside the default world**, concentrated in the song library.

## Overall Impression

The redesign is real and it is good where it was done. It was not done where it counts. Every page a visitor passes through *before* deciding is authored; every page they touch *while* deciding is a template. The single biggest opportunity is not more design — it is finishing the four surfaces that take money.

## What's Working

1. **The three-grounds rule holds.** Field to lacquer to label stock to page to field, no two adjacent sections sharing a topology, the wave cutting each seam. Legible without being explainable, which is what composition is supposed to be.
2. **The record spec table persuades by refusing to persuade.** Six verifiable structural facts where invented statistics used to be. For a school with no confirmed outcome data this is both the honest move and the more convincing one.
3. **The measured foundations are sound.** Zero horizontal overflow across 26 page/viewport/world runs. 295/295 interactive elements show a visible focus ring. Contrast on the flare ground is correct (5.06:1 lacquer, 3.14:1 for the 158px white line, properly reserved for display type).

## Priority Issues

**[P0] Three fabricated teachers are live on a site taking card payments.**
Kalani Akana, Maya Reyes and Ben Torres are `published: true` in the production database with invented biographies and years of experience. PRODUCT.md names them explicitly as not real. Linked from every footer and the About menu. Inventing named humans who teach children is categorically worse than placeholder copy: if a parent later learns no such teacher exists, every other claim on the site becomes retroactively suspect.
Fix: unpublish the three records in the admin. Bring the page back only with real names. Fastest path is three toggles, not a rewrite.
Command: none — this is data, not design.

**[P1] The pricing page is a dead end at the moment of maximum intent.**
Verified independently in the live DOM: `/program/format` contains **0 anchors and 0 buttons** inside `<main>`. A visitor who has just read "$55/month" has nothing to click. Compounding it, the title promises "Format & Pricing" while the three formats carry no prices and the only prices shown belong to a different product — inviting exactly the membership/lessons confusion PRODUCT.md exists to prevent.
Fix: a primary "Join the member area" in each price card, "Book a free trial" beneath, and one sentence stating plainly that membership is the online library and lesson fees are arranged separately.
Command: /impeccable clarify, then /impeccable shape

**[P1] The retired world is still running inside the live one, and it is producing real failures.**
The song library renders `--rw-teal`, a gradient badge, 7px radii and hardcoded `#8a7d86` / `#7a6d78` — a neutral grey the system explicitly forbids. Those two colours are the source of all four confirmed contrast failures: three song rows at **3.73:1** and the signup sign-in line at **4.09-4.27:1**, both under 4.5. Assessment B established these by decoding actual screenshot pixels, not by computing from CSS.
Fix: sweep song-library, on-stage and onboarding/payment onto tokens; they are 26 of the 92 findings between them.
Command: /impeccable polish

**[P2] The conversion surfaces have no design and no error design.**
/trial and /contact validate with the browser's native orange bubble, one field at a time, gone on click. /trial marks nothing required or optional across 8 fields. The API failure string shown to a teenager is "Could not reach the API." The trial success state — the peak-end anchor for the site's main conversion action — is one grey sentence with no timeframe, no "check your email", no phone number and none of the design system.
Fix: rebuild /trial as a Silkie surface with the inline error pattern /signup already has; write a real success state.
Command: /impeccable harden

**[P2] The song library is the flagship proof and it proves nothing.**
Three songs. Filter chips for 2 instruments and 2 levels against a product claiming 6 and 5. Rows are `<div>`s with `cursor:pointer` and no anchors — not keyboard reachable, not announced as controls. Clicking changes no URL, so Back exits the site and no song can be shared.
Fix: real routes rendered by anchors; hide filters until the corpus justifies them; one song-specific fact per level.
Command: /impeccable shape

## Process finding — the governance failed quietly, twice

Not a design issue, but it explains why the above survived.

1. **The detector has been blind on this repo the whole time.** Every "detector: zero findings" recorded in this project's history was measuring nothing for design-system rules. Root cause above; the workaround is to run it from a target path that resolves to the repo root, or place a DESIGN.md inside `frontend/`.
2. **The clamp-endpoint ignores are broader than what was approved.** Ten `ignoreValues` entries exist, each approved for a clamp *minimum*. But an ignore keyed on one value suppresses the **whole finding**, including the other endpoint nobody reviewed: **38px, 92px (x2), 84px, 44px, 200px and 40px are now invisible.** Nobody signed off on 200px. Three entries (20px, 158px, 44px) are stale and match nothing.
Fix: narrow or re-derive the ignore list, and treat "one ignore, one endpoint" as false.

## Persona Red Flags

**The teenager who signs themselves up (the recorded primary reader).** The hero speaks to them and gives them nothing to press — first control at y=769 on an 844px viewport, below the fold under Safari chrome. They tap "Book a Trial" into 8 unmarked fields including a short-answer essay, with no restatement that it is free or that the school provides the instrument. They tap the song library and find three songs.

**The parent paying for a child.** Three invented instructors. No phone number and no address anywhere on /contact for a physical school. An FAQ with three questions, none about price, cancellation or refunds. A signup asking a child's age and a minor-sponsor declaration with no privacy statement and no price on screen. The only money reassurance on the site is two words inside a price card, never repeated at payment.

**The first-timer.** The border band gives the *paid subscription* the loud red button and demotes the *free trial* to an underlined link — the funnel inverted. The "Lessons" menu contains Song Library, Format & Pricing and Music Tools, three items about membership filed under teaching. Nothing anywhere shows what the member area actually looks like.

## Minor Observations

- Signup renders the required asterisk on its own line below six labels — reads as a rendering fault.
- Heading skips h1 to h3 on /program/format and /signup.
- Exactly one rendered SVG per page has no `aria-hidden`, label, role or title — announced as an unlabeled graphic.
- Real sub-24px targets: footer email (17px), "See format & pricing" (18px), "How the Rock Band program works" (18px), "See the curriculum" (16px). These are standalone links, not prose, so the inline exemption does not cover them.
- Near-universal sub-44px touch targets: nav links 38px, footer links 31px, form inputs 39-42px, filter buttons 28px.
- **Payload: 453.6 KB, of which fonts are 196.3 KB — 43%.** Zilla Slab alone ships four static weights totalling **104.8 KB, 23% of the page**, on every cold load regardless of active world. That is what the design toggle actually costs, and it is roughly double what was estimated when it shipped.
- 88 RSC prefetch round trips on the homepage.
- /faq, /song-library and /contact have page headers with no lead paragraph, leaving an empty dark band.
- rock-band-program lists five instruments, dropping ukulele from a six-item set PRODUCT.md calls load-bearing.
- Copyright reads 2026 on a site whose headline claim is 1982.
- 30 of 34 naive contrast flags were measurement artifacts; the wordmark's `background-clip:text` accounts for 13 of them and is not a failure.

## Questions to Consider

1. The homepage sells a stage and the site has never shown one. What if the highest-value action is not design at all, but one blurry phone photo of a kid on a Hawaii stage?
2. What is the free trial actually for? It is an 8-field form ending in "we'll be in touch." Should it instead show three bookable slots this week?
3. Would the site be better with half as many routes — home, the method, the band, price, book — each finished to the homepage's standard?
4. The best thing here is the record table, and it works because it refuses to persuade. What happens if that logic runs the whole site?
5. The world toggle asks a visitor to have an opinion about the school's identity, and occupies the footer slot where a phone number should be. Is it a product feature or a decision that has not been made?
