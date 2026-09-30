# Next-session prompt

Continue Dialext in `/Users/joshuacorbett/Coding/Dialext-Anarlog`. That checkout owns the
prototype vault and the synthetic samples; run the app only from there, never from a worktree.

Read `AGENTS.md` first, then `dialext/HANDOFF.md` (verified status), `dialext/ARCHITECTURE.md`
(contracts and milestone order) and `dialext/product/product-vision.md` (what the product is for).
Check the branch and status and preserve unrelated work; another agent may be working in parallel.

The working branch is `codex/dialext-personal-prototype`, and `main` is the integration branch.
Commit locally; Joshua pushes. A `pre-push` hook refuses direct pushes to `main`
and any push to Anarlog; changes reach `main` through a pull request. Do not reset anything in the
old `/Users/joshuacorbett/Coding/Transcip` checkout.

## Where the milestones stand

Baseline and milestones 1–7 are complete. Milestone 7's connectors and
service-seam work ([CONNECTORS_PLAN.md](CONNECTORS_PLAN.md)) is implemented. The live Granola
check completed on 23 September: consent said Dialext; first and repeat sync each returned zero
accessible meetings; Disconnect worked; the Dialext database rows were unchanged and integrity
was ok. That empty account did not test deduplication of actual imported meetings.

The remaining available milestone 7 real-window checklist was exercised on 23–24 September:
folders, templates, meetings and appearance, plus connected imports and calendar. See
[HANDOFF.md](HANDOFF.md) for each pass, absent share/hosted surface, and the untested first-time
calendar permission path. A chat correction could previously update Dialext transcript JSON
without native edit history; commit `37116c3` blocks that tool on Dialext recordings and guards
its SQL updates. The requested DDIA 3.1, TypeScript 0/1.1 and Rust 3.4/4.2 report-only findings
are in [prompts/TRIAGE.md](prompts/TRIAGE.md). Rust 2.2, 5.6 and 1.9 stay conditional.

Before any native work, check for a running prototype (`pgrep -fl "MacOS/desktop$"`, port 1422);
never run two instances. Quit it through the app menu before relaunching with
`node dialext/dev.mjs`.

The file picker and Chrome run outside the granted Dialext window: request access for the panel's
process when it is open, and ask Joshua for browser steps.

## Next bounded decisions and task sources

- [HANDOFF.md](HANDOFF.md) records milestone 7's closure: the template gallery is bundled,
  native calendar discovery stays local with a stale account token, hosted web search is absent
  from the personal tool list and prompt, and the note editor's owned-share query has a direct
  guard. The local template and calendar UI and ordinary note edit were exercised in the real
  window. A live model question was deliberately not submitted; see the exact limitation there.
  Do not call Anarlog services.
- Milestone 8 is Dialext branding: visible Anarlog strings, links, app icons, export identity and
  menus. Keep internal `@anlg`/`anlg_` identifiers and MIT attribution.
- [ARCHITECTURE.md](ARCHITECTURE.md) and [product/product-vision.md](product/product-vision.md)
  define the remaining personal recording, useful adaptive summary, source-linked output and
  final acceptance work. The current provider is fixture-only. A live speech-provider sample
  needs Joshua's explicit approval and credential/cost choice before calling it.
- [CONNECTORS_PLAN.md](CONNECTORS_PLAN.md) holds the later Dialext service and still-open
  connector decisions. Local MCP/CLI are already account-free; hosted connections are disabled
  without a configured Dialext service.
- [prompts/TRIAGE.md](prompts/TRIAGE.md) holds the report-only audit and conditional Rust rows.
  Packaging, old-library migration and a real nonempty Granola import need separate bounded
  acceptance plans; never import from the untouched Transcip checkout by assumption.

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
