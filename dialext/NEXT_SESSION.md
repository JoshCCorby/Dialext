# Next-session prompt

Continue Dialext in `/Users/joshuacorbett/Coding/Dialext-Anarlog`.

Read `AGENTS.md`, `dialext/HANDOFF.md`, `dialext/ARCHITECTURE.md`, and
`dialext/product/product-vision.md`; follow the personal-product scope and existing architecture
decisions. Check the current branch and status and preserve unrelated work. Do not reset anything
in the old `/Users/joshuacorbett/Coding/Transcip` checkout. The working branch is
`codex/dialext-personal-prototype`; origin is the private `JoshCCorby/Dialext` repository. Never
push to upstream. Compare against `origin/codex/dialext-personal-prototype`, not `origin/main`, to
see unpushed work. Agent pushes have been refused before, so ask Joshua to push rather than working
around it.

**Milestone 5 is implemented but not accepted.** Read "Milestone 5" at the end of `HANDOFF.md`
first. Its automated checks all pass and its migration ran on the live prototype without changing
saved work, but the real-window journey was not driven (window control was declined). Your first
job is that section's acceptance checklist, driven in the real `app.dialext.prototype` window, or
with Joshua by hand if window control is unavailable. Record each outcome individually. Fix only
defects the checklist exposes.

Questions are answered through the app's existing provider-agnostic model setting. Joshua approved
Apple's on-device model for testing only; do not tie anything to it, and do not make a hosted or
paid call without his explicit approval.

Milestone 4 remains complete: the native provider bridge, fixture helper and durable stages are
recorded in `HANDOFF.md`. No live or paid provider call has been made.

Carry forward these boundaries:

- Rust owns task state, cancellation, validation, fences and durable writes. The Node helper stays
  stateless, bounded, stderr-for-diagnostics only, with no HTTP listener, database or workspace
  writes.
- The current provider is deterministic and fixture-only. A short live-provider sample still
  requires Joshua's explicit approval and is assessed separately. Do not use credentials or make a
  paid call without it.
- Keep `effective_transcripts` as the selected-account projection. Preserve immutable ASR and
  generated originals, edited accounts, edit history, contacts, saved selection and retained
  metadata.
- Milestone 3's invariants still apply: pin the version behind what the reader was shown;
  `dialextBlock` wrappers are block identity; chat/CLI/MCP inbox proposals retain the upstream
  timestamp path; Defect B remains by decision; do not quietly fix the missing stale-edit refresh.
- `dd281ca` appeared during the milestone authored as Joshua and tracks `dialext/.Rhistory`, which
  had previously been untracked. Do not rewrite that commit or remove the file without Joshua's
  direction.
- The live prototype intentionally contains the synthetic **Milestone 4 provider bridge**
  recording and its queue/stage/vault artefacts. The temporary pre-migration comparison backup is
  `/tmp/dialext-pre-m4.mCbuVJ/app.backup.db`; do not assume `/tmp` is durable.

After milestone 5 is accepted, agree the next bounded step with Joshua (for example the approved
short live-provider sample, or improving retrieval beyond lexical matching). Do not start one
unasked.

Use synthetic samples until a live-provider test is explicitly approved. Drive the real desktop
with `node dialext/dev.mjs`, never a release build or browser mock. Keep `dialext/HANDOFF.md`
current, record exact native outcomes and limitations, run focused regressions plus affected
package checks, and commit completed work. Do not write to upstream Linear or publish upstream
services.
