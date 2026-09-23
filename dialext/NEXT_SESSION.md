# Next-session prompt

Continue Dialext in `/Users/joshuacorbett/Coding/Dialext-Anarlog`. That checkout owns the
prototype vault and the synthetic samples; run the app only from there, never from a worktree.

Read `AGENTS.md` first, then `dialext/HANDOFF.md` (verified status), `dialext/ARCHITECTURE.md`
(contracts and milestone order) and `dialext/product/product-vision.md` (what the product is for).
Check the branch and status and preserve unrelated work; another agent may be working in parallel.

The working branch is `codex/dialext-personal-prototype`, and `main` is the integration branch.
Commit locally and ask Joshua before pushing. A `pre-push` hook refuses direct pushes to `main`
and any push to Anarlog; changes reach `main` through a pull request. Do not reset anything in the
old `/Users/joshuacorbett/Coding/Transcip` checkout.

## Where the milestones stand

Baseline and milestones 1–6 are complete. Milestone 7 is in progress. Its connectors and
service-seam work ([CONNECTORS_PLAN.md](CONNECTORS_PLAN.md)) is implemented and committed, and
its live Granola acceptance was interrupted at the browser sign-in.

**First job: finish that acceptance, then stop and report.**

1. Check for a running prototype first (`pgrep -fl "MacOS/desktop$"`, port 1422). Joshua may
   have finished the Granola sign-in in the instance left running. Never start a second
   instance; quit it through the app menu before relaunching with `node dialext/dev.mjs`.
2. In Settings → Imports, Granola is either connected or shows **Connect & import**. If it is not
   connected, press Connect and ask Joshua to sign in in Chrome (Chrome is hidden from window
   screenshots). He has approved using his own Granola account.
3. Record individually: the consent screen names **Dialext**; the first sync result; a repeat
   **Sync now** adds nothing (compare `sessions` against
   `.dialext-data/connectors-0923/app.pre-connectors.db`); **Disconnect** returns the row to
   Connect; no Dialext account, evidence or transcript row changed; `integrity_check` is `ok`.
4. Update the connectors section of `HANDOFF.md` with the results, fix only defects this exposes,
   commit locally.

Then milestone 7's remaining real-window checklist (folders, templates, meetings, appearance), and
the other options Joshua listed: the chat-correction integrity question (can Dialext accounts be
rewritten without native checked-edit history?), TRIAGE DDIA 3.1 as a report, and the other
report-only triage rows. Ask Joshua which to take next; do not start one unasked.

The file picker and Chrome run outside the granted Dialext window: request access for the panel's
process when it is open, and ask Joshua for browser steps.

## Boundaries that carry forward

- No live or paid provider call without Joshua's explicit approval in that session. The provider
  is deterministic and fixture-only; a short live sample is assessed separately.
- Rust owns task state, cancellation, validation, fences and durable writes. The Node helper stays
  stateless and bounded, with no HTTP listener, database or workspace writes.
- Keep `effective_transcripts` as the selected-account projection. Preserve immutable ASR and
  generated originals, edited accounts, edit history, contacts, saved selection and retained
  metadata.
- Milestone 3's invariants still apply: pin the version behind what the reader was shown;
  `dialextBlock` wrappers are block identity; chat/CLI/MCP inbox proposals retain the upstream
  timestamp path; Defect B remains by decision; do not quietly fix the missing stale-edit refresh.
- Milestone 7's entitlement split stands: `useBillingAccess` is the seam, the personal provider
  stays `isPro`/`isPaid` false with four explicit local capabilities, and hosted implementations
  stay in the tree behind `ANARLOG_ACCOUNT_SERVICES_ENABLED` rather than being deleted. Never
  replace it with blanket paid flags.
- `dd281ca` was authored as Joshua and tracks `dialext/.Rhistory`, previously untracked. Do not
  rewrite that commit or remove the file without his direction.
- The live prototype intentionally contains the synthetic milestone 4 provider-bridge recording
  and its queue/stage/vault artefacts.

Drive the real desktop with `node dialext/dev.mjs`, never a release build or browser mock. Keep
`dialext/HANDOFF.md` current with exact outcomes and limitations, run focused regressions plus the
affected package checks, and the full desktop suite at milestone boundaries.
