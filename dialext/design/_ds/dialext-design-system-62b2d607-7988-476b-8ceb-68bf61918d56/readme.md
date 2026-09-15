# Dialext Design System

Dialext is a multilingual AI meeting assistant for organisations, beginning with Irish–English conversations. It turns meetings into clear summaries, minutes, transcripts and searchable organisational knowledge. Brand idea: **Many voices. Shared understanding.** Strategic vision: **Organisational fluency.**

## Sources

- `uploads/Dialext_Design_System_Specification.md` — primary source of truth (brand, visual direction, product principles, component inventory, content rules). 1,849 lines; consult directly for anything not summarised below.
- `dialext-design-export/` (mounted codebase, read-only) — `web-app/client/index.html` + `styles.css`: the current production app shell (upload, recordings list, recording detail, transcript, notes, uncertainty review, correction form). Structurally authoritative; visually superseded by this system. `EXPORT-MANIFEST.md` notes source commit `a83b2286` and that this is a presentation subset, not a runnable app.
- Licensed photography in `uploads/` (cyanotypes, pictorialist prints, Irish/Atlantic landscape and texture shots) — curated into `assets/photography/`.
- No Figma file, logo, or icon library was provided.

## Content fundamentals

Voice: **plain, confident, helpful, human, specific** — never poetic, never inflated ("magic", "effortless", "revolutionary" are out). Sentence case everywhere (headings, buttons, labels, nav). No exclamation marks, no emoji.

Lead with the user's task, not the technology: `Record`, `Upload`, `Review`, `Share`, `Export` — familiar verbs, one primary action per screen region. State which language, meeting or group an action affects. Don't hide uncertainty behind confident language.

Preferred terms (use / avoid): Meeting *(not* session/event\*)*, Summary (not* insight digest)*, Minutes (not* smart notes)*, Transcript (not* raw text)*, Original audio (not* source media)*, Translation (not* converted text)*, Generated summary (not* AI magic)*, Review (not* validate)*, Speaker (not* participant entity)\*, Language *(not* locale, unless technical).

Examples of the voice in practice:

> No meetings yet. Record or upload a meeting to create your first summary. Irish and English were detected in this meeting. This passage may need review. The translation could not be completed. Your original transcript is safe. Try again, or continue reviewing it in Irish.

Never: "Let your voices take flight." / "AI-powered multilingual magic." / "The system has generated linguistic artefacts."

Errors always answer: what happened, what was affected, what to do next, is the user's work safe.

## Visual foundations

**The governing rule: character in the content layer, discipline in the controls.** Dialext should read like a well-kept multilingual record — printed on, annotated, stamped, filed — not like a pristine SaaS kit. Grain, uneven crops, drawn rules, marginal labels and a second ink belong to surfaces, covers, imagery and metadata. Buttons, inputs, focus rings, transcript text and status all stay reliable rectangles with obvious states. Imperfection is *noise*, deliberately placed; it is never allowed to read as *error*. If a treatment could be mistaken for a rendering fault or make a control ambiguous, it does not ship.

**The living record.** Dialext does not begin with a document; it begins with people speaking. Its visual language holds two states at once: the irregular rhythm of live multilingual conversation, and the clarity of a well-kept shared record. Imperfect treatments represent voice, interpretation and human trace. Alignment, indexing and clean reading surfaces represent understanding. Neither should dominate the other — a view that is all grain and stamps reads as an archive, and a view that is all grid reads as generic software.

**The central mechanism: parallel voices resolving into alignment.** "Many voices. Shared understanding." is a visual move, not a tagline. Express it through: staggered origins settling onto a shared baseline (`--voice-offset-3 → -1 → -resolved`, 18→10→4→0px); two typographic layers — original and translation — sharing one baseline and one leading mark rather than being boxed apart; transcript fragments gathering into a structured summary; speech rhythm becoming a rule, an index or a numbered label. Voices are distinguished by a 2px leading mark (`--voice-mark-a/b/c`) plus a name — never by colour alone, never by a flag. Origin stays visible after alignment: the record shows where each line came from.

**Colour.** One warm, imperfect neutral: paper (`#F4F2EC`), laid down as an uneven wash (`--paper-wash`) rather than a flat fill, with clean near-white reading surfaces (`#FCFCFA`) where text density demands it. Two inks carry the brand: Cyanotype blue (`#245F80`) over Deep Atlantic (`#163D54`) for structure, depth and primary action — and a warm counter-ink, Oxide (`#8C4A2F`), for annotation, emphasis, editorial rules and captions, with Ochre (`#C08A2C`) as the third, sparing hit. Oxide and Ochre are *expressive*, not functional: they never carry status. Signal Blue (`#397FA3`) marks live/interactive state (focus, linked audio). Functional colour (success/warning/error/info/recording) is reserved for meaning only, never decoration. See `tokens/colors.css`.

**Colour contrast rules for the new inks.** Measured against near-white/paper: Deep Atlantic 11.17:1 (anything), Cyanotype 6.76:1 (links, text, small marks), Oxide 5.98:1 (normal text, captions, fine rules — passes AA), Signal Blue 4.31:1 (**focus rings, borders and large text only** — below 4.5:1, so not for normal-size body text), Ochre 2.71:1 (**large decorative marks, fills and accents only** — never captions, never small text, never the sole carrier of information).

**How to test contrast on a material surface.** The flat token is the starting value, not the answer. A textured or tonally-washed surface must be tested against the **actual composited surface at its worst local contrast point** — the lightest bloom of a pigment cloud under light text, the darkest halftone cluster under dark text — not against the flat fallback and not against the average. Where the material treatment cannot hold WCAG 2.2 AA at that worst point, drop to the flat fallback (`--paper-flat`, `--paper-flat-ink`) for that surface, or move the text onto a solid plate. Texture is removed entirely in forced-colours and high-contrast modes (`@media (forced-colors: active), (prefers-contrast: more)` in `tokens/texture.css` zeroes the ladder and flattens the washes), so no layout may depend on a texture being present.

**Type.** Instrument Sans throughout the information-dense product (nav, transcripts, controls, tables, metadata). Source Serif 4 is *not* marketing-only — it enters low-density product moments where reading slows down: meeting and report titles, collection introductions, empty-state headings, a summary's opening line, and quoted source passages tied to transcript evidence. It stays away from controls, transcript bodies and dense metadata; the product should never look like publishing software. Beyond that, four character roles carry the editorial voice (`tokens/typography.css`): `--text-annotation` (Instrument Sans italic, for human notes and interpretation), `--text-marginal` (12px marginal labels, 17px line height), `--text-meta-caps` (letter-spaced uppercase metadata, used sparingly — and **not** applied where uppercasing or tracking is wrong for the language or script being displayed; Irish text with diacritics, and any future non-Latin script, render in sentence case at normal tracking instead), and `--text-record-num` (mono numbered record headings, e.g. `014 /`). Type scale runs from 12px marginal to 64px display; body copy sits at 16px/1.5. Tabular numerals for timestamps. No product text below 12px anywhere.

**Spacing & layout.** 4px base unit, 8px rhythm (`tokens/spacing.css`). Desktop app shell: 240–272px nav, flexible main column, optional 320–400px context panel, max reading width 760–880px, workspace up to 1440px. Whitespace and hierarchy establish grouping before a container does; nested cards never go more than one level deep.

**Shape.** Small radii throughout — 4px (tags, compact controls), 8px (inputs, buttons, cards), 12px (dialogs, sheets), full/999px only for avatars, status dots and true pills (never a default control shape). Radii stay tight on purpose: the softness in this system comes from paper and ink, not from rounding. Rules do two different jobs, and the distinction is technical as well as visual: **functional dividers are a crisp 1px** (`--rule-functional`) so they render identically at every device-pixel ratio, while **editorial rules are 2px** (`--rule-editorial`) or the drawn graphic (`--rule-editorial-graphic`, an SVG used as a background/mask). Never a fractional border — 1.5px blurs. Never an irregular treatment on a line that defines a clickable boundary. 2px also marks selected/focused states, where no layout shift occurs.

**Elevation.** Shadows are almost absent. Layering is done with rules, ink weight and surface tint; the three tinted Deep Atlantic steps exist for genuine overlays only (dialogs, sheets). For anything sitting *on* the page, use `--ink-bleed` — a 1px printed-on edge — rather than a float. Nothing in this system floats merely to appear important.

**Material library.** The generated noise layer stays as a fallback, but the real material comes from a curated texture set in `assets/textures/`, exposed as purpose-named tokens in `tokens/materials.css`: `surface-tooth` (neutral tooth for paper, reading surfaces, cards), `fibre-soft` (fabric fibre for panels, nav, chrome), `pigment-cloud` (the primary ink/pigment mask for Cyanotype, Deep Atlantic, Oxide), `halftone-open` (primary halftone for Oxide/Ochre accents, covers, empty states), `halftone-radial` (assertive halftone, campaigns only), `strata-soft` (quiet atmospheric layer for canvas and dark surfaces), `onyx-flow` (abstract alignment/flow strata), `strata-flow` (strongest expressive texture — hero and campaign only), `wet-sheen` (secondary light/water mask), `cyanotype-fibre` (small inverse panels and cover details), `pigment-fibre` (dense blue pigment field for covers and masks).

**Texture provenance.** Every token maps to a file you supplied — nothing here is generated or substituted:

| Token | Source file |
| --- | --- |
| `surface-tooth` | `Concrete042A_1K-JPG_AmbientOcclusion.jpg` |
| `fibre-soft` | `Fabric066_2K-JPG_Roughness.jpg` (your brief's "softer fibre layer") |
| `pigment-cloud` | `ink-wash-cloud.jpg` |
| `halftone-open` | `halftone-cloud-open.jpg` |
| `halftone-radial` | `halftone-radial-wide.jpg` |
| `strata-soft` | `stone-strata-soft.jpg` |
| `strata-flow` | `stone-strata-fluid.jpg` |
| `onyx-flow` | `Onyx011_2K-JPG_Displacement.jpg` |
| `wet-sheen` | `stone-wet-sheen.jpg` |
| `cyanotype-fibre` | `cyanotype-weave-fabric.jpg` |
| `pigment-fibre` | `paper-fibre-dense.png` |

Excluded as technical data, per your brief: `Concrete042A_1K-JPG_NormalDX.jpg`, `Fabric066_2K-JPG_NormalGL.jpg`, and the remaining alternate PBR maps.

**How the material is applied in code** (`tokens/surfaces.css`). Add a material class and set `--mat-base` to the surface's own colour: `<div class="dlx-mat dlx-mat-panel" style="--mat-base:var(--surface-raised)">`. The texture blends with `--mat-base` — multiply on light grounds so only the tooth and speckle darken it, overlay on inked and saturated grounds so hue is preserved — then a veil of `--mat-base` pulls it back to strength. It is a background layer beneath content, never an overlay on text. Classes: `dlx-mat-reading` (transcripts, notes, translations), `dlx-mat-panel` / `dlx-mat-fibre` / `dlx-mat-tooth` (cards, rows, panels), `dlx-mat-ambient` / `dlx-mat-strata` (app canvas, navigation, chrome), `dlx-mat-ink` / `dlx-mat-cyanotype` / `dlx-mat-pigment-fibre` (Cyanotype and Deep Atlantic fields, generated content, inverse panels), `dlx-mat-control` (buttons and segmented controls, capped at the reading step so a control never fights its label), `dlx-mat-expressive` / `dlx-mat-halftone` / `dlx-mat-onyx` / `dlx-mat-sheen` (covers, onboarding, authentication, campaign), `dlx-mat-none`. Applied in the system to Card, Dialog, Sheet, Button (primary and secondary), AudioPlayer, OriginalTranslationControl, SummaryBlock, TranscriptSegment (selected passage and translation surface), EmptyState, the app canvas and the navigation rail.

**Calibration note.** `--mat-strength` on each class is the *rendered* composite value, not the literal ladder percentage — the source textures are low-contrast high-key greys, so a literal 2.5% composite is invisible. Each class is tuned so its **perceived** intensity lands on its ladder step; the ladder governs perceived order and relative volume, not raw alpha.

**One intensity ladder.** Every treatment in the system — bitmap or generated — resolves to one of five steps, defined once in `tokens/texture.css`: `--texture-controls` 0, `--texture-reading` 1.2% (a maximum, not a target), `--texture-surface` 2.5%, `--texture-ambient` 5%, `--texture-expressive` 11% up to `--texture-expressive-max` 14%. The older `--grain-*` names are aliases onto this ladder, not a parallel scale. **Generated noise (`--texture-grain`) is a fallback for a missing asset texture, not an additional default layer** — do not stack generated grain and a bitmap texture unless a specific treatment explicitly requires it. Percentages are starting points, tuned per texture by visual density since each source has different contrast. Textures are recoloured through the solid tokens (multiply for warm inks, overlay for the blues and darks) rather than shown as raw grey; the source PBR maps are technical data and never used as design textures. One texture on a reading surface, one or two on ambient, two on expressive. Texture is always a separate layer beneath content: never reduce the opacity of a surface, and never texture a control, input, focus ring, recording indicator or status fill.

**Texture performance and delivery.** Production ships flattened derivatives only, never the source library: provide **WebP** (and AVIF where supported) versions of every texture, with the JPEG/PNG source kept out of the browser bundle. Maximum shipped dimensions 1600px on the long edge for expressive/cover assets and 1024px for surface and reading textures, target ≤120KB each (≤60KB for surface/reading tiles). Provide mobile variants at half dimensions and serve them via `srcset`/`image-set()`. Lazy-load expressive assets (covers, hero, campaign) — they must never block first paint; surface and reading textures are small enough to load eagerly. **Never ship normal, displacement, roughness or ambient-occlusion source maps to the browser** — they are authoring inputs, and the flattened result is what belongs in the bundle. Every textured surface declares a flat-colour fallback so the layout is complete and legible before, or without, the texture.

**Texture.** Texture is a material, not decoration, and it is present far more than in a typical product system — just at controlled volumes, all of them from the single ladder above: expressive (11–14%) on covers, campaign and editorial surfaces; surface (2.5%) on panels, cards and list surfaces; reading (1.2% maximum) on long-form reading surfaces; controls 0. `--texture-halftone` and `--texture-grain` are the generated fallbacks for cyanotype-adjacent moments when no asset texture is available. Hard limits: never above reading level behind transcript body text, never stacked with blur or vignette, no torn-paper or film-damage effects, and texture never animates.

**Where character is permitted.** Treatments map to contexts, so neither the grain nor the discipline drifts:

| Context | Permitted character |
| --- | --- |
| Transcript, forms, tables | Clean surface; no artifacts, no grain above reading level |
| Meeting summary | Reading grain + one editorial rule or marginal label |
| Recordings list | Surface grain; occasional numbered record label |
| Navigation | Paper wash or faint surface grain only |
| Empty state | Photography, crop offset, serif heading or cyanotype artifact |
| Onboarding / authentication | Full expressive treatment |
| Report / export cover | Photography, stamps, rules, brand-level grain |
| Dialogs, permissions, errors | Functional treatment only — no artifacts |

**Artifacts.** The system supplies real record-keeping objects instead of decorative ornament: numbered labels, editorial stamps set at `--stamp-rotate` (−2.4°), image captions in Oxide, marginal metadata, deliberate off-register crops via `--crop-offset` (6px), and drawn rules. One or two per view, not a running pattern, and never on a control, a form, or anything a user must click accurately.

**Stamps are not statuses.** Two separate vocabularies, and they must not blur: *editorial stamps* are documentary labels — `Record 014`, `Reviewed`, a report date — rotated, Oxide, decorative. *Functional statuses* — recording, processing, failed, restricted, complete — always render through the semantic status components, upright, in functional colour, with a text label. Never rotate or distress a functional status, and keep Oxide annotation away from anything immediately adjacent to an error or warning, where a warm rotated mark would be misread as a failure.

**Imagery.** Documentary and human — real multilingual meetings, listening and speaking, microphones and shared tables — never posed corporate teams or generic headset stock. Crops are cropped like a picture editor's: tight, slightly off-centre, sometimes cutting the subject, offset from the frame rather than centred inside it. The licensed pictorialist and landscape photography is **usable directly** in its approved contexts — campaign and editorial compositions, report and export covers, onboarding and authentication, empty states, cropped brand details, atmospheric overlays and image-edge treatments — not reference-only material to be paraphrased. Cyanotype treatment stays a *selective* brand signature (campaign covers, launch material) rather than a filter over every photo, and no photography sits behind working transcripts. Pictorialist softness and grain carry the mood; product typography and controls stay sharp regardless. Irish landscape supports origin-story and cultural moments and is used deliberately in them; it is not the universal product backdrop.

**Dark mode is a different material, not an inversion.** Paper does not become charcoal — it becomes midnight ink (`#141B21`) with a subdued cyanotype wash for brand surfaces. Text softens to off-white (`#E9E7E0`) rather than pure white. Oxide and Ochre lift to `#D28A6B` / `#DFB35F` to hold contrast against dark ground. Grain drops sharply (surface 2.5% → effectively reading level, reading 0) — heavy grain on a dark screen reads as a dirty display, not as paper. The original / translated / generated / human-edited surface distinctions are preserved as tinted steps, not dropped. See `tokens/theme-dark.css` (`[data-theme="dark"]`).

**Responsive behaviour of artifacts.** Expressive treatment yields before functional content does. Marginal metadata moves inline below its content; crop offsets reduce (`--crop-offset-compact`, 3px) or disappear when they would clip; editorial rules shorten rather than force overflow; voice offsets compress (18/10/4px → 8/5/2px under 720px); grain may be reduced on low-density displays. No artifact may ever produce horizontal scrolling, and no artifact survives if keeping it would compress a transcript, a control or a form.

**Export and print.** The record idea should land best on paper, and exports may be more expressive than the working UI. Surviving in export: photography and stronger grain on report covers, editorial rules, numbered record labels, stamps, serif titles. Reduced or dropped: surface and reading grain (dropped — it compresses badly and muddies laser output), tonal washes (flattened to `--paper-flat`), `--ink-bleed`. Body text, provenance marks and source citations print as ink on white with a monochrome treatment available throughout: Peat for text, one grey for rules, stamps outlined rather than filled. Provenance is carried in print by a text label plus its leading mark — never by surface tint alone, which office printers will not reproduce. Everything must remain legible from an ordinary 600dpi office printer with no colour management.

**Motion.** Calm and immediate, never decorative-for-its-own-sake. 80ms presses, 120–180ms hover/focus, 180–260ms component transitions, 320–500ms panel/route transitions. Standard/enter/exit cubic-bezier easings in `tokens/motion.css`. Respects `prefers-reduced-motion` (durations collapse to 0). No indefinite spinners for multi-stage processing — label each stage in plain language instead.

**Branded motion.** Three characteristic motions, for ambient and expressive moments only — never applied to hover, focus or ordinary component transitions: **align** (`--motion-align`, 520ms with `--ease-settle`) — staggered parallel elements settling onto a shared baseline, the core "voices resolving" gesture, used on summary assembly and onboarding; **expose** (`--motion-expose`, 900ms) — a cyanotype-like exposure reveal for brand and cover surfaces; **resolve** (`--motion-resolve`, 640ms) — a provisional generated result settling into an **available** state, and a transcript selection connecting to its audio source. Processing completion is not human agreement: the resolve motion may say *ready to read*, never *confirmed*, *approved* or *reviewed* — those words and their treatments are reserved for an explicit human action, and a generated result stays labelled as generated until a person edits or accepts it. Each runs once, on arrival; none loop, and all collapse under reduced motion.

**Hover / press / focus.** Hover: background shifts one step toward the surface tint (e.g. primary button darkens to `--action-primary-hover`), no scale or shadow pop. Press/active: one step further (`--action-primary-active`), no shrink. Focus: a visible 2px Signal-Blue outline with offset, always — never colour-only or a subtle glow. Interactive states are the part of the system that stays boringly consistent; all of the personality is spent elsewhere.

**No:** technology-purple or neon gradients, glassmorphism, glow effects, oversized pill controls on ordinary buttons, heavy or floating shadows, decorative blur behind functional content, speech-bubble motifs, flags as language indicators, Celtic/heritage or botanical decoration without a role. And on the other side of the line: no texture on controls, no rotation on anything clickable, no grain heavy enough to fight transcript legibility, no faux distress that could read as a bug.

## Iconography

No icon font, sprite sheet or SVG set exists in the source codebase or uploads — none was provided to copy in. **Provisional substitution, not an approved choice:** [Lucide](https://lucide.dev) icons, pinned to `lucide@0.469.0` on jsDelivr for the prototype only (`components/core/icon/Icon.jsx`), chosen for its neutral, slightly-softened 1.75px line weight — the closest CDN match to the spec's iconography direction (§10.1: simple 1.5–2px line weight, neutral, aligned optically with type, clear at 16/20/24px). **Production must bundle an approved, reviewed subset of icons as local SVG assets** — a version-pinned prototype CDN is acceptable for mocks and click-throughs; an unversioned public CDN dependency is not acceptable in the shipped product. Flagging this for the user: **please confirm or supply a preferred icon set.** No emoji or Unicode glyphs are used as icons anywhere in the system.

## Photography

Curated into `assets/photography/` from the licensed uploads:

- **Cyanotype:** `cyanotype-atkins-botanical.webp` (Anna Atkins botanical cyanotype — the clearest expression of "different voices resolving into shared structure": parallel fronds converging to one root), `cyanotype-ranunculus.jpg`, `cyanotype-fabric.jpg`.
- **Pictorialist:** `pictorialist-golden-sunlight.jpg`, `pictorialist-toucques-valley.jpg` — usable directly in campaign, editorial, cover, onboarding and empty-state contexts (see Imagery above).
- **Irish / Atlantic documentary:** `atlantic-coast-rocks.jpg`, `irish-drystone-wall-fog.jpg`, `dark-rock-waterfall.jpg`, `stream-stones.jpg` — origin-story and cultural-moment material, used sparingly.
- A few unattributed Pexels/Unsplash frames rounding out texture and mood (`stephanie-tuohy.jpg`, `jason-mayer.jpg`, `pexels-amberontheroad.jpg`, `pexels-lisettkruusimae.jpg`).

No finished logo, wordmark or brand mark was supplied — every brand-identifier slot in this system renders the word **Dialext** in Instrument Sans as a plain-text placeholder. Do not invent a mark.

## No logo yet

The system accommodates a future horizontal wordmark, compact brand mark, favicon and light/dark variants, but none exist yet. Treat any "logo" you see in the UI kit as the literal text placeholder — it is not an approved identity.

## Components

**Core** (`components/core/`): Icon (Lucide CDN wrapper), Button (primary/secondary/tertiary/destructive), IconButton, Input, Select, Checkbox, Radio, Tabs, Card, Badge, Tag, Dialog, Sheet, Toast, EmptyState.

**Product** (`components/product/`): MeetingHeader, SummaryBlock, DecisionItem, ActionItem, SpeakerLabel, UncertaintyMarker, TranscriptSegment, AudioPlayer, LanguageSelector, OriginalTranslationControl, SearchResult, RecordingStatus, ProcessingStages, PermissionBadge.

No component library or Figma source was provided, so this is the standard inventory (§16–17 of the specification) sized to Dialext's needs — nothing beyond what the spec calls for.

**Intentional additions:** `Icon` (a thin CDN wrapper the spec doesn't name explicitly, needed so every other component can reference a consistent glyph); `Tag` (removable filter/recipient chip, distinct from the spec's status `Badge`); `Sheet` (the side-panel counterpart to `Dialog` that §16.9 calls for by name but doesn't give its own heading).

**Product patterns** (`guidelines/product-patterns.md`): nine Dialext behaviours that the primitives don't fully carry on their own — **UploadPanel, RecordingRow (JobRow), DownloadItem / DownloadState, NotesEditor, NotesCorrectionForm, ProvenanceControl, UncertaintyReviewList, TranscriptCorrection, ProcessingFailure / RetryPanel**. Each is documented with its composition (built from the primitives above, no new visual language), its full state list, and its provenance and accessibility rules, so the behaviour lives in the system rather than only inside the demonstration UI kit.

## Index

- `styles.css` — root stylesheet (import-only; imports everything below)
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `shape.css`, `motion.css`, `texture.css`, `materials.css`, `surfaces.css`, `theme-dark.css`, `fonts.css`, `base.css`
- `assets/textures/` — the curated material library (purpose-named; see Material library above)
- `assets/photography/` — curated licensed photography (see above)
- `components/core/` — button, forms, tabs, card, badge, dialog, feedback, icon (see Components above)
- `components/product/` — meeting-header, summary, transcript, audio, language, search, status (see Components above)
- `ui_kits/web-app/` — click-through recreation of the meeting workspace: recordings list, upload dialog, meeting overview (summary/decisions/actions/downloads), transcript (original/translation/compare, audio, uncertainty review), Ask Dialext, share dialog, processing and failure states
- `guidelines/` — foundation specimen cards feeding the Design System tab (colour, type, spacing, shape, brand, motion), plus `product-patterns.md` (the nine Dialext product patterns)
- `thumbnail.html` — project tile (Deep Atlantic ground, Dialext wordmark, colour strip)
- `SKILL.md` — Claude-Code-compatible skill wrapper

## UI kit: web app

`ui_kits/web-app/index.html` recreates the meeting workspace from `dialext-design-export/web-app/client/` on this design system, preserving its content types and information architecture: a recordings list with upload, a meeting workspace with Overview/Minutes/Transcript/Ask Dialext tabs, downloads, sharing, an uncertainty-review dialog, and processing/failure states. It composes the components above rather than reimplementing them — click through to see recording states (Complete/Transcribing/Failed), original/translation/compare transcript modes, and the generated-content/decision/action patterns together on real-shaped Dialext content.
