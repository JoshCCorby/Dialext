# Start here: Dialext handover

Updated 23 September 2026. Native baseline and milestones 1–**5** are complete and verified in the isolated native app. **Milestone 6 — quiet interface — has now passed its real-window acceptance. Milestone 7 has started with a bounded personal-entitlement and hosted-service-isolation slice; it is not complete.** No live or paid provider call was made; the separately assessed live sample still requires Joshua's explicit approval. The full personal product is not complete. Read this before inspecting the monorepo. A ready-to-use continuation prompt is in [NEXT_SESSION.md](NEXT_SESSION.md).

## Repository and authority

- Private repository: https://github.com/JoshCCorby/Dialext
- Local checkout: `/Users/joshuacorbett/Coding/Dialext-Anarlog`
- Working branch: `codex/dialext-personal-prototype`, tracking `origin/main`. That tracking is
  misleading: `git log origin/main..HEAD` on this branch lists every commit since the baseline,
  and run from `main` it lists nothing. Compare against `origin/codex/dialext-personal-prototype`
  to see what is unpushed. On 21 September the local checkout was found on `main` (two commits);
  all milestone work lives on the working branch.
- `origin` is Joshua's new repository. `upstream` is `fastrepl/anarlog`; do not push there.
- The initial community snapshot is `1f0643e`. Its parentless history is deliberate: it excludes the commercially licensed enterprise implementation. The original upstream revision and licence notices are retained. Local ignored enterprise files are upstream reference material, not part of the new repository.
- The old `/Users/joshuacorbett/Coding/Transcip` checkout is intact, with pre-existing uncommitted changes. Do not reset it, import its live database, or assume those changes are all in its remote.
- Read `AGENTS.md`, `dialext/product/product-vision.md`, then `dialext/ARCHITECTURE.md`. Dated assessment documents are historical evidence; their “not built yet” statements are not a current status tracker.

The user wants a working personal tool based on Anarlog's layout, not another enterprise platform or bespoke frontend rewrite. They may read only one language. Keep the original design reference in `dialext/design/`, but do not copy its illustrative fake data into production. Irish–English first; other language pairs later, only as providers and evaluations support them.

## What is implemented

1. A separate community-source repository with the agreed brief and original design files.
2. `node dialext/dev.mjs`: isolated native development launch under `app.dialext.prototype`; `.dialext-data/vault/` for audio; local `.dialext-tools/` Rust installation where present. Xcode's Metal Toolchain has been installed on this Mac.
3. Xcode 27 build compatibility: `dialext/toolchain/swift` selects SwiftPM's native build layout, which `swift-rs` expects. The native runner signs with the prototype identifier. This is scoped to the launcher, not a global compiler configuration. The launcher defaults `ONBOARDING=false` for the prepared-sample experiment; `ONBOARDING=true node dialext/dev.mjs` restores the upstream tutorial. This does not grant operating-system recording permissions.
4. Settings → Imports → **Import a Dialext recording**. This reads a versioned prepared JSON bundle, validates both accounts against exact evidence anchors, and calls Anarlog's native `applySessionIngest` command. It inserts the initially selected reading and optional supplied summary; native adoption registers both prepared accounts and immutable artefacts. Original metadata is retained for recovery.
5. Finalized, deterministic import identity. An identical repeat is idempotent; changed content under the same identity is rejected instead of overwriting edits. The native ingest tests cover these guarantees. This is an import seam, not the provider pipeline.
6. Original reconstruction validator and 13 tests copied unchanged from Dialext. The new bridge additionally checks unique source identities, ambiguous intervals, measured-duration bounds and agreement between displayed passage timing and its source anchors.
7. Durable personal-only recording/evidence/account tables, crash-safe metadata adoption and verified immutable vault artefacts. One effective-transcript view supplies the selected reading to the panel, export, search, enhancer/chat snapshots and native session access.
8. English/Gaeilge selection in the existing Transcript workspace, checked by native transaction against the expected previous selection. Separate saved edits survive switching/restart. General settings remembers the preferred reading language, default English, for fresh prepared imports. Missing accounts are explicitly unavailable; switching is disabled while editing or processing. Existing summary documents are unchanged by switching.
9. A native permissions-helper fix: an AppKit drag operation returning nil now restores the row state instead of panicking across an Objective-C callback. The app compiled successfully with this fix. The exact failed-drag interaction has not been reproduced after the fix.
10. Version-pinned account edits with durable history (milestone 3). Dialext passage corrections and "Undo last correction" go through native `edit_dialext_passage` / `undo_dialext_edit`, pinned to the `content_version` of the reading on screen and compared in one `BEGIN IMMEDIATE` transaction; a stale base is refused with the reader's text kept. Every accepted edit, including an undo, is an append-only `dialext_account_edits` row.
11. Atomic, block-targeted summary proposals. A Dialext proposal is applied by native `apply_dialext_proposal`, which compares the summary's and the account's `content_version`, replaces only the named `dialextBlock`s and settles the proposal in one transaction. A correction creates the proposal inside its own edit transaction.
12. Deterministic Dialext outputs through the existing template picker, one `dialextBlock` per passage of the selected reading, with no model call. A template is another output, never a replacement of the one on screen.
13. A milestone-4 provider bridge. Rust owns the durable `dialext_provider_tasks` lifecycle, cancellation, protocol/result validation, immutable stage writes and final account transaction. The development-only Node helper is a stateless fixture subprocess with bounded JSON stdin/stdout and stderr diagnostics; it has no HTTP listener, database access or workspace-write authority. Settings → Imports generates the preferred reading from a WAV, and the existing language selector generates the missing alternate on demand.
14. Milestone 5 (native checklist passed 23 September): stored per-block evidence for generated outputs, a quiet source control on each summary block, grounded questions through the existing chat, and a Dialext export regression. See the end of this file.
15. Milestone 6 native acceptance and the first milestone 7 slice: developer diagnostics are quiet by default and opt-in works; the personal shell now uses no-account auth/billing providers, unlocks the four requested local capabilities through `useBillingAccess`, removes primary account/upgrade interruptions, and prevents its automatic lifecycle, automation and deletion paths from activating Anarlog-hosted services. See the end of this file.

The sample `dialext/fixtures/language-practice.json` is entirely hand-authored. It has **no source audio**, no actual ASR output, and no evaluated translation quality. Do not describe opening it as a successful live transcription test.

## What is not implemented

- A live Azure/other speech provider, provider credentials, quality claims or packaged helper runtime. Only the deterministic development fixture provider is offered. One approved short live sample remains a separate assessment.
- Completion of milestone 7. Folder/template resource sharing still needs a bounded personal-shell pass, and connected imports and calendar follow [CONNECTORS_PLAN.md](CONNECTORS_PLAN.md); their legacy implementation remains in the tree but must not become the route to a blanket paid entitlement.
- A real summary. The Dialext outputs are deterministic, fixture-grade copies of the selected reading's passages, for checking corrections and proposals end to end.
- Packaging/distribution, full rebranding, migration of the old recording library, or quality evaluation.
- Customer-initiated deletion of Dialext source audio. It is app-owned evidence outside
  `session_attachments`, so the ordinary audio-retention sweep and the Delete recording
  control do not reach it. Recorded rather than fixed; see the placement note in milestone 2a.

Do not fill these gaps with inert controls. Complete one visible journey at a time.

## Verification already performed

| Check | Result |
| --- | --- |
| Pinned dependency install and shared UI build | Passed |
| Desktop TypeScript check | Passed |
| Full desktop test suite | Milestone 7 first slice (22 September): 479 files, 4,482 tests passed. Milestone 5: 476 files, 4,483 tests passed. Milestone 4 boundary: 473 files, 4,452 tests passed. Milestone 3: 472 / 4,449 |
| Focused import/UI tests | 13 tests passed on 17 September, including the final timing metadata refinement |
| Provider protocol/helper and source-anchor validator | 19 tests passed |
| Native tests | Milestone 5: session-ingest 58; db-app 249 unit + 2 integration; db plugin 162. Milestone 4: session-ingest 52; db-app 248 unit + 2 integration (3 existing ignored); db plugin 162. Milestone 3 desktop native suite: 57 |
| Editor package | 27 files, 204 tests passed (block-identity round-trip, markdown export and "never invented for markdown" added) |
| Common repository Node tests | 82 tests passed (rerun 21 September); original validator 13 passed |
| Licence-boundary tests/check | 9 tests and boundary check passed (rerun 21 September) |
| Lingui extraction and strict compilation | Passed; generated catalog changes are committed with the first import slice |
| Lingui check against tracked catalogs | Passed, including milestone 3's six new strings |
| Desktop Oxlint | No errors; 206 inherited warnings at the milestone 7 first slice |
| Affected ESLint / native Clippy | Desktop ESLint passed; plugin JS has no matching ESLint configuration. db-app/session-ingest Clippy passed with warnings denied. Plugin Clippy is blocked by two inherited lints described below. |
| Workflow audit | Offline zizmor scan found 358 inherited findings. No upstream workflow fixes or release-readiness claim. GitHub Actions are disabled on this private repository. |

Native runtime verification is recorded in the final section below. Passing mocked UI tests or the database tests is not a substitute for it.

Useful commands, from the new checkout:

```sh
node dialext/dev.mjs
node --test dialext/engine/provider-contracts.test.mjs dialext/engine/provider-helper.test.mjs dialext/engine/reconstruction-validate.test.mjs
npx --yes pnpm@11.1.1 -F @anlg/desktop exec vitest run src/dialext src/settings/imports/index.test.tsx
npx --yes pnpm@11.1.1 -F @anlg/desktop typecheck
```

For direct Rust commands on this Mac, use the checkout-local toolchain rather than assuming `cargo` is installed globally:

```sh
RUSTUP_HOME="$PWD/.dialext-tools/rustup" \
CARGO_HOME="$PWD/.dialext-tools/cargo" \
PATH="$PWD/.dialext-tools/cargo/bin:$PATH" \
cargo test --locked -p session-ingest --features apply
```

The launcher supplies the Swift wrapper and Xcode selection for the full native app. Do not replace it with a release build: upstream release-mode storage maps arbitrary identifiers to the stable Anarlog data folder.

## Hard findings the next session must retain

- Milestone 1 routes effective recording readers through `effective_transcripts`; explicit per-account editing/retention stays on canonical `transcripts`. Do not return to session-wide raw reads, which concatenate language accounts. Voiceprint raw-audio matching is outside this milestone and must be audited before later speaker work.
- The old reconstruction validator's returned `language` is the **target** language. Preserve a distinct spoken-language annotation; never derive it from a forced provider locale.
- Upstream missing timing metadata defaults to precise provider-word timing. Imported derived wording uses `synthetic_text` to disable that claim; source interval playback must be implemented explicitly.
- Anarlog edits its working `words_json`. Do not put immutable ASR legs in that editable table or silently turn its editing path into an evidence rewrite.
- The upstream proposal accept path checks a timestamp, then saves separately, replacing the whole body from markdown. **Milestone 3 fixed this for Dialext proposals only** (those with block targets go to `apply_dialext_proposal`). Chat, CLI and MCP inbox proposals still take the old timestamp path, deliberately unchanged; do not route correction-driven work through it.
- Both `transcripts` and `session_documents` already have trigger-maintained `content_version` tokens. Pin those in native edits/proposal acceptance; transcript `content_revision` alone misses writers that change text without incrementing the counter. Exact migration files and the revised contract are in `ARCHITECTURE.md`.
- `applySessionIngest` is a usable native command, but its source marker says `meeting_bot`, its workspace is a fixed local fixture scope here, and its envelope is capped at 2 MB. Do not mistake this prototype seam for the final local recording model.
- Native build caches produced by Xcode's default `swiftbuild` may contain libraries under `out/Products/Debug`, while the linker looks for `arm64-apple-macosx/debug`. The wrapper fixes clean builds. On an affected old cache, touching the relevant Swift-owning `build.rs` files forces rebuilding; no Rust source edit or global Xcode change is required.

## Working method and scope for the next session

Follow the ordered milestones in `ARCHITECTURE.md`. Baseline and milestones 1–6 have passed; milestone 7 has one verified slice and remaining work recorded below. Preserve the provider bridge's stage/result evidence and every existing edit, contact and immutable artefact.

Reuse existing application components. Do not create a second database, display-only language filter, generic frontend mock, fake progress bar, unrestricted summary rewrite, or voice-identification service. If a source contract is missing, make that missing contract explicit instead of quietly assuming the renderer and backend agree.

At the end of each milestone: verify the actual desktop workflow, record exact remaining limitations here, run focused regressions and affected package checks, commit, and push to this repository. Do not rerun every platform's release pipeline for a local slice. Do not publish to any upstream account or write to upstream Linear.

## Native runtime verification

**Native baseline passed on 17 September 2026 through the actual native interface.** The launcher now wraps the isolated signed debug executable in `.dialext-data/Dialext Prototype.app`, allowing native UI automation to identify its window. This remains a debug build under the existing prototype identifier/vault.

Verified individually: Settings → Imports, English import of `language-practice.json`; sample title and supplied summary; both passage texts; first passage corrected from coffee to tea; `Dialext Test Speaker` assigned; TXT exported through More → Export and its bytes checked for the correction/name; full Quit and launcher restart; correction and name retained; identical repeat import retained both. No provider calls, mocked database, source audio or playback were involved.

Baseline limitation: the import supplies string speaker labels but no upstream provider-speaker hints, so both passages display in one speaker block. The assignment above applies to that block; this does not prove independent or recording-level multilingual speaker identity. Preserve the saved text and hint assignment when registering this selected account. New alternate-account conversion must supply the upstream hints.

Historical build/runtime observations follow. **Build and process launch passed; interactive baseline was open at the previous handoff.** The initial full native build completed on 16 September. After the permissions-helper fix, the incremental native build completed successfully in approximately 22 seconds. The launcher was run again on 17 September: the real desktop process started, Vite listened on 1422, and the native development relay listened on loopback port 1424. The separate profile exists at `~/Library/Application Support/app.dialext.prototype`; it was not substituted with a mocked database.

The UI automation tool cannot identify this unbundled debug executable as a native application. The alternative browser interface at `http://localhost:1422` stalls at “Loading” despite the native relay listening. The native console reported “Couldn't find callback id” warnings; the browser showed no useful error. This is an unresolved observation, not a proven root cause. The relay forwards commands by evaluating them in the main native webview (`plugins/relay/src/relay.rs`); channel/callback forwarding is a targeted place to inspect if pursuing that route. Do not replace the backend with browser mocks to declare this acceptance complete.

At the previous handoff, no sample import, transcript edit, speaker assignment, export or persistence-after-restart had been verified through the new app's real interface. Those baseline steps have now passed as recorded above. Earlier mocked renderer tests and native ingest tests cover their own layers only. The sample does not contain audio, so source playback cannot pass yet.

The first run also encountered a native permissions-helper drag panic (fixed as described above). In a subsequent interrupted development run, the webview health monitor restarted the native process after its frontend disappeared; that relaunched process used the default relay port 1423. Restart the whole development launcher after interruption rather than leaving an orphan native process running. Do not interpret this as a database-corruption diagnosis or reset saved data.

Local diagnostic logs: `/tmp/dialext-anarlog-dev.log`, `/tmp/dialext-final-focused-tests.log`, `/tmp/dialext-anarlog-typecheck.log`, `/tmp/dialext-anarlog-ingest-test.log`, and `~/Library/Logs/app.dialext.prototype/app.log`. Temporary logs are supplemental, not required source files; the durable findings are recorded here.

### Original baseline checklist (completed; milestone 1 also completed)

1. Start `node dialext/dev.mjs` in a terminal that remains open. Use the actual native window if available. Do not press Record or configure paid providers for this sample check.
2. In Settings → Imports, choose English and import `dialext/fixtures/language-practice.json`. Confirm the sample title, supplied summary and two transcript passages. Verify that changing the first passage, assigning a test speaker name, copying/exporting and restarting preserves the changes. Reimport the same file and confirm saved edits are retained. Record outcomes individually.
3. If native automation remains unavailable, a manual check with Joshua is acceptable; ask for those exact results rather than another architecture discussion. If the app itself cannot complete the steps, isolate that failure before adding more product features.
4. Once the baseline passes, begin milestone 1 in three reviewable commits: **1a** additive schema/native storage and crash-safe metadata migration; **1b** one effective-transcript projection across all readers and search invalidation; **1c** saved language selection in the existing workspace, plus the two-language/restart acceptance journey. Keep the selector absent until its backend and consumers agree. No paid calls, full rebrand, new chat UI or provider migration in this milestone.

Use `ARCHITECTURE.md` as the decision record. Reopen a decision only when a concrete code constraint or user requirement contradicts it; record that evidence before changing the contract. Update this file after each completed slice so a later session can continue without relying on chat history.

### Current continuation (superseded by the milestone 2 section at the end of this file)

Native baseline and milestones 1a/1b/1c are complete. Milestone 2 is next. Use [NEXT_SESSION.md](NEXT_SESSION.md). The browser relay still stalls on live-query channel callbacks; use the identifiable native debug bundle for acceptance. The final running prototype has the original sample selected in Irish and the global fresh-import preference restored to English. These are independent settings. Test data is synthetic; `.Rhistory` appeared untracked and was left untouched/uncommitted.

### Milestone 1a — native storage implementation (commit `e5b8655`)

Implemented additive migration `20260917120000_dialext_accounts`, the three agreed personal-only tables (CloudSync disabled), same-recording registry constraints and immutable evidence/generation rows. The Drizzle adapter mirrors the schema. Prototype adoption lives in native `session-ingest::dialext`: preserves the edited selected transcript/hints/content version, creates the alternate from the retained bundle, writes immutable vault artefacts, and commits the registry and metadata marker together. Originals remain in metadata pending acceptance.

Hash contract v1: compact UTF-8 JSON, recursively sorted object keys, no BOM/newline. ASR originals are wrapped with `format: dialext-asr-evidence` and `version: 1`; account originals include the exact source IDs/revisions/digests. Evidence-set digests cover `format: dialext-evidence-set`, `version: 1` and a source-ID-sorted list of `{source_id, revision, sha256}`. Source-file bytes will be hashed directly when audio/file ingest exists. Files are named by their digest beneath `dialext/artifacts/v1/`; complete synced temporary bytes are atomically published without overwriting an existing path. A failed SQL commit can leave unreferenced files; retry verifies/reuses them. No garbage collection is implemented.

Native focused tests: 12 passed (eight ingest regressions plus four adoption/preservation/interruption/evidence/anchor tests). The schema upgrade regression preserves existing prose; the full db-app run initially passed 243/244, with its registry-count assertion requiring the three new disabled tables. The affected Rust Clippy check passed with `--locked --all-targets --no-deps -- -D warnings`. Database TypeScript typecheck passed. Two inherited adapter fixture failures omitted the existing template icon column; corrected fixture rows retain the real positional transport contract.

At this commit activation was deliberately held for 1b: starting adoption before every effective reader uses the selected-account projection would concatenate the alternate language. The real native baseline remains verified; registry adoption in the running interface will be checked with 1b. The workspace selector is still absent. No paid calls or speaker-identity milestone is included here.

### Milestone 1b — effective transcript and activation (commit `9674a66`)

Activated metadata adoption during native startup and prepared import. The real prototype library now has two registered accounts; the edited English transcript, speaker hint and supplied summary remain intact. All four immutable artefacts were read from the prototype vault and checked against their registered SHA-256 digests. Original metadata remains retained.

`effective_transcripts` is the shared SQLite view for session-level panel/metadata/render/export, enhancer/chat snapshots, native session access and the desktop search worker. Ordinary sessions retain all live transcripts; Dialext recordings return exactly their live selected usable account. Unadopted prepared bundles and absent/deleted selection return no combined fallback. Explicit account editing, retention and deletion still address canonical rows. Registered transcripts cannot be moved to another recording. Selection is a checked native transaction with expected previous ID and atomic search-dirty generation; it updates future context without changing summary documents.

The actual sidebar Search dialog was title-only even though the local index already supported content. Connected it to that existing native index, intersecting session hits with the current live library while preserving shared-title results. Real interface acceptance: reopened migrated sample, saw saved tea correction and `Dialext Test Speaker`, found tea through sidebar Search, exported transcript-only TXT and checked its bytes contained corrected English/name without Irish account concatenation.

Focused checks: 82 desktop tests across ten affected files plus three search-dialog tests; 15 session-ingest tests; six native plugin channel tests; ten native desktop search tests; full db-app 244 unit tests and two integration tests (three existing ignored); desktop typecheck, affected ESLint and native db-app/session-ingest Clippy with warnings denied passed. Oxlint retains upstream warnings. The full desktop suite is reserved for the milestone boundary after 1c.

A native live-channel regression initially timed out: the dependency analyzer could not resolve aliases inside a view. Full underlying table names in the view allow the existing EXPLAIN analyzer to resolve all four dependencies, and the channel now delivers selection changes. No reactive-runtime policy was weakened. Native adoption also enforces exact anchors, speaker agreement and the existing bounded segment/text/anchor limits.

At the 1b commit the selector was absent. The switching/editing/refusal and two-language restart checks were subsequently completed in 1c below. No paid providers, source playback, speaker mapping/history or summary generation were added.


### Milestone 1c — saved selection and native acceptance

Added the thin native selection command, generated bindings/default permission, live account query, existing ButtonGroup language controls and the local `dialext_reading_language` preference. The renderer flushes queued edits before selection; there is no optimistic replacement of the current reading. Native stale/foreign/deleted/empty selection refuses without changing the previous selection or summary. Prepared repeat import uses its finalized initial envelope language while the native fingerprint still rejects changed originals; a changed global preference cannot overwrite or break an identical repeat.

Real native acceptance on 17–18 September: switched English/Gaeilge; changed Irish `caife` to `tae`; confirmed the English `tea` correction and `Dialext Test Speaker` remained independent; switching was disabled in edit mode. Fully quit/restarted the native app and confirmed selection and both edits persisted. Exported each selected reading through More → Export → TXT, transcript-only, then inspected bytes: Irish contained `Ba mhaith liom tae a ordú.` and no English reading; English contained `Dialext Test Speaker: I would like to order tea.` and no Irish reading. Native sidebar search found the selected correction and excluded inactive Irish text when English was selected; switching back to Irish found `tae` after restart. Existing English summary remained unchanged.

Saved the global preference as Gaeilge, imported `preferred-language.json` fresh and confirmed Irish selection. Fully quit/restarted again and observed Gaeilge still saved in General settings. Restored the default preference to English, imported `english-only.json` and observed the disabled `Gaeilge (unavailable)` control. Reimported the original sample while the global preference was Irish and confirmed its saved English selection/correction/name were retained; its independent Irish edit remained intact. Created and reopened `Sample · Ordinary note check` with saved prose; it has no Dialext selector. Synthetic fixtures are committed; no original audio or paid provider was used.

All registered immutable artefacts were read and hashed after these edits/imports/restarts. The original four digests match the pre-edit baseline. Native/schema tests cover interrupted adoption/retry, missing/corrupt artefacts, exact/foreign anchors, ownership, deletion/restoration and checked selection. Real SQLite projection tests cover panel/metadata/export requests and enhancer/chat snapshots; no AI request was made to verify these inputs.

Milestone boundary checks: full desktop **466 files / 4,421 tests**, full native db-plugin **162**, full native desktop **57**, desktop and plugin TypeScript, affected desktop ESLint, branch-diff format, common Node **82**, licence **9** plus boundary check, and Lingui extraction/strict compilation passed. Oxlint: **207 inherited warnings, zero errors**. Plugin JS is covered by TypeScript; ESLint reports it outside configured files. db-app/session-ingest Clippy passed earlier. Additional plugin check `cargo clippy --locked -p tauri-plugin-db --all-targets --no-deps -- -D warnings` fails on inherited `needless_borrow` in CloudSync workspace setup and `too_many_arguments` in `configure_cloudsync_token`; neither belongs to the new command. Do not call this full Clippy or cross-platform/release readiness. Generated bindings are native-owned; final Lingui check is run after committing catalogs.

Development-only observations: browser relay/channel acceptance remains unavailable. During HMR, native menu listeners temporarily failed to open Export; a full clean quit/launcher restart restored it and both exports passed. Do not reset the database to resolve either symptom. Final native log: `/tmp/dialext-m1-final-native.log`; test logs `/tmp/dialext-m1-*.log` are supplemental only. Start with `node dialext/dev.mjs`, never release mode. Baseline commit is `c378b04`; all completed work is committed to the private origin, not upstream.

## Milestone 2 — source review and speaker identity (commits `5cc2ebf`, `f1b3de3`, `70d0f91`)

### 2a — source and speaker contracts (`5cc2ebf`)

**Source audio is app-owned evidence, not a session attachment, and that was forced by a
real constraint rather than chosen.** `resolve_session_dir` in `plugins/fs-sync` calls
`find_session_dir`, which refuses any session id that is not a UUID. Every Dialext
recording is `dialext-<recording id>`, so `audio_import_data`, `audio_path`, `audio_exist`
and `audio_metadata` are all unavailable to them, and `catalogLocalSessionAudio` with
them. Widening `is_uuid` was rejected: it is also what separates a session directory from
a folder in every vault scan, listing and discovery path, and it is shared with mobile.
Source audio therefore publishes through the same no-clobber digest-named vault path the
other immutable Dialext originals already use (`dialext/artifacts/v1/<digest>.wav`) and is
registered as a `dialext_evidence` row with `kind = 'audio'`. The consequence is recorded
under "What is not implemented": nothing in the ordinary audio-retention or delete path
reaches it yet.

Audio is **measured, never declared**. `attach_source_audio` parses the RIFF/PCM header
itself — 16-bit PCM, one or two channels only — and derives the duration from the sample
count. A bounded in-crate parser was preferred to a decoder dependency because interval
playback needs a sample-accurate slice anyway. Audio shorter than the readings recorded
against it is refused. An identical repeat returns the stored row; different bytes under
the same identity are refused rather than replacing evidence an account is anchored to.

`read_source_interval` resolves an anchor **exactly**. A near match, an interval containing
the anchor, a foreign source id, and a session whose stored readings no longer reproduce
the active account's `input_evidence_digest` are each a separate refusal. Missing or
corrupt audio is a reported state on an otherwise resolved interval, because the
provider's own words are still worth reading. The returned clip is the stored samples for
that interval, so playback cannot drift past the passage.

**Evidence-version pinning is exact but narrow.** `input_evidence_digest` is a hash of a
sorted list, so it cannot be inverted to name a revision. Resolution therefore requires
exactly one stored revision per source and re-derives the digest to confirm it is the one
the account was generated from; a second revision refuses rather than guessing. When
re-transcription arrives it needs a stored pinned list, not a looser check.

**Recording-level speaker identity** is migration `20260920120000_dialext_speakers`:
`dialext_speakers` (one per recording-level voice, optional `human_id`) and
`dialext_source_speakers` (which provider label of which reading that voice spoke as).
Attribution is immutable; only the name moves. A prepared recording may declare
`speakers` and `source_speakers`, and only then do two readings' labels become one person.
Without a declaration every provider label stays its own recording-level speaker —
`irish-asr/voice-a` and `english-asr/voice-a` are two speakers, not one. Existing
recordings were backfilled from their retained originals. Both tables are registered
CloudSync-disabled; the registry assertion moved from 26 to 28.

New fixtures: `source-review.json` + `.wav` (four passages, two declared speakers across
four provider labels, one passage with no attribution and unknown spoken language) and
`second-meeting.json` + `.wav` (a second recording for reusing a contact). The audio is
synthetic tones, regenerated by `node dialext/fixtures/make-synthetic-audio.mjs`; the
bundle names its audio file and digest, and the importer takes the `.wav` beside the
`.json`, checks the digest and refuses a mismatch while leaving the accounts imported.
**The existing `language-practice.json` was deliberately not changed**: its recording is
already adopted and the native fingerprint rejects changed originals under one identity.

### 2b — the source panel (`f1b3de3`)

One panel per recording workspace, rendered at the foot of the transcript panel and
reached from a quiet per-passage control. A later summary source control or chat citation
reuses the same reveal. The control is absent where a passage names no source, and says
what it will show: `translated · Irish`, `as spoken · English`, or `language unknown`
where the original language was never established. The panel is a labelled section with a
focused heading, closes on Escape, shows the provider's own words, reports the provider's
label as that reading's own rather than as a person, plays the interval clip from a blob
URL, and says out loud that the passage timing is not a measured word timing. Every
refusal and each missing-audio reason stays visible with no player offered.

### 2c — naming a speaker (`70d0f91`)

`assign_dialext_speaker` names the recording-level speaker who spoke one passage, in one
checked native transaction. The existing contact search and speaker picker are reused
unchanged; only the route differs, and for a Dialext passage the per-reading scope
checkbox is hidden because there is one meaning. The identity in `dialext_speakers` is the
durable record; the per-account `user_speaker_assignment` hints are how every existing
reader, export and search consumer already shows a contact, so both move in the same
transaction and a name written in one language is read in the other. An earlier saved
assignment is **narrowed** to the passages the new name does not claim, never discarded.
A stale expectation, an unknown or deleted contact, a passage whose anchors disagree about
who spoke, and a soft-deleted recording are each refused.

### Verified, and how

- The additive migration ran against the **real** `app.dialext.prototype` database on
  startup of the rebuilt native app. The backfill created 12 speaker rows and 12
  attributions across the three existing recordings. Read back directly from that
  database: the English `tea` correction, the saved `Dialext Test Speaker` assignment, the
  Irish `tae` correction, the Irish provider-speaker hints and the Irish selection are all
  unchanged.
- Naming was exercised against a byte-for-byte copy of that same live database. Naming the
  second passage moved the baseline `Dialext Test Speaker` assignment down to the first
  passage only and added the new contact to the matching passage of **both** the English
  and the Irish reading. The scratch harness was removed afterwards; it is not committed.
- Automated: session-ingest **31**, db-app **245** unit + **2** integration (3 existing
  ignored), plugin db **162**, desktop native (see the table), desktop vitest for the
  changed areas, desktop TypeScript, affected ESLint, Oxlint with no new warnings, dprint
  on the branch diff, and Lingui extraction plus strict compilation with catalogs
  committed.
- Negative controls run and confirmed red before being trusted: relaxing exact anchor
  resolution to containment; labelling an unestablished language as translated; and
  merging provider labels across readings by matching their strings.

### Native acceptance: what passed on 20 September, and what is still outstanding

Verified in the **real** `app.dialext.prototype` window (background clicks do not reach the
Tauri webview; the Open panel is hosted by a separate process, so driving it needs a Finder
grant as well as full-screen control — expect to need both again):

1. Settings → Imports accepted `source-review.json` and `source-review.wav` chosen together
   in one selection. The recording imported and opened with its English summary and no error.
2. Read back from the live database and vault afterwards: the audio is registered as
   `dialext_evidence` `kind = 'audio'` with a **measured** duration of 12 000 ms and a digest
   equal to the one the bundle declares, the WAV is published at its digest-named app-owned
   vault path, and the recording has exactly two recording-level speakers (`gary`, `nuala`)
   derived from four provider labels across the two readings.
3. The English reading shows the quiet per-passage controls: `translated · Irish`,
   `as spoken · English`, `translated · Irish`, `language unknown`.
4. Opening the first control shows "Spoken in Irish and written here in English", the Irish
   reading's own words `Ba mhaith liom dhá thicéad, le do thoil.`, `Irish reading · 0:00–0:04`,
   "This reading heard spk-1. Each reading labels voices on its own", and a player whose clip
   is **0:04 long, not the 12-second recording**. It plays.
5. The unattributed passage says the original language was not established, reports that the
   reading did not attribute a voice, and offers a 0:02 clip for its 0:02 interval.
6. Switching to Gaeilge inverts the labels correctly (`as spoken · Irish`,
   `translated · English`) and shows the Irish reading's own speaker blocks.
7. The speaker picker on a Dialext passage offers **no "Apply to all"** choice, and lists the
   existing contacts including the baseline `Dialext Test Speaker`.

**Why it stopped there.** Confirming a name failed with
`db.assign_dialext_speaker not allowed. Command not found`. That was a **stale binary, not a
defect**: the running native build predated the step 3 commit that added the command. The six
steps it blocked were completed later the same day against a current build — see the next
section.

A contact row with an empty name (`101e53a7-…`) exists in the prototype database from
16 September. It pre-dates this work and was left alone.

### Native acceptance completed on 20 September, evening

The launcher was restarted from a clean tree (`node dialext/dev.mjs`, no orphan `dev.mjs`,
`desktop` or Vite processes) so the running binary contained `assign_dialext_speaker`.
Everything below happened in the **real** `app.dialext.prototype` window. Background clicks
still do not reach the Tauri webview — the AX action is delivered and ignored — so this needed
full-screen control throughout; the Open panel needed the Finder grant as the earlier section
predicted. No provider call, mocked database or browser mock was involved.

Each outcome individually:

1. **Naming carries across both readings — PASSED.** `Sample · Source review with audio` was
   open on the Gaeilge reading. Naming the first passage Gary through the existing speaker
   picker succeeded with no error, and the Irish reading became `Gary` / `Speaker 1` / `Gary` /
   `Speaker 2` — both of Gary's passages, and only his. Switching to English showed `Gary` on
   the matching two passages there. The picker offered **no "Apply to all"** choice, as
   intended. Read back from the live database: `dialext_speakers` for that recording holds
   exactly `gary → Gary` and `nuala → (none)`, so the second speaker is untouched, and
   `transcripts.speaker_hints_json` carries one `user_speaker_assignment` naming passages 0 and
   2 in **each** reading.
2. **TXT export in each selected language — PASSED.** More → Export, TXT, transcript only,
   exported straight to `~/Downloads` with no save panel. English bytes:
   `Participants: Gary`, `Gary: I would like two tickets, please.` … `Gary: Thank you very
   much.`, and no Irish text. Gaeilge bytes: `Participants: Gary`,
   `Gary: Ba mhaith liom dhá thicéad, le do thoil.` … `Gary: Go raibh míle maith agat.`, and no
   English text. Each export contains only its own reading.
3. **Quit and restart — PASSED.** Quit through the application menu (the log records
   `app_exit_requested`; no `dev.mjs`, `desktop` or Vite process survived), then a fresh
   `node dialext/dev.mjs`. Reopening the recording showed the Gaeilge selection still chosen,
   Gary still on both his passages, and the source panel still working: "Spoken in Irish and
   written in Irish", the Irish reading's own words, `Irish reading · 0:00–0:04`, "This reading
   heard spk-1. Each reading labels voices on its own", and a player.
4. **Second recording reusing the contact — PASSED.** `second-meeting.json` and
   `second-meeting.wav` were selected together in one Open-panel selection and imported;
   `Sample · Second meeting with Gary` opened with its summary and no error. Naming its first
   speaker with the **existing** Gary contact succeeded. The database holds one `Gary` row
   (`c572e7e0-…`) referenced by `first-voice` of the new recording **and** `gary` of the first
   one — no duplicate contact was created — and the first recording still reads
   `Gary` / `Speaker 1` / `Gary` / `Speaker 2` with `nuala` unnamed.
5. **The original sample has no source audio — PASSED.** Revealing the first passage of
   `Sample · Irish–English language practice` says "This recording has no source audio stored."
   and offers **no player**, while still showing the provider's own words. `tae` is intact in
   the Irish account, `tea` in the English one, and the saved `Dialext Test Speaker` assignment
   is intact and untouched (`user_speaker_assignment` for `human_id 9bd6646a-…`). It was not
   re-pointed.

#### The two interrupted milestone-boundary suites, rerun

Both were rerun to completion after the acceptance run, with the native app fully quit so the
cargo lock was free:

| Suite | Command | Result |
| --- | --- | --- |
| Full desktop vitest | `pnpm -F @anlg/desktop exec vitest run` | **468 files, 4,434 tests passed**, 0 failed (219s) |
| Full native `desktop` crate | `cargo test --locked -p desktop` | **57 passed**, 0 failed, 0 ignored (plus the empty integration and doc-test targets) |
| Branch-diff format | `dprint check` over the 302 files changed from `1f0643e` plus this file | Passed, no output. **rustfmt must be on `PATH`** — without the checkout-local toolchain it fails six Rust files with "Cannot start formatter process", which is a missing formatter, not a formatting failure |

Milestone 1c's boundary run was 466 files / 4,421 tests; the increase is milestone 2's own new
desktop tests. The native `desktop` count of 57 is unchanged. No inherited plugin Clippy
failure or Oxlint warning was re-examined in this run — they stand as recorded at the
milestone 2 commits, and neither was weakened.

#### Two defects found while doing this. Neither was caused by milestone 2's commits.

**A. An unnamed speaker and an unattributed passage collapse into one displayed speaker,
and it reaches the exported bytes.** The renderer's segment key is
`[channel, speaker_index, speaker_human_id]` (`SpeakerLabelManager` / `SegmentKeyUtils` in
`apps/desktop/src/stt/live-segment.ts`). Only a `provider_speaker_index` **hint** supplies
`speaker_index`; the provider label that Dialext stores as the `speaker` **string** in
`words_json`, and in `metadata.dialext.source_speaker`, is not consulted. The generated
alternate account carries those hints, so the Irish reading distinguishes its voices
correctly. The **selected account written by the import path does not**, so every unnamed
speaker in it keys as `[0, null, null]`:

- in `source-review`, nuala's passage and the unattributed `Hmm.` both render and export as
  `Speaker 1` in English, while Irish correctly shows `Speaker 1` and `Speaker 2`;
- in `second-meeting`, the two passages belong to **two different recording-level speakers**
  (`first-voice`, `second-voice`) and, being adjacent, merged into a single `Speaker 1` block
  in the default English reading.

The stored data is correct throughout — `speaker`, `source_speaker`, the anchors and
`dialext_speakers` all distinguish them — and the native command is correct: naming
`first-voice` Gary resolved only that speaker and **split the merged block**. So this is a
display and export derivation defect affecting unnamed speakers only. It nevertheless shows
two people as one person in the default reading, which is what milestone 2's "two provider
labels never conflated" is meant to exclude, so it should be fixed before milestone 3's
summary work depends on block identity. **This one has since been fixed — see "Defect A is
fixed" below.** Do not "fix" it again by matching provider label strings across readings,
which is the conflation the architecture forbids.

**B. The 17 September baseline edit moved text across a passage boundary in
`language-practice`'s English account.** Stored now: passage 0 is `"I"` and passage 1 is
`"would like to order tea. You can ask for coffee with milk."`. The fixture declares
`"I would like to order coffee."` and `"You can ask for coffee with milk."`. Every word the
reader sees is right and the `tea` correction is present, but passage 1 — anchored to the
**English** leg and `voice-b` — now carries text that was spoken by `voice-a` and anchored to
the **Irish** leg. The interface shows it: the `translated · Irish` control sits after `"I"`
instead of after `"tea."`. The Irish account of the same recording is undamaged.

This happened because defect A merged both passages into one editable block, so the baseline
correction was typed across a passage boundary. It pre-dates milestone 2, was recorded on
17 September only as "first passage corrected from coffee to tea", and is exactly the
anchor-to-evidence association `ARCHITECTURE.md` says must be preserved. It has been **left as
found** rather than repaired: it is baseline evidence, and rewriting a stored account to make
the fixture match is the kind of quiet correction this handover exists to prevent. Deciding
whether to repair the row, re-import the recording under a new identity, or leave it as a
known-damaged baseline is a call for the next session with Joshua.

## Defect A is fixed. Defect B is still there, by decision

Joshua chose to repair the speaker-key defect before starting milestone 3, and to leave the
damaged baseline text as found.

**One owner, one derivation.** `dialext_speakers::write_speaker_indexes` now writes every
account's `provider_speaker_index` hints from the recording's own speakers: each passage is
resolved through the existing `word_speaker` — `metadata.dialext.source_speaker` plus its
anchors, against `dialext_source_speakers` — and carries that speaker's `display_index`. Two
sources that happen to share a label string therefore stay two people, because the identity
comes from the attribution table and never from the label. A passage with no attribution, or
whose anchors disagree about who spoke, gets **no** hint and stays its own block.

It is called from the two places that already existed: inside `migrate_recording` in the same
adoption transaction, which covers every new import; and `migrate_all_speaker_indexes` after
`migrate_all_speakers` in `migrate_recordings`, which backfilled the recordings already
adopted. An index hint keeps its position in the array when it is rewritten, so a pass with
nothing to change writes nothing at all — asserted on `updated_at`, not just on content.

**`working_words` no longer writes hints.** It numbered by the order a label string first
appeared, which would have merged `irish-asr/A` with `english-asr/A` inside one account. Its
four hint lines are gone so one function owns the hint rather than two drifting.

**The desktop importer is deliberately unchanged.** Adding hints to the envelope would change
its content hash, and `apply_session_envelope` rejects changed content under the same identity
— an identical repeat import would stop answering `AlreadyApplied` and start failing as a
revision conflict. Deriving the hints natively, after the speaker registry exists, keeps repeat
imports idempotent.

Verified in the real window against the live database after a rebuild:

- `Sample · Source review with audio` in **English** now reads `Gary` / `Speaker 1` / `Gary` /
  `Speaker 2`, identical to its Irish reading. Before the fix, Nuala and the unattributed
  `Hmm.` were both `Speaker 1`. The TXT export carries the same two distinct speakers.
- `Sample · Second meeting with Gary` shows its two people as two blocks.
- Read back from the live database: the backfill wrote indexes 0/1/0/none and 0/1 for those two
  recordings and left both saved `user_speaker_assignment` hints untouched.
- **`language-practice` looks exactly as it did.** The prediction recorded above — that the
  backfill would visibly split its English reading — was wrong. Indexes 1 and 2 were written,
  but the saved `Dialext Test Speaker` assignment covers both passages, and a passage with a
  named human keys on that human, so they stay one named block. That is faithful to what the
  reader actually saved on 17 September. Defect B is therefore still present in the stored
  text, and still shows as the `translated · Irish` control sitting after `"I"`.

Automated: session-ingest **34** (31 before; three new), db-app **245** unit + **2**
integration (3 existing ignored), plugin db **162**, native `desktop` **57**, session-ingest
Clippy with `--features apply --all-targets --no-deps -- -D warnings`, and branch-diff dprint.
Desktop TypeScript is untouched by this change, so the **468 files / 4,434 tests** recorded
above still stand.

Negative controls, each run and confirmed red before the assertion was trusted: numbering by
the bare label string turned **only** `two_sources_sharing_a_provider_label_are_not_one_block`
red; removing the adoption call turned four tests red including the existing
`adoption_preserves_edits_hints_versions_and_is_idempotent`; and dropping non-index hints
turned `the_index_pass_keeps_a_saved_name_and_settles` red on the saved name.

A pre-fix copy of the prototype database was taken to `/tmp/dialext-prebackfill.db` before the
rebuild. It is a scratch file, not a durable backup. The running prototype now has
`source-review` selected in **English** — the acceptance run above proved Gaeilge survived a
restart before it was switched.

## Milestone 3 — checked editing and proposals (commits `ee4bd02`, `e9b74ca`, `9452be2`, `c74d843`, `4d3fffc`)

Completed and natively accepted on 21 September. `apps/desktop/src/session/queries/proposals.ts`
was read first and matched the handover exactly; that defect is fixed for Dialext proposals.

### What was built

- **`ee4bd02` — native checked edits and history.** `dialext_edits::edit_passage` and
  `undo_last_edit` pin `transcripts.content_version` (not `content_revision`) and compare it
  inside one `BEGIN IMMEDIATE` transaction. A stale base returns a `Stale` outcome rather than
  an error, and nothing is written. Only `text` moves: anchors, metadata and speaker
  attribution stay as stored. Migration `20260921120000_dialext_account_edits` adds the
  append-only history. It is additive, `Plain` scope, declared in the CloudSync registry as
  **not enabled**, with a no-update trigger and a unique partial index so one edit can be
  undone only once. Undo reverts the newest edit that is not itself an undo and has not been
  undone. It **refuses** when a writer outside this history changed the same words, rather than
  discarding that change. There is no redo.
- **`e9b74ca` — desktop wiring.** The editable transcript segment sends Dialext passages to
  `edit_dialext_passage`. Any transcript without a Dialext account keeps the upstream
  `updateTranscriptSegmentText` path. A refusal shows *"This reading changed in another window.
  Your text is still here. Refresh and review it before saving."* and leaves the typed text on
  screen.
- **`9452be2` — atomic proposals by block.** `dialext_proposals::apply_proposal` runs in one
  transaction. It compares the summary's and the account's `content_version`, replaces only the
  named blocks and sets the proposal to `applied`. A mismatch in either token leaves both
  untouched. A named block that has gone refuses the whole proposal. Migration
  `20260921120100_dialext_proposal_versions` adds four defaulted columns to the local,
  non-synced `session_proposals` inbox; an older inbox row keeps its behaviour. The same edit
  transaction creates one proposal per generated summary of the recording. That proposal targets
  only blocks whose text still reads as generated; a block the reader rewrote by hand is never
  proposed over. A later correction marks the earlier pending proposal for that summary
  `superseded` (a new status value), and undoing back to the summarised text withdraws it.
- **Block identity** is a `dialextBlock` wrapper node (`attrs.id`) in both editor schemas, and it
  exists only in generated outputs. The first attempt, an optional attribute on paragraphs and
  headings, made **every** note's stored JSON gain `dialextBlockId: null`. Fourteen editor tests
  caught it and it was reverted. Markdown export renders the wrapper's content with no identity
  in the text.
- **`c74d843` — deterministic outputs and undo control.** For a Dialext recording,
  `EnhancerService.enhance` skips the model. It writes a heading plus one `dialextBlock` per
  anchored passage of the **selected** reading, keyed by that passage's word id, and only into a
  still-empty document. An output that already has text is never regenerated. The picker's
  `targetNoteId` is deliberately ignored for these recordings, so a template adds another output
  (upstream replaces the one on screen). The pending auto-enhance record is discarded because no
  model run exists to resume. **Undo last correction** sits beside the reading selector.
- **`4d3fffc` — pin fix found by native acceptance** (see below).

### Native acceptance on 21 September — every step in the real window

The window was launched with `node dialext/dev.mjs` and driven with full-screen control
(background clicks still do not reach the webview). There were no provider calls, no mocked
database and no browser mock. All steps used `Sample · Source review with audio`, English
reading.

1. **Applying Lecture creates another output — PASSED.** Summary ▾ → search "Lecture" → the
   user template. A `template_output` titled Lecture appeared beside the supplied Summary, as a
   heading plus four `dialextBlock`s keyed `…:passage:0`–`3`. The supplied Summary kept
   `content_version` `fd029…` and 613 bytes throughout the run. **Side effect:** the picker's
   first "Lecture" entry is a suggested web template. Clicking it opened the template editor and
   created an empty **user template "Lecture" (`9feb44db…`)** in the prototype database. That is
   upstream picker behaviour; the template was left in place and used.
2. **Block identity survives the real editor — PASSED.** A manual edit to an unrelated block
   ("Thank you very much. **indeed**") was saved by the note editor with all four wrappers and
   ids intact. The editor also added its own title heading and a trailing paragraph.
3. **Accepting a targeted proposal preserves unrelated manual edits — PASSED.** A correction to
   passage 0 created one pending proposal for `passage:0` only. It was pinned to the Lecture
   version after the manual edit and to the account version the correction produced. A second
   correction superseded it live. Review summary → Apply to summary changed only `passage:0` (to
   "three tickets"). "…indeed", the title heading and the trailing paragraph survived, and the
   proposal became `applied`.
4. **A stale proposal refuses — PASSED.** A correction to passage 1 created a proposal. The
   Lecture's "Hmm." block was then edited by hand to "Hmm (pause).". Applying showed *"This
   proposal is stale. The meeting changed after it was created. It is still here to review."*
   The Lecture version stayed `6cbbfa8b…`, its passage 1 block still read "two tickets", and the
   proposal stayed `pending`. It also survived the restart below.
5. **Undo survives restart — PASSED.** After a full quit (`app_exit_requested`; no launcher,
   Vite or desktop process survived) and a fresh `node dialext/dev.mjs`, **Undo last correction**
   recorded edit 5 undoing edit 4, which was made before the restart. Passage 3 went back to
   "Hmm.", and the window said "Correction undone.".
6. **A stale edit refuses with the typing intact — PASSED after the fix.** "Hmm, maybe." was
   typed into passage 3. Before leaving the field, a second writer (a direct `sqlite3` write
   standing in for another window) changed passage 2. Leaving the field showed the refusal with
   "Hmm, maybe." still on screen. No edit 6 was recorded, the version stayed where the other
   writer left it, and passage 3 was still "Hmm.".

### The defect native acceptance found, and its fix

The first run of step 6 **was accepted**: edit 4 wrote "Hmm, yes indeed." over a base another
writer had just moved. The native compare was correct. The desktop bridge read `content_version`
at submission, so the pin described the database rather than the screen and could never refuse.
The live query does not observe out-of-process writes; the window kept showing the old passage 2
until the next in-process write.

`4d3fffc` pins a **live-queried** version (`useDialextEditVersion`) on the same invalidation as
the rendered words, captured when the reader starts typing, for both edits and undo. With no
version on screen, the bridge refuses rather than guessing. A regression test covers it, and a
negative control reinstating the submit-time read turned exactly that test red. Step 6 then
passed as recorded. Nothing was lost in the failed run, because the two writers touched
different passages.

### Limitations, stated exactly

- The refusal says "Refresh and review", but **there is no refresh control**. The words on
  screen catch up only on the next in-process write, or on reopening or restarting. Leaving edit
  mode discards the refused typing, so the reader must copy it first.
- A proposal refused as stale stays `pending` until declined. A later correction does not
  replace it unless the summary is unchanged since it was made. There is no "re-propose against
  the current summary" action.
- Imported (supplied) summaries have no block identity and never receive proposals. Only
  deterministic Dialext outputs do.
- The deterministic output ignores the template's sections, and "Regenerate" does nothing to a
  Dialext output that has text. Auto on an imported sample returns its supplied summary.
- Undo covers the selected account only and only edits in its history. Edits made on other
  paths (for example the upstream live-capture writer) block undo of the same words by design.
- Refusal text renders in the default text colour in this theme, not red.
- Chat, CLI and MCP inbox proposals still use the upstream timestamp path.
- Plugin Clippy and Oxlint stand as inherited: 207 warnings, no errors. zizmor was not rerun,
  because no workflow changed.

### Automated coverage

- session-ingest **48** (34 before).
- db-app **247** unit + 2 integration (3 existing ignored), including upgrade tests for both
  migrations.
- db plugin **162**; native `desktop` **57**.
- Editor **27 files / 204 tests**; desktop **472 files / 4,449 tests**.
- Clippy with `-D warnings` on session-ingest; Lingui extract/compile/check; dprint on every
  changed file; Node 82; licence 9 + check; validator 13.

Negative controls, each seen red before the assertion was trusted:

- dropping the version compare
- undoing oldest-first
- removing the outside-writer guard
- treating stale as success
- routing Dialext edits to the generic retrying path
- patching by position or ignoring block ids
- comparing only the document version
- proposing over hand-written blocks
- never superseding
- regenerating over existing text
- the submit-time pin

### State of the live prototype database after acceptance

A pre-milestone copy is at
`/private/tmp/claude-501/-Users-joshuacorbett-Coding-Dialext-Anarlog/e4cd4889-6ef3-4ca7-95b4-30c273526cb8/scratchpad/db-before-m3/`
(session scratch space, not a durable backup). Compared with it:

- `language-practice`'s transcripts, including **Defect B** and the saved `Dialext Test Speaker`
  hints, are **byte-identical**.
- Every pre-existing Dialext document is identical.
- `source-review`'s English account has edits 1–5: passage 0 is "I would like three tickets,
  please.", passage 1 is "That is fine, three tickets.", and passage 3 is back to "Hmm.".
- Passage 2 had two out-of-history `sqlite3` writes from steps 6 and 6-retry; the net effect
  restores it to "Thank you very much.".
- The Lecture output carries "…indeed", "Hmm (pause)." and "three tickets".
- One stale proposal (edit 3) is pending, and there is the empty "Lecture" user template.

These are acceptance artefacts, recorded rather than cleaned.

## Milestone 4 — native provider bridge

Completed and accepted on 21 September 2026. The implementation is split between the core
persistence/protocol commit `dd281ca` and the desktop integration commit that follows it on the
working branch. `dd281ca` appeared during the session authored as Joshua and includes the formerly
untracked `dialext/.Rhistory`; it was treated as external state and was not rewritten or removed.

### Durable boundary and helper contract

- Additive migration `20260922120000_dialext_provider_tasks` adds local-only
  `dialext_provider_tasks` and `dialext_provider_stages`. A task records provider/models, prompt
  version, audio digest, input revision and attempt. Successful ASR and reconstruction stages are
  immutable rows with content-addressed vault artefacts. Both tables are explicitly outside
  enabled CloudSync.
- `session-ingest::dialext_provider` creates recordings/tasks, claims and advances tasks, recovers
  interrupted work, cancels queued/running work and stores the final account. Every stage and
  account write is fenced by task id, attempt, input revision, audio digest and running status.
  Cancelling an in-flight helper now kills that child and settles the task as cancelled; a late
  result cannot be persisted.
- The Node helper is invoked as `node <canonical helper path>` with an argument array. Protocol v1
  input/output is bounded at 2 MiB, stdout contains only the response envelope, stderr contains
  diagnostics, and an unsupported version/stage or malformed/oversized result is refused by Rust.
  It has no listener, database connection or workspace-edit capability.
- Pure extraction in `dialext/engine/provider-contracts.mjs` retains Azure normalisation,
  reconstruction/chat request construction and response validation without the old worker,
  repository or deployment coupling. `reconstruction-validate.mjs` remains unchanged.
- The deterministic fixture performs separate `ga-IE` and `en-IE` ASR legs, then one target
  reconstruction. Request keys include the audio digest, source locale, provider/model, prompt
  version and target language as relevant. An alternate-language task and a reconstruction retry
  reuse the successful ASR stages.

### Visible desktop path

- Settings → Imports contains **Generate a Dialext reading**. It accepts a bounded PCM WAV, a
  title and English/Gaeilge first-reading choice, and says explicitly that this is a deterministic
  development provider with no paid call or quality assessment.
- The existing Transcript reading selector renders a missing account as **(generate)** when source
  audio exists. It starts the alternate task in place and retains the existing checked selector
  transaction once the account exists.
- The renderer displays named stages such as “Building the requested reading…” and never invents a
  completion percentage. Cancel, retry and open-recording actions are connected to the native
  task state.

### Native acceptance in the real window

The app was launched twice with `node dialext/dev.mjs`; no browser mock, alternate database,
credential or provider network request was used.

1. In Settings → Imports, `dialext/fixtures/source-review.wav` was selected with title
   **Milestone 4 provider bridge** and English first. The running state visibly said “Building the
   requested reading…”, then “Reading ready.”
2. Opening the recording showed the fixture English passages. The selector offered
   **Gaeilge (generate)**; choosing it created and selected the Irish account with “Dia dhuit. Seo
   sliocht tástála.” and “Go raibh maith agat.”
3. A full application-menu Quit left no `dev.mjs`, Vite or desktop process. A fresh launcher start
   retained the generated recording, both accounts, the active Gaeilge selection and the Irish
   transcript.
4. Read-only database inspection found two succeeded tasks and exactly four independently stored
   stages: `ga-IE` ASR, `en-IE` ASR, English reconstruction and Irish reconstruction. The pre-M4
   `language-practice` transcript/account/selection projection hashed identically before and after
   acceptance (`7581842a…`), retaining Defect B and the saved speaker state.

The fixture completes too quickly for a meaningful manual cancel click. Native regression coverage
therefore uses a deliberately non-returning helper and proves cancellation kills it within the
bound, leaves no stage, and settles `cancelled`. Separate tests prove completed ASR survives
cancel/restart and failed reconstruction retry does not repeat ASR.

### Snapshot, generated acceptance data and limitations

The app was closed before migration and the prototype database plus sidecars were copied. The
verified SQLite backup used for comparison is `/tmp/dialext-pre-m4.mCbuVJ/app.backup.db` (temporary
machine storage, not a durable backup). Acceptance intentionally added one synthetic recording,
two task rows, four stage rows, two accounts and their content-addressed audio/JSON artefacts to the
live prototype. They were left in place as acceptance evidence.

- Only the fixture provider is implemented and exposed. The helper location comes from
  `DIALEXT_PROVIDER_HELPER` in the debug launcher; packaged runtime discovery/distribution remains
  future work.
- No accuracy, transcription or translation claim can be made from this deterministic fixture.
  The one short live-provider sample was not run because Joshua's explicit approval is required.
- The generated fixture accounts intentionally use synthetic passage timing and unknown spoken
  language; they do not prove provider-quality word timing or speaker reconciliation.
- Milestone 5 remains responsible for stable-block source controls, footer questions,
  corrected-text retrieval and reader-matching TXT/Markdown sharing.

### Milestone-4 verification

- Pure provider/helper/validator: 19 tests.
- session-ingest: 52 tests, including in-flight process cancellation, cancel/restart stage reuse,
  reconstruction-failure retry and preferred/alternate generation; Clippy passes with warnings
  denied.
- db-app: 248 unit tests plus 2 integration tests passed (3 existing ignored); Clippy passes with
  warnings denied.
- db plugin: 162 tests passed. Its Clippy gate still stops on the same two inherited findings at
  `commands.rs:778` (`needless_borrow`) and `commands.rs:878` (`too_many_arguments`); neither is in
  the milestone diff.
- Desktop: typecheck passed; full suite 473 files / 4,452 tests; changed-file ESLint passed;
  Oxlint reported the inherited 207 warnings and no errors. Lingui extract/strict compile passed.
- Shared UI build, changed-file dprint, Node 82, licence 9 + boundary check and both release-version
  checks passed. No workflow changed, so zizmor was not rerun.

One parallel plugin-test run transiently timed out in an existing CloudSync activity timing test
while db-app's full suite was consuming the same machine. The required isolated rerun passed all
162 tests; this was load-induced test scheduling, not a retained failure.

## Milestone 5 — coherent personal workflow (implemented; native checklist passed)

Built on 22 September 2026. The additive migration ran against the live prototype database
without changing saved work. The native checklist was driven on 23 September in the existing
acceptance worktree; exact results and remaining limitations are recorded below.

### Decision recorded with Joshua

Questions are answered through the app's **existing, provider-agnostic model setting**. Apple's
on-device model (the prototype's configured `current_llm_provider = apple_foundation`) is
approved for testing only. Nothing is tied to it. A hosted model (Mistral Small, OpenAI, Claude,
…) must keep working through the same path, because Joshua may share the app later. A hosted or
paid call still needs his explicit approval.

### What was built

- **Stored per-block evidence.** The additive migration `20260923120000_dialext_block_evidence`
  adds a personal-only, CloudSync-disabled table with a TEXT `id` and a unique
  `(document_id, block_id)`. Each row stores the account, the account `content_version`, the
  passage word id, the block's pinned text, the passage's exact anchors, and the spoken and
  target languages.
- **Native output generation.** Output generation moved from TypeScript to native
  `dialext_outputs::generate_output` (plugin command `generate_dialext_output`). One
  `BEGIN IMMEDIATE` transaction reads the **active** account, writes the deterministic output
  only if it is still empty, and pins every block's evidence. The TypeScript document builder
  and passage loader, with their test, were removed rather than left as a second owner.
- **Accepted proposals re-pin evidence.** `apply_dialext_proposal` re-pins the evidence of
  exactly the blocks it replaces, in its existing atomic transaction, using the proposal's
  pinned account version. A stale proposal leaves evidence untouched.
- **Block source control.** It is a `dialextBlock` node view supplied through the note
  editor's existing `extraNodeViews`, so the editor package knows nothing about Dialext. It is
  quiet: it appears on hover or focus within the block. It is **absent** when a block has no
  stored evidence, and it never borrows a neighbour's evidence.
  - If the block's current text differs from the pinned text, the control reads
    `edited · source`. The panel then says the passage supports the generated wording, not
    the reader's edit.
  - **Outputs generated before milestone 5 have no evidence and show no control.** Evidence is
    never backfilled by guessing, and the migration test asserts zero backfilled rows.
- **One source panel for the whole app.** The reveal is now one small store, and the
  provider and slot sit once per recording workspace, below whichever tab is showing. Transcript
  marks, summary blocks and chat citations all open that same panel. It states where the reveal
  came from: a summary block, an edited block, or an answer's quotation.
- **Grounded questions in the existing chat.** No second chat product was added.
  - When the last question references **exactly one** recording (normally the `auto-current`
    ref) and that recording is Dialext, the transport hands it to `answerRecordingQuestion`.
    Every other conversation keeps the existing tool agent unchanged.
  - Retrieval reads the effective transcript and the speaker rendering that chat context,
    export and the panel already use (`renderSessionSegments`, extracted from the hydrator).
    It therefore uses the **selected, corrected reading** and the names the reader sees.
  - Evidence is refused, and **no model is called**, when there is no usable selected reading,
    when the effective projection is not the selected account, or when the question names
    something specific that no passage mentions.
  - Otherwise, passages sharing a term come first, within a 2,400-character budget sized for an
    on-device context window.
  - The model returns `{answer, citations[{passage, quote}], insufficient_evidence}` through
    `generateText` + `Output.object`. Validation uses the original Dialext answer rules: an
    answer must cite, a refusal must not, each cited passage must have been supplied, and each
    quotation must be contiguous passage text (case- and whitespace-insensitive).
  - An answer that fails validation shows **no model prose**. A model that cannot run at all
    surfaces as an error, not a quiet refusal.
  - Refusal text follows the reading's language: English or Irish. The Irish strings are
    hand-written and unreviewed; Joshua should check them.
  - Citations are stored as a `data-dialext-answer` part of the chat message. It carries the
    passage anchors, so a citation reopens the same panel after a restart, and the native
    interval read re-checks the anchors every time. The chat shows the answer as model-written
    and each quotation apart from it.
- **Sharing.** The existing More → Export TXT/Markdown already takes the effective transcript
  segments and serialises `dialextBlock` content without identity. A regression now proves that
  a Dialext output plus transcript exports the visible block text, including a hand edit, and
  `Speaker: text` lines, with no block ids.

### Verification (22 September)

| Check | Result |
| --- | --- |
| session-ingest (`--features apply`) | 58 passed (52 before). Clippy `-D warnings` passed |
| db-app | 249 unit + 2 integration passed (3 existing ignored). Clippy `-D warnings` passed. Includes an upgrade test (existing summary's `content_version` unchanged, no backfill) and the CloudSync registry at 32 |
| db plugin | 162 passed; bindings/permissions regenerated through `export_types` and the build |
| Desktop | typecheck passed; full suite **476 files / 4,483 tests** passed; changed-file ESLint and dprint clean; Oxlint 207 inherited warnings, 0 errors |
| Node | CI node tests 82; Dialext engine 19; licence 9 + boundary check |
| Lingui | extract + strict compile passed; ten new strings |
| Live DB | migration applied on launch; `dialext_block_evidence` empty; the fingerprint of every Dialext transcript, account, selection, document, evidence row and contact is byte-identical before and after (`39a0f71d…`) |

Negative controls, each seen red and then restored:

- no evidence re-pin on accept
- pinning from any account instead of the active one
- never detecting an edited block
- lending evidence by position
- removing the deterministic no-match refusal
- not checking quotations
- taking the grounded path for multi-ref questions
- answering from an effective transcript that is not the selected account

The pre-milestone backup is at
`/private/tmp/claude-501/-Users-joshuacorbett-Coding-Dialext-Anarlog/4ade5935-a86a-4c05-a140-7a25f26f2d03/scratchpad/db-before-m5/app.backup.db`
(integrity `ok`; session scratch, not a durable backup). The fingerprint query sits beside it as
`fingerprint.sql`.

### Limitations, stated exactly

- Apple's on-device model can return citation fields in varying shapes. The validator now
  accepts an exact supplied labelled passage as a reference and derives a quotation from it
  only when the model omitted `quote`. It still rejects unknown references and mismatched
  quotations. Invalid model prose is never displayed as a grounded answer.
- Retrieval is lexical: shared terms, a four-letter shared stem, and English/Irish stopwords.
  A paraphrased question about a long recording can be refused as no-match. Short recordings
  get the whole reading within the budget.
- Grounded questions are single-turn; earlier messages are not used. While a Dialext recording
  is the only context, the chat's edit tools (edit_summary, apply_session_correction, …) are not
  offered for it. Add another reference to use the ordinary agent.
- A citation opens its recording tab if another tab is in front. It is not otherwise
  scrolled into view.
- The block control appears on hover or focus-within. Reaching it by keyboard inside the
  editor was not verified.
- Exports stay plain, with no source annotations. Share means a TXT/Markdown file, not a
  hosted link.

### Real-window acceptance checklist (completed 23 September)

Launch with `node dialext/dev.mjs`, never a release build. Use `Sample · Source review with audio`.

1. Summary ▾ → choose a template not yet applied to this recording (for example Interview). A
   new output appears. Hover a block and check for `source · translated · Irish`, then click it.
   The panel should say "generated from this passage of the English reading", show the Irish
   words, and offer a 0:04 clip. Confirm that the older Lecture output shows **no** block
   controls.
2. Edit that block's text. The control should read `edited · source`, and the panel should say
   it supports the generated wording, not your edit.
3. Correct the same passage in the transcript, then apply the proposal. The control should go
   back to `source · …`.
4. Ask anything: "How many tickets did Gary want?" Expect an answer with a quoted citation whose
   source control opens the same panel. Then ask "What is the capital of France?" Expect "The
   recording does not answer that." and "no model was asked".
5. Switch to Gaeilge and ask an Irish question. Check that the citations are Irish passages.
6. Quit fully and relaunch. Reopen the chat and confirm the earlier citation still opens the
   panel.
7. More → Export the new output with the transcript as TXT and as Markdown. Check the bytes:
   visible block text, `Gary:` lines, no `dialextBlock` or passage ids.
8. Re-run the fingerprint query and compare it to the backup, expecting differences only from
   steps 1–5. Inspect `dialext_block_evidence` for the new output.

### Native acceptance continuation (23 September)

Shared base: `d3e718225d125bc71284270acdf2af2cc09bbd54`, the requested local
milestone 7 checkpoint. Acceptance ran on `codex/m5-native-acceptance` in
`/Users/joshuacorbett/Coding/Dialext-m5-native`; nothing was pushed or published.
Dependencies were installed offline with `npx --yes pnpm@11.1.1 install --offline
--frozen-lockfile` (2,494 packages reused). The worktree used separate build caches
and the synthetic vault with the existing checkout-local Rust toolchain.

**Native checklist.** Launched and relaunched only with `node dialext/dev.mjs` using
`Sample · Source review with audio`, synthetic evidence and the configured
`apple_foundation` / `System Language Model`. No live or paid provider was called.

1. Generated the unused Customer Discovery Interview output alongside Summary and
   Lecture. Its first block showed `source · translated · Irish`; the panel showed
   the English reading, Irish ASR `Ba mhaith liom dhá thicéad, le do thoil.`,
   and exact 0:00–0:04 audio. Playback reached four seconds. The older Lecture
   output had no block-source controls.
2. Edited the first block to `I would like three tickets, please. Native
   acceptance edit.` It showed `edited · source`; the panel explicitly qualified
   the generated wording. A transcript correction first produced no Interview
   proposal because the block was hand-edited. This is the intentional
   `a_block_the_reader_rewrote_is_never_proposed_over` protection. Restored the
   Interview block to the current four-ticket reading, corrected that passage to
   five tickets, and applied the new Interview proposal. The block then read
   `I would like five tickets, please.`, showed generated-source semantics and
   opened the same 0:00–0:04 panel. Its proposal is `applied`; unrelated Lecture
   proposals remain untouched.
3. Asked `How many tickets did Gary want?` The first on-device reply was safely
   rejected with `unknown_passage`: the model returned an entire labelled
   passage where the validator expected `P1`. After the exact-line fix, the
   native retry answered `five`, quoted the corrected English reading and
   opened the source panel. Asked `What is the capital of France?` and saw
   `The recording does not answer that.` with `no model was asked`.
4. Switched to Gaeilge and asked `Cé mhéad ticéad a bhí Gary ag iarraidh?`
   The first response was safely rejected as `unparseable_answer`: one citation
   lacked a `quote` although it supplied the exact passage line. After the
   narrow fallback and prompt clarification, the native retry answered
   `Dá thicéad` with Irish quotations. The Gary citation reopened the Irish
   0:00–0:04 source panel.
5. Fully quit via the native application menu; process and port 1422 stopped.
   Relaunched with the supported launcher, opened Chat history → Tickets for
   Gary, and verified the saved English citation still opened its source panel
   and interval.
6. Exported the selected Interview output plus transcript through the real UI
   as TXT (487 bytes) and Markdown (462 bytes). Both files contain the visible
   five-ticket block, `Gary:` speaker lines and no `dialextBlock` or
   passage/account IDs. The transcript is Irish because Gaeilge was selected
   for the current reading.
7. Compared the live SQLite database with `app.pre-window.db`. The sample
   has one added output and four block-evidence rows. Its first pin has the
   five-ticket text, the current English `content_version`, the Irish ASR
   anchor and 0–4000 ms interval. The other three pins retain their original
   account version and anchors. The English transcript has the expected
   corrections and history entries; the active selection changed to Gaeilge.
   All `dialext_accounts` and all 15 `dialext_evidence` rows are unchanged;
   all 15 evidence files still match `evidence.before.json` SHA-256 values.
   SQLite `integrity_check` is `ok`. Three non-sample documents also differ
   from the pre-window backup; this acceptance work did not edit them. The
   sample's older output was not overwritten.

**Startup and validation details.** A copied Swift build cache referenced the original
checkout, so only this worktree's generated `*/out/swift-rs` caches were removed.
The first native build then failed at
`plugins/permissions/swift/check-permissions.swift:87` with
`cannot find AXIsProcessTrusted in scope`. The installed SDK declares it in
ApplicationServices; importing that framework fixed direct Swift compilation
and the full debug launch. Its read-only accessibility query returned
`untrusted`. Swift formatting matched; strict Swift lint still has two
inherited `TCC_PATH` naming warnings. Another checkout's launcher occupied
port 1422; Joshua authorized stopping that specific process tree, after which
this worktree launched. Earlier, connecting window control by display name
briefly opened the old debug bundle; it was quit without acceptance actions.
All subsequent connections used this worktree's exact bundle path.

Before the citation changes, focused milestone 5 tests passed **5 files /
31 tests**, desktop typecheck passed, the licence suite passed **9 tests** plus
the boundary scan, and the complete CI Node command passed **82 tests**.
The first full desktop run overlapped native compilation: **474 files /
4,474 tests passed**, with **5 files / 8 tests** hitting the existing five-second
timeout. An unchanged rerun of those files passed **28 tests**; a full rerun
without native compilation passed **479 files / 4,482 tests** in 128.78 seconds.
After the citation fixes, focused tests passed **3 files / 26 tests**,
desktop typecheck, changed-file ESLint and dprint passed, and Oxlint found
**206 existing warnings, 0 errors**. The post-change full desktop suite
passed **479 files / 4,484 tests** in 162.61 seconds.
`uvx zizmor --format sarif .` reported 358 inherited findings (160 error,
81 warning, 117 note); no workflows changed. Logs and the pre-window backup
remain under the ignored `.dialext-data/m5-acceptance/` directory.

Keyboard reachability of the quiet block source control was not established:
one Tab from the editor did not focus it. This is a documented interaction
limitation, not a claim of keyboard acceptance. The generated output and
on-device answers are deterministic-fixture and one-model acceptance only,
not a general language-quality evaluation.

### Integration and real-window smoke test (23 September, primary checkout)

The milestone 5 acceptance commit (`a782e9d` → `2cc2308`) and the in-memory SQLite pool fix
(`52b885f` → `efec9e1`) were cherry-picked onto `codex/dialext-personal-prototype` without
conflicts. The milestone 5 checklist was not rerun; integration did not change its behaviour.

Checks: `cargo test --locked -p db-core --lib` 108 passed; `cargo test --locked -p
session-ingest` 62 passed on 12 consecutive runs (the "no such table:
dialext_provider_tasks" flake did not recur); db-core Clippy `--all-targets -D warnings`
clean; desktop `src/dialext` + `src/chat` vitest 60 files / 376 tests; desktop typecheck,
changed-file dprint and ESLint pass; Oxlint 206 existing warnings, 0 errors. The full
desktop suite was not rerun (not a milestone boundary).

Smoke test with `node dialext/dev.mjs`, synthetic samples and the configured Apple on-device
model only. The pre-smoke backup is `.dialext-data/smoke-0923/app.pre-smoke.db`.

1. **Deterministic WAV generation.** `node dialext/fixtures/make-synthetic-audio.mjs`
   reproduced both committed WAVs byte for byte (same SHA-256; clean tree). In Settings →
   Imports, Generate a Dialext reading from `second-meeting.wav` titled `Smoke 23 Sep ·
   generated from WAV` reported `Reading ready.`; its English reading is the fixture text.
2. **Import.** Re-importing `source-review.json` + `.wav` opened the existing sample with
   no duplicate and no changed rows.
3. **Reading-language switching.** On the generated recording, `Gaeilge (generate)` produced
   `Dia dhuit. Seo sliocht tástála. Go raibh maith agat.` and switching back showed the
   English reading.
4. **Grounded answer.** On `Sample · Source review with audio` (Irish selected), `How many
   tickets did Gary want?` answered `Two` citing two Irish-reading passages. Both citations
   opened the source panel at the right interval (Irish 0:00–0:04; English 0:04–0:06).
   **Defect found and fixed (`e5cd91f`):** the second citation was labelled
   `00000000-0000-0000-0000-000000000000`, not the panel's `Speaker 1`. Question evidence
   rendered without the session speaker context, so a direct-mic passage was assigned to
   the nil owner id. After the fix the same question labelled it `Speaker 1`. Answers saved
   before the fix keep their stored label.
5. Quit through the application menu; the process and port 1422 stopped. SQLite
   `integrity_check` is `ok`. No pre-existing row changed in `dialext_accounts`,
   `dialext_evidence`, `dialext_recordings`, `transcripts`, `session_documents` or
   `dialext_block_evidence`. The only new session is the generated recording.

**Answer language (fixed in the follow-up commit).** In step 4 the on-device model answered
`Two` in English although the prompt asked for Irish, and nothing checked. Answers are now
checked by the app, not the model: `dialext/answer-language.ts` classifies a short answer as
English or Irish by marker words (numerals, function words) and fadas, leaving answers with no
signal (a bare name, digits) alone. An answer clearly in the other language gets one corrective
retry; if it is still wrong, the reader gets the `invalid` refusal (`code: wrong_language`)
in the reading's language instead of prose they may not read. The prompt also ends with
`Answer in <language>.`. The check runs whichever model answers. Native result: the same
question on the Irish reading answered `dhá thicéad` with both citations. The window does not
show whether the retry was needed. Only English and Irish are enforced, and the check is a
heuristic for short answers, not general language identification.

Other notes: the macOS Open panel runs in a separate process. Window control granted for
Dialext does not cover it, so Joshua chose the files for steps 1 and 2. He has said he will
grant access to it, so next time request access for the panel's process while it is open.
The ChatGPT Record and Granola rows on the Imports page are intended: milestone 7 keeps them
as local **Choose files** imports and removes only their account-linked controls.

## New direction from Joshua (22 September) and milestone 6 — quiet interface

Joshua added a "Making it Dialext's own" section to `product/product-vision.md`, and
`ARCHITECTURE.md` now lists milestones 6–9:

- **6** quiet interface
- **7** independent entitlements: no Anarlog login or plan gates on local features, hosted-only
  features hidden, and the `useBillingAccess` seam kept for a future account system
- **8** user-visible Dialext branding, with the MIT notice retained
- **9** a personal look (fonts and colours), which waits for Joshua's choices

**Milestone 6 is implemented and passed its real-window acceptance on 22 September 2026.**
Root cause of the "purple pop-ups":

- The devtools status bar shows in every debug build (`should_show_devtool` returns true under
  `debug_assertions`), and the launcher always builds debug.
- Its render outlines defaulted to `import.meta.env.DEV`, so every re-render drew purple boxes
  labelled with component names.

Fix:

- A new setting, `show_developer_diagnostics`, defaults to **off**. The bar, and with it the
  metrics and the render tracker, mounts only when the build allows it **and** the person has
  opted in.
- The opt-in is Settings → Developers → **Show developer diagnostics**. It is shown only in
  builds that can display the bar.
- Outlines now default to off even when opted in, and are toggled from the bar's Renders metric.

Nothing was deleted. Analytics: debug builds compile no PostHog key, so nothing is sent today.
Making analytics off by default for release builds is tracked in milestone 6's scope but not yet
changed; there is no release build.

Checks:

- Desktop typecheck passed.
- Full suite: **476 files / 4,484 tests** passed.
- Oxlint: 207 inherited warnings, 0 errors. Changed-file dprint and ESLint are clean.
- Lingui extract and strict compile passed.
- Negative control: removing the opt-in gate turns
  `stays hidden in a development build until the person opts in` red. The first version of that
  test asserted before the query settled and passed with the gate removed. It was strengthened,
  and only then trusted.
- Also fixed: a typing error in the milestone 5 transport test (`unknown[]` context refs), which
  the earlier typecheck had run before that test existed.

Real-window result, using only `node dialext/dev.mjs`: the isolated debug prototype opened with
no black diagnostics bar and no purple render outlines. Settings → Developers → Show developer
diagnostics restored the bar; switching it off removed the bar again. No release build was used.

## Milestone 7 — independent entitlements (two bounded slices; not yet accepted)

### First bounded slice

Implemented on 22 September 2026. This is a verified slice, not completion of the whole
milestone.

#### Entitlement seam and local capabilities

- `useBillingAccess` remains the single renderer entitlement seam. `BillingAccess` now has a
  distinct `localFeatures` capability object for playback speed, dictionary, Auto-template
  customization and local automations. The ordinary Anarlog billing provider maps those
  capabilities from its existing Pro state; the personal provider supplies only those four
  local capabilities.
- The personal provider deliberately remains `isPro: false`, `isPaid: false`, with no available
  trial and a no-op upgrade action. This is not a blanket paid-flag override.
- The personal auth provider has no Supabase client or session and returns no request headers.
  The main personal shell mounts these providers instead of the account-backed auth and billing
  providers.
- Playback-rate enforcement and its menu, Dictionary, Auto-template save/reset/improve, and
  local automation save/enable now consult their specific local capability. The existing plan
  seam and denial behavior remain testable with a provider that sets one false.

#### Personal shell and hosted-service boundary

- Account, Team and Sync settings destinations are absent; restored legacy destinations fall
  back to General. Login and calendar account steps no longer appear in personal onboarding.
- Sign-in and generic Pro-upgrade promotional toasts were removed. Recording, microphone,
  permission, model-download, missing-provider and error notices remain.
- The completed-note primary action is now local **Export note**, using the existing PDF/TXT/
  Markdown/Org export dialog, instead of hosted session sharing.
- Anarlog-hosted LLM/STT choices are filtered from the provider selectors. Direct configured
  providers and on-device choices remain available and provider-agnostic.
- CloudSync/share/attachment/Cloud API lifecycles, workspace mirroring, invitation toasts,
  connected meeting import sync and enterprise capture sync are not mounted by the personal
  shell. Auth/billing/share deep-link handling is also not mounted.
- Completion and enhancement no longer schedule Cloud API snapshot uploads. Local deletion no
  longer reads module-level Anarlog auth or schedules Cloud API/share cleanup.
- Personal automation callers pass `allowHostedServices: false`. Slack, Notion and Linear
  starters/actions and the shared automation library are hidden; previously saved hosted
  workflows are preserved but cannot be enabled or executed. Markdown-only workflows remain
  editable and executable. Engine regressions prove the false policy skips connection/auth
  reads and hosted writes while still running Markdown export.
- Internal `@anlg`/`anlg_` identifiers, hosted implementations, migrations, licences, evidence
  and saved edits remain intact. Branding and visual changes stay deferred.

#### Exact validation

- Focused capability/shell regression set: 14 files / 154 tests passed.
- Focused automation and local-export set: 6 files / 104 tests passed.
- Final hosted-boundary regression set: 5 files / 111 tests passed. It includes production-call
  assertions for `allowHostedServices: false` and local deletion with no hosted cleanup.
- Final full desktop suite: **479 files / 4,482 tests passed**.
- `pnpm -F @anlg/ui build`: passed.
- `pnpm -F @anlg/desktop typecheck`: passed on the final source state.
- ESLint on every changed desktop TypeScript/TSX file: passed; Node printed the inherited
  module-type warning for `eslint.config.js`.
- Desktop Oxlint: **206 inherited warnings, 0 errors**.
- Changed-file dprint format/check: passed.
- Lingui clean extraction and strict compilation: passed with 1,491 source messages and 1,476
  missing messages in each non-English catalog. The generated catalog edits are intentional and
  remain uncommitted with this slice.

#### Native synthetic verification

Launched and stopped the isolated application only with `node dialext/dev.mjs`; no release
build, live provider or paid provider call was used.

- Settings had no Account, Teams or Sync destination. Dictionary opened directly. The Auto
  template editor exposed its prompt, Improve and Save controls without a plan interruption.
- A synthetic recording exposed playback rates 0.5x through 2x. 1.5x could be selected and was
  restored to 1x without playing audio or making a provider call.
- Transcription and Intelligence showed direct/on-device providers and did not show Anarlog.
  Developers showed diagnostics and local CLI material, not Cloud API or Webhooks.
- Automations showed only **Export every meeting as Markdown**. Save draft was available; Save
  & enable was blocked only by the actionable `Choose an export folder first` requirement, not
  by Pro or login.
- `Sample · Source review with audio` showed **Export note**. Opening it displayed the existing
  local file-format/include dialog; it was dismissed without writing a file.
- No sign-in, trial or upgrade interruption appeared during launch, restart or this navigation.
- Milestone 6's diagnostics off/on/off behavior passed in the same isolated window. **Milestone
  5's separate source-control/question/restart/export checklist was not run and remains
  outstanding.**

Observed inherited native diagnostics included Rust warnings, SQLite transaction warnings,
`no_version_in_config`, occasional IPC fallback/performance logging and the existing router
code-split warning. They did not block this slice and were not treated as release validation.

### Second bounded slice — hosted surface isolation

Implemented on 22 September 2026 on branch `codex/m7-hosted-surface-isolation`, in a separate
worktree, as one commit on top of `d3e7182` (`wip: checkpoint Dialext milestone 7 entitlement
slice`), which holds the first slice above and its regenerated catalogs. **Automated checks
pass; real-window acceptance of this slice is outstanding (see below). Milestone 7 is not
accepted.**

#### Policy

- `apps/desktop/src/auth/account-services.ts` exports `ANARLOG_ACCOUNT_SERVICES_ENABLED = false`,
  a build-time statement that the personal shell has no Anarlog account.
  `ANARLOG_HOSTED_AUTOMATIONS_ENABLED` now derives from it, so the existing automation
  execution policy keeps its value.
- `useBillingAccess`, the four `localFeatures` capabilities and the personal
  `isPro: false`/`isPaid: false` provider are unchanged. Direct provider and provider-owned
  OAuth/subscription flows (e.g. Settings → Intelligence connect) are untouched.
- The account-backed implementations stay in the tree behind that constant. Tests of the
  retained paths now mock it `true`; new personal-shell tests use the real value.

#### What the personal shell no longer mounts or shows

- **Folders:** the folder editor renders a local-only variant with no Share button and no
  `useSharedResources` query. Rename and delete are local; the hosted share move/delete
  bookkeeping lives only in the account-backed wrapper. The "Shared with me" folder library and
  its import are not rendered.
- **Templates:** no Share button in the template editor and no "Shared with me" library in the
  Templates sidebar. Local create/edit/duplicate/delete and Auto are unchanged.
- **Imports:** a local file-only list replaces the connected list. Detected apps keep **Choose
  files** (including apps whose connection was MCP, CLI or Anarlog/Nango-hosted); Connect &
  import, Sign in to connect, Disconnect and Sync now are absent; `useAuth`, `useConnections`
  and connected credential/sync queries are not called. Providers listed only for their hosted
  connection (Google Meet, `alwaysAvailable` without an installed app) are hidden. **Import a
  Dialext recording** and provider generation are unchanged. Onboarding's import step now
  skips itself when nothing local is detected (Google Meet previously kept it open).
- **Calendar:** the sidebar offers Apple Calendar only, with its permission, reconnect and
  disconnect behaviour intact. Google/Outlook rows, their OAuth prompts, `useConnections` and
  `useOpenIntegrationUrl` are not mounted. The calendar view still schedules and range-syncs
  local calendars but no longer mounts the account connection query.
- **Settings → Meetings:** the hosted "Default sharing" selector is hidden; the stored
  `default_meeting_share_access` value is untouched.
- **Settings → Appearance:** the App icon picker is hidden behind
  `ANARLOG_APP_ICONS_ENABLED` (`settings/appearance/app-icon-access.ts`), so its Pro gate is
  no longer reachable. Theme and sidebar settings, the picker itself and the stored `app_icon`
  preference are untouched; milestone 8 decides Dialext's icons.
- **Restored tabs and navigation:** `getDefaultState` normalizes legacy inputs before a tab is
  created. `shared_sessions` and `shared_note_preview` open the local home (empty) tab;
  settings `account`, `sync`, `team` and `todo` open General. This covers pinned-tab restore,
  closed-tab restore, native `openTab`/settings navigation and search results, so the
  shared-note "Sign in" screens cannot mount. The account/share deep-link handler remains
  unmounted from the first slice; such links are ignored, not handled.

#### Regressions added

- `folders/index.test.tsx`: under the personal providers, folder context, rename and delete
  work with no Share control, no shared library, no `useSharedResources` call and no hosted
  move/delete.
- `templates/personal-shell.test.tsx`: editing a template saves locally without a Share
  control; the sidebar lists local templates without the shared library; no hosted query.
- `imports/local-screen.test.tsx`: local file imports listed and working (Choose files → read →
  `importMeetingFiles`); no connect/sign-in controls; no auth, connections, credential or sync
  hooks; Settings → Imports keeps the Dialext recording import beside them; hosted-only
  listings let onboarding skip.
- `calendar/components/sidebar.test.tsx`: Apple only, no Google/Outlook, no sign-in, no
  connections or integration hooks (existing Apple tests now run in the personal
  configuration). `calendar/components/calendar-view.test.tsx`: local sync runs without the
  account connection query.
- `store/zustand/tabs/personal-shell.test.tsx`: the shipped flag is false; shared-note inputs
  become the local home tab and render it without mounting shared-note content; legacy account
  settings open General; closed-tab and pinned-tab restore stay local.
- `settings/general/meeting-settings.test.tsx`: Default sharing is absent without account
  services.

#### Exact validation (this slice)

- Baseline before editing (worktree at the base commit): the affected-area tests passed,
  67 files / 552 tests.
- Focused regression set (folders, templates, both import suites, calendar sidebar/view, all
  tab-store tests, meeting settings, personal providers, automations): **22 files / 218 tests
  passed**.
- Full desktop suite: **483 files / 4,502 tests passed**.
- `pnpm -F @anlg/ui build`: passed. `pnpm -F @anlg/desktop typecheck` (`tsc --noEmit`):
  passed on the final source state.
- ESLint on every changed desktop TypeScript/TSX file: passed; only the inherited
  `eslint.config.js` module-type warning was printed.
- Desktop Oxlint: **206 inherited warnings, 0 errors**; none are in changed files.
- Changed-file dprint format/check: passed. (`HANDOFF.md` is outside dprint's file set.)
- Lingui clean extraction and strict compilation, and `pnpm -F @anlg/desktop i18n:check`:
  passed with **no catalog changes**. No user-facing string was added; the import result
  summary kept its placeholder names so the 109 locale catalogs did not churn.
- Licence-boundary tests (9) and boundary check: passed.
- No live or paid provider call, no network publish, no push and no release build.

#### Native verification: not run — acceptance outstanding

No native check was run for this slice. The dev launcher resolves its toolchain and vault from
the checkout root, but this worktree has no `.dialext-tools` (and no global `cargo`), would
need a cold Rust build, and would share the `app.dialext.prototype` application data with the
primary checkout, where another agent is working. Doing that safely needs Joshua's go-ahead and
window control. Real-window checklist, using only `node dialext/dev.mjs` from the checkout that
owns the prototype vault and synthetic samples:

1. Folders: create, rename, set context, add/remove a material, delete. No Share button and no
   "Shared with me" section.
2. Templates: create, edit, duplicate and delete a template; Auto still opens. No Share button
   and no "Shared with me" section.
3. Settings → Imports: **Import a Dialext recording** and generation are present; detected apps
   show only **Choose files**; no Connect, Sign in or Google Meet row.
4. Calendar: only Apple Calendar is listed; permission prompt/recovery, reconnect and disconnect
   still work; no Google/Outlook and no sign-in tooltip.
5. Settings → Meetings: no Default sharing row.
6. Settings → Appearance: theme and sidebar options are present; there is no App icon section.
7. No sign-in, upgrade or trial prompt appears across launch, restart and the steps above.
   Recording, permission, download, missing-provider and error notices still appear where
   they apply.

#### Connectors and service seam (23 September): implemented, live acceptance in progress

Commits `bed4df2` (providers see Dialext), `051bf80` (hosted connections go only through
`dialextService()` / `DIALEXT_SERVICE_URL`, unset by default) and `d9a2c89` (local MCP/CLI
connectors open without an account; `LocalMeetingImportSync` in the main window). Checks: full
desktop suite 486 files / 4,558 tests; importer 13, calendar 19 and calendar plugin 2 Rust tests;
Clippy `-D warnings` on the importer, calendar plugin and calendar library; typecheck, changed-file
dprint/ESLint, Lingui extract/compile stable, licence boundary. Inherited, not introduced: Clippy
with tests on `calendar` fails "items after a test module"; ESLint reports two
`exhaustive-deps` errors in `imports/connected-import.ts` at lines unchanged by this work.

Real window so far: Imports shows Granola with **Connect & import** and **Choose files**, no
Documentation link; Calendar lists Apple Calendar only; no Anarlog or `localhost:3001` request in
the app logs and the native process holds only its relay socket (webview traffic was not
observed). Pressing Connect opened Granola's sign-in in Chrome; the session ended there, before
sign-in. **Outstanding:** confirm the consent screen says Dialext, the first sync, a repeat sync
with no duplicates, and Disconnect. Joshua approved using his own Granola account; its meetings
import into the prototype database as ordinary notes. Backup before this check:
`.dialext-data/connectors-0923/app.pre-connectors.db`.

#### What remains in milestone 7

- **Connectors and service seam:** [CONNECTORS_PLAN.md](CONNECTORS_PLAN.md) (plan only, 23
  September). It opens the local MCP/CLI importers without sign-in, makes other services see
  Dialext, and routes hosted imports and Google/Outlook calendar through a Dialext service seam
  that is unset by default, so nothing calls Anarlog. It supersedes this section's "detected
  apps show only Choose files" for MCP/CLI providers.
- The real-window acceptance above.
- **App icon:** Joshua chose to hide the picker for now, so its Pro gate — the only reachable
  Pro interruption this audit found — is gone. Milestone 8 still has to choose Dialext's icons
  and decide whether picking one becomes a local capability or stays hidden.
- The chat `web_search` tool targets Anarlog's hosted research endpoint. Without auth headers
  it makes no request; its refusal to the model now reads "Web search is not available in this
  build." instead of asking for a sign-in that cannot happen. The tool itself is still
  registered: removing or replacing it changes model tools, so that needs a decision.
- The template gallery (Templates tab and note template picker) still fetches public suggested
  templates from `https://anarlog.so/api/templates` without an account. Milestone 3's "Lecture"
  template came from it; replacing it with bundled local templates is separate template work.
- Native calendar discovery (`plugins/calendar`, `list_connection_ids`) still asks the Anarlog
  API for Google/Outlook connections if a legacy Anarlog access token is stored by the auth
  plugin. The personal shell cannot create one; a native guard would be a separate Rust
  change.
- The note editor's owned-share comment query stays mounted but disabled without a session;
  it sits inside the core editor and was not changed.
- Upstream documentation links (Imports, calendar docs) belong to milestone 8.

Do not delete the retained storage, migrations or implementations, and do not replace the
capability split with `isPro: true`.
