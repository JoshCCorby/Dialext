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

Baseline and milestones 1–6 are complete and verified in the isolated native app. Milestone 5's
native checklist passed on 23 September and was integrated with a smoke test the same day
(see its section in `HANDOFF.md`). **Milestone 7 is implemented with all automated checks
passing but has not been accepted in the real window**: its folders, templates, imports,
calendar, meetings and appearance pass is outstanding.

Do not start new work unasked. Joshua chooses the next step from the options recorded at the
end of the latest session report: milestone 7 acceptance, the chat-correction integrity
question, the DDIA 3.1 crash-consistency report, other report-only triage rows, or later product
work. Milestone 7's remaining decisions are at the end of its handoff section: the anarlog.so
template gallery, the native calendar token guard, and whether the chat `web_search` tool stays
registered.

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
