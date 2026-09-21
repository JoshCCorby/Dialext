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

**Milestone 4 is complete.** Read “Milestone 4 — native provider bridge” at the end of
`HANDOFF.md` before making changes. The real `app.dialext.prototype` window generated English from
`source-review.wav`, generated Gaeilge on demand, and retained both accounts plus the active Irish
selection after a full Quit and fresh `node dialext/dev.mjs`. Read-only inspection found two
succeeded tasks and four independently durable stages. Automated tests prove in-flight helper
cancellation, cancel/restart preservation and reconstruction retry without duplicate ASR. No live
or paid provider call was made.

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

Now begin **milestone 5 only: coherent personal workflow**. `ARCHITECTURE.md` defines the bounded
scope: quiet source controls on stable summary blocks, a footer question input, corrected-text
retrieval and simple TXT/Markdown sharing. Acceptance is that a question months later uses the
chosen effective account, refuses missing evidence, opens the same source panel, and exports match
what the reader sees.

Start by tracing the existing `dialextBlock` identity, summary proposal evidence shape, source
panel/audio interval command, selected-account query path, chat context pipeline and current
export implementations. Design the smallest evidence record that is pinned at output generation
and invalidated when block text changes; do not infer provenance from bullet position or pretend an
edited block is still verified. Reuse the existing source panel and chat surface rather than
creating a second chat product. Questions must retrieve corrected text from the active account and
refuse when required evidence is absent. TXT/Markdown exports must match the same selected reading
and visible names/content.

Use synthetic samples until a live-provider test is explicitly approved. Drive the real desktop
with `node dialext/dev.mjs`, never a release build or browser mock. Keep `dialext/HANDOFF.md`
current, record exact native outcomes and limitations, run focused regressions plus affected
package checks, and commit completed work. Do not write to upstream Linear or publish upstream
services.
