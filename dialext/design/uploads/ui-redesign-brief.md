# UI/UX redesign brief — what to hand to Claude, and what not to

This is a working brief for redesigning the Dialext app shell with Claude (or any design tool). It
names the exact files to bring in, what each one is allowed to change, and the constraints that
will silently break the product if a redesign ignores them.

Read [`product-vision.md`](product-vision.md) for what the product is meant to feel like. This
document is only about how to get a redesign done without breaking it.

---

## 1. The three constraints a redesign must not break

These are not preferences. Each one has a test that fails, or a security property that quietly
stops holding.

### 1.1 No inline script, no inline event handlers, no `innerHTML`

The server sets `script-src 'self'` with no `'unsafe-inline'`. An inline `onclick=` **will not
run**, and the "fix" is weakening the policy, which is not a fix.

Every value that came from a server response is placed with `textContent`. Filenames and meeting
prose are customer text and are treated as hostile — markup is deliberately *not* stripped from
them, because inertness comes from how they are rendered, not from mangling a legitimate name.

`tests/web-app-csp.test.mjs` walks the whole client directory and fails the build on any module
that assigns to `innerHTML`, and asserts the shipped HTML carries no inline script and no `on*=`
attribute. A redesign that produces a normal HTML file with inline handlers will not ship.

**What this means practically:** hand Claude the CSS and the markup structure. Wire every
interaction in `.mjs` with `addEventListener`. Do not accept a generated page that inlines
anything.

### 1.2 No build step, no framework, ES modules only

There is no bundler, no TypeScript, no JSX, no PostCSS. `web-app/client/` is served as-is. A
redesign that assumes Tailwind, React, or a CSS preprocessor is a rewrite of the deployment model,
not a restyle.

Design tokens are plain CSS custom properties in `:root`, with a `prefers-color-scheme: dark`
block. Keep them.

### 1.3 Accessibility is load-bearing and already tested

Specific things the DOM tests assert, which a redesign will be tempted to break:

- **A marked word is a real `<button>`.** Not a styled `<span>` with a click handler. It is
  reachable by Tab, activates on Enter and Space, and takes a focus ring, all without keyboard
  code.
- **A control that cannot work is ABSENT, not disabled.** When there is no audio, the play
  affordance does not render. There is a test whose only job is to assert this.
- **Live regions are pre-created and empty in the HTML**, because assistive technology has to be
  watching a region before its text arrives. Do not let a redesign create them dynamically.
- **A reveal never autoplays.** Revealing answers "where did this come from"; making sound is a
  different question nobody asked.

---

## 2. Files to bring in

### 2.1 Bring these in — they are the redesign surface

| File | Lines | What it is | How much can change |
| --- | --- | --- | --- |
| `web-app/client/styles.css` | 680 | All styling, design tokens, light/dark | **Everything.** This is the main target. |
| `web-app/client/index.html` | 147 | Static shell: sidebar, workspace, tabs, panels | **Structure freely** — but keep every `id`, see §3. |

Those two are the whole visual surface. If the redesign only touches these, nothing can break
except appearance.

### 2.2 Bring these in read-only — as context for what the markup must support

| File | Lines | Why the designer needs to see it |
| --- | --- | --- |
| `web-app/client/app.mjs` | 1020 | Builds the summary, downloads, job list, progress trail. Every `getElementById` at the top is a contract with `index.html`. |
| `web-app/client/transcript.mjs` | 629 | Builds the transcript, the reading switch, marked words, the reveal. Owns `.transcript-*` classes. |
| `web-app/client/provenance.mjs` | 229 | Builds the numbered citation marks. Owns `.citation-mark`. |
| `web-app/client/transcript-corrections.mjs` | 250 | Accept / replace / undo affordances inside the transcript. |
| `web-app/client/record-editor.mjs` | 178 | The allow-list of editable paths and the patch collector. |

A designer changing class names in `styles.css` alone is safe. Changing class names that these
modules *generate* means changing the modules too.

### 2.3 Do NOT bring these in

- Anything under `pipeline/` — it is not client code and the public image must never contain it.
- `config/system-prompt.txt`, `config/chat-system-prompt.txt` — never leaves the worker.
- `web-app/server/` — no design decision lives there.
- `*.test.mjs` — they should *fail* against a redesign that breaks a contract. That is their job.
- `web-app/client/capture/` — browser capture code, salvaged, not yet wired to anything.

---

## 3. The contract between `index.html` and the modules

`app.mjs` opens with an `elements` object of 46 `getElementById` calls, and `transcript.mjs` and
`transcript-corrections.mjs` reach for more. **Every one of those ids must survive the redesign**,
or that element silently becomes `null` and the feature attached to it stops working with no error
at all — no exception is thrown at load, the assignment simply succeeds with a null value.

`tests/web-app-element-contract.test.mjs` now enforces this: it scans every shipped client module
for `getElementById` and fails with the exact `module → #id` pair when one has no matching element
in `index.html`. Run it after every markup change.

The load-bearing ids, grouped by what they do:

```
Shell         sidebar, workspace, workspace-empty, workspace-upload,
              workspace-progress, workspace-recording
Sidebar       btn-new-recording, recording-search, list-status, job-list, load-more
Upload        upload-form, upload-drop, audio-file, upload-button,
              upload-status, upload-file-info
Progress      progress-heading, progress-filename, progress-status, event-trail
Recording     recording-title, recording-stage, recording-tabs
Tabs          tab-summary, tab-transcript, tab-downloads,
              panel-summary, panel-transcript, panel-downloads
Summary       record-body, record-toolbar, btn-copy-summary,
              btn-save-summary, editor-status
Uncertainty   uncertainty-section, uncertainty-toggle, uncertainties
Transcript    transcript-note, transcript-status, transcript-audio, transcript-readings
Downloads     download-status, download-list
Failure       detail-failure, failure-message, failure-next
```

Also contractual: `data-tab` on the three tab buttons (the tab switcher reads it), and
`data-path` / `data-original` on editable fields (the patch collector reads them).

**Recommended approach:** treat `index.html` as a skeleton whose ids are fixed and whose classes,
nesting, and element choice are free. That gives a designer nearly full latitude with a
mechanically checkable constraint.

The contract test above is that guard. It was written for this brief and its negative control was
verified: renaming `record-body` in the HTML fails the build with
`app.mjs → #record-body` rather than producing a silently dead summary panel.

---

## 4. Class names the modules generate

These are written by JavaScript, so `styles.css` can restyle them freely but must not expect to
rename them without editing the generating module.

| Class | Generated by | Purpose |
| --- | --- | --- |
| `.transcript-switch`, `.transcript-switch-option` | `transcript.mjs` | Gaeilge / English toggle |
| `.transcript-reading`, `.transcript-line`, `.transcript-speaker` | `transcript.mjs` | Transcript body |
| `.uncertain-word` | `transcript.mjs` | An unsure word — `button` with audio, `span` without |
| `.is-revealed` | `transcript.mjs` | The one paragraph a reveal is pointing at |
| `.transcript-corrected`, `.transcript-correction-review` | `transcript-corrections.mjs` | Accept / replace affordances |
| `.citation-mark` | `provenance.mjs` | Numbered superscript citation |
| `.inline-edit` | `app.mjs` | An editable summary line |
| `.record-item`, `.record-item-attribute` | `app.mjs` | Decisions, actions, questions |
| `.job-row`, `.job-filename`, `.job-stage` | `app.mjs` | Sidebar list |
| `.visually-hidden` | several | Screen-reader-only text — **must stay off-screen, not `display:none`** |

---

## 5. What the redesign should actually fix

Ranked by how much they hurt, from using the product:

1. **The processing screen tells you nothing.** No elapsed time, no estimate, no indication that a
   `Stopped → Transcribing` pair means a *retry*. During development a permanent failure looked
   identical to normal progress for five minutes. This is the single worst experience in the
   product and it is mostly a copy and information-hierarchy problem, not a technical one.
2. **The transcript is a wall of undifferentiated text.** Speaker changes are a small uppercase
   label; there is no visual rhythm, no timestamp gutter, no way to scan. Compare against a
   podcast transcript reader.
3. **The summary has no sense of being a document.** It is now editable in place, but it reads as
   a settings page — uppercase grey section labels, tight spacing, no page metaphor, no width
   constraint for readability.
4. **Downloads are three bare links** with no file-type affordance, size, or generation state
   beyond a text note.
5. **No empty states worth the name.** "Select a recording or start a new one." is the whole
   thing.
6. **Nothing is responsive.** The sidebar is a fixed column; below roughly 900px the layout simply
   squashes.

---

## 6. A workable process

1. **The id-contract test is already in place** (`tests/web-app-element-contract.test.mjs`). It
   converts the most dangerous class of redesign breakage from silent to loud. Keep it green.
2. **Hand over `styles.css` + `index.html`**, with §1 and §3 of this document as the brief. Ask
   for a restyle that keeps every id and every generated class name.
3. **Iterate on styling only.** `npm test` should stay green throughout. If it goes red on a
   pure-CSS change, a test is asserting something visual that it should not be — worth knowing.
4. **Then do markup restructuring** as a separate pass, id contract enforced by the new test.
5. **Then wire any new interactions** in `.mjs`, never inline.
6. **Verify in the browser, not by reading the diff.** The `collectEdits` bug in this work stream —
   a selector that matched `input` while the fields were `textarea` — passed every test and broke
   the entire save feature. It was found by typing into the page.

---

## 7. Honest note on scope

A visual restyle of `styles.css` is perhaps a day and carries almost no risk.

Items 1, 2 and 5 in §5 are **not** restyles. Better processing feedback needs the retry count
surfaced through the event projection — and that projection deliberately constructs every field
rather than forwarding it, so a new field is a deliberate decision, not a passthrough. A genuinely
good transcript reader needs the reconstructed transcript from
[`roadmap-reconstructed-transcript.md`](roadmap-reconstructed-transcript.md) to exist first;
restyling two raw ASR legs makes them prettier without making them readable.

Do the restyle for the immediate lift. Do not expect it to fix the product.
