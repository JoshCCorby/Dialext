# Start here: Dialext handover

Prepared 16–17 September 2026 for continuation in a smaller-model session. Read this before inspecting the whole monorepo. The architecture is ready for implementation; the full product and native workflow acceptance are not complete.

## Repository and authority

- Private repository: https://github.com/JoshCCorby/Dialext
- Local checkout: `/Users/joshuacorbett/Coding/Dialext-Anarlog`
- Working branch: `codex/dialext-personal-prototype`, tracking `origin/main`.
- `origin` is Joshua's new repository. `upstream` is `fastrepl/anarlog`; do not push there.
- The initial community snapshot is `1f0643e`. Its parentless history is deliberate: it excludes the commercially licensed enterprise implementation. The original upstream revision and licence notices are retained. Local ignored enterprise files are upstream reference material, not part of the new repository.
- The old `/Users/joshuacorbett/Coding/Transcip` checkout is intact, with pre-existing uncommitted changes. Do not reset it, import its live database, or assume those changes are all in its remote.
- Read `AGENTS.md`, `dialext/product/product-vision.md`, then `dialext/ARCHITECTURE.md`. Dated assessment documents are historical evidence; their “not built yet” statements are not a current status tracker.

The user wants a working personal tool based on Anarlog's layout, not another enterprise platform or bespoke frontend rewrite. They may read only one language. Keep the original design reference in `dialext/design/`, but do not copy its illustrative fake data into production. Irish–English first; other language pairs later, only as providers and evaluations support them.

## What is implemented

1. A separate community-source repository with the agreed brief and original design files.
2. `node dialext/dev.mjs`: isolated native development launch under `app.dialext.prototype`; `.dialext-data/vault/` for audio; local `.dialext-tools/` Rust installation where present. Xcode's Metal Toolchain has been installed on this Mac.
3. Xcode 27 build compatibility: `dialext/toolchain/swift` selects SwiftPM's native build layout, which `swift-rs` expects. The native runner signs with the prototype identifier. This is scoped to the launcher, not a global compiler configuration. The launcher defaults `ONBOARDING=false` for the prepared-sample experiment; `ONBOARDING=true node dialext/dev.mjs` restores the upstream tutorial. This does not grant operating-system recording permissions.
4. Settings → Imports → **Import a Dialext recording**. This reads a versioned prepared JSON bundle, validates both accounts against exact evidence anchors, and calls Anarlog's native `applySessionIngest` command. It inserts one selected reading and optional supplied summary, retaining the original bundle separately in session metadata.
5. Finalized, deterministic import identity. An identical repeat is idempotent; changed content under the same identity is rejected instead of overwriting edits. The native ingest tests cover these guarantees. This is an import seam, not the provider pipeline.
6. Original reconstruction validator and 13 tests copied unchanged from Dialext. The new bridge additionally checks unique source identities, ambiguous intervals, measured-duration bounds and agreement between displayed passage timing and its source anchors.
7. A native permissions-helper fix: an AppKit drag operation returning nil now restores the row state instead of panicking across an Objective-C callback. The app compiled successfully with this fix. The exact failed-drag interaction has not been reproduced after the fix.

The sample `dialext/fixtures/language-practice.json` is entirely hand-authored. It has **no source audio**, no actual ASR output, and no evaluated translation quality. Do not describe opening it as a successful live transcription test.

## What is not implemented

- Generating a language account or running Azure/another speech provider in the new app.
- Switching accounts within the recording workspace; the language selector currently chooses the imported reading only.
- Playback of source anchors, inline translation labels, raw-source review or a correction history for imported accounts.
- Persistent recording-level speaker mappings shared between language accounts. Upstream contacts/assignment infrastructure exists; that is not proof of this multilingual behaviour.
- A selected-account projection across search, export, summary generation and question context.
- Atomic correction-driven summary proposals, stable summary-block provenance, or the requested footer question surface.
- Packaging/distribution, full rebranding, migration of the old recording library, or quality evaluation.

Do not fill these gaps with inert controls. Complete one visible journey at a time.

## Verification already performed

| Check | Result |
| --- | --- |
| Pinned dependency install and shared UI build | Passed |
| Desktop TypeScript check | Passed |
| Full desktop test suite | 463 files, 4,408 tests passed before the final timing metadata refinement |
| Focused import/UI tests | 13 tests passed on 17 September, including the final timing metadata refinement |
| Original source-anchor validator | 13 tests passed |
| Native `session-ingest` tests | 8 tests passed, including idempotence/finalization and ownership checks |
| Common repository Node tests | 82 tests passed |
| Licence-boundary tests/check | 9 tests and boundary check passed |
| Lingui extraction and strict compilation | Passed; generated catalog changes are committed with the first import slice |
| Lingui check against tracked catalogs | Passed |
| Desktop Oxlint | No errors; 207 inherited warnings |
| ESLint on the new query/mutation component | Passed |
| Workflow audit | Offline zizmor scan found 358 inherited findings. No upstream workflow fixes or release-readiness claim. GitHub Actions are disabled on this private repository. |

Native runtime verification is recorded in the final section below. Passing mocked UI tests or the database tests is not a substitute for it.

Useful commands, from the new checkout:

```sh
node dialext/dev.mjs
node --test dialext/engine/reconstruction-validate.test.mjs
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

- `useSessionTranscripts`, `loadSessionContentSnapshot` and native `list_session_transcripts` all currently read every transcript belonging to a recording. Merely adding a second language row will mix both languages in downstream consumers.
- The old reconstruction validator's returned `language` is the **target** language. Preserve a distinct spoken-language annotation; never derive it from a forced provider locale.
- Upstream missing timing metadata defaults to precise provider-word timing. Imported derived wording uses `synthetic_text` to disable that claim; source interval playback must be implemented explicitly.
- Anarlog edits its working `words_json`. Do not put immutable ASR legs in that editable table or silently turn its editing path into an evidence rewrite.
- The upstream proposal accept path checks a timestamp, then saves separately. It is not an atomic compare-and-swap operation and does not pin the transcript version. Fix the transaction before connecting automatic correction proposals.
- Both `transcripts` and `session_documents` already have trigger-maintained `content_version` tokens. Pin those in native edits/proposal acceptance; transcript `content_revision` alone misses writers that change text without incrementing the counter. Exact migration files and the revised contract are in `ARCHITECTURE.md`.
- `applySessionIngest` is a usable native command, but its source marker says `meeting_bot`, its workspace is a fixed local fixture scope here, and its envelope is capped at 2 MB. Do not mistake this prototype seam for the final local recording model.
- Native build caches produced by Xcode's default `swiftbuild` may contain libraries under `out/Products/Debug`, while the linker looks for `arm64-apple-macosx/debug`. The wrapper fixes clean builds. On an affected old cache, touching the relevant Swift-owning `build.rs` files forces rebuilding; no Rust source edit or global Xcode change is required.

## Working method and scope for the next session

Follow the ordered milestones in `ARCHITECTURE.md`. Finish native baseline verification first if any item below is pending. Then undertake **milestone 1 only**: durable accounts and one effective-transcript projection, using prepared fixtures and no paid calls. Read the nearest database/plugin instructions before changing those layers. Make migrations additive and test fresh creation, upgrade, deletion/restoration and restart.

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

### Original baseline checklist (completed above; milestone 1 now next)

1. Start `node dialext/dev.mjs` in a terminal that remains open. Use the actual native window if available. Do not press Record or configure paid providers for this sample check.
2. In Settings → Imports, choose English and import `dialext/fixtures/language-practice.json`. Confirm the sample title, supplied summary and two transcript passages. Verify that changing the first passage, assigning a test speaker name, copying/exporting and restarting preserves the changes. Reimport the same file and confirm saved edits are retained. Record outcomes individually.
3. If native automation remains unavailable, a manual check with Joshua is acceptable; ask for those exact results rather than another architecture discussion. If the app itself cannot complete the steps, isolate that failure before adding more product features.
4. Once the baseline passes, begin milestone 1 in three reviewable commits: **1a** additive schema/native storage and crash-safe metadata migration; **1b** one effective-transcript projection across all readers and search invalidation; **1c** saved language selection in the existing workspace, plus the two-language/restart acceptance journey. Keep the selector absent until its backend and consumers agree. No paid calls, full rebrand, new chat UI or provider migration in this milestone.

Use `ARCHITECTURE.md` as the decision record. Reopen a decision only when a concrete code constraint or user requirement contradicts it; record that evidence before changing the contract. Update this file after each completed slice so a later session can continue without relying on chat history.

### Current continuation

Native baseline is complete. Milestone 1a is next: additive native-owned evidence/registry storage and crash-safe metadata migration, preserving the edited selected transcript. Milestones 1b/1c remain unimplemented. The browser relay still stalls on live-query channel callbacks; use the identifiable native debug bundle for acceptance.

### Milestone 1a — native storage implementation

Implemented additive migration `20260917120000_dialext_accounts`, the three agreed personal-only tables (CloudSync disabled), same-recording registry constraints and immutable evidence/generation rows. The Drizzle adapter mirrors the schema. Prototype adoption lives in native `session-ingest::dialext`: preserves the edited selected transcript/hints/content version, creates the alternate from the retained bundle, writes immutable vault artefacts, and commits the registry and metadata marker together. Originals remain in metadata pending acceptance.

Hash contract v1: compact UTF-8 JSON, recursively sorted object keys, no BOM/newline. ASR originals are wrapped with `format: dialext-asr-evidence` and `version: 1`; account originals include the exact source IDs/revisions/digests. Evidence-set digests cover `format: dialext-evidence-set`, `version: 1` and a source-ID-sorted list of `{source_id, revision, sha256}`. Source-file bytes will be hashed directly when audio/file ingest exists. Files are named by their digest beneath `dialext/artifacts/v1/`; complete synced temporary bytes are atomically published without overwriting an existing path. A failed SQL commit can leave unreferenced files; retry verifies/reuses them. No garbage collection is implemented.

Native focused tests: 12 passed (eight ingest regressions plus four adoption/preservation/interruption/evidence/anchor tests). The schema upgrade regression preserves existing prose; the full db-app run initially passed 243/244, with its registry-count assertion requiring the three new disabled tables. The affected Rust Clippy check passed with `--locked --all-targets --no-deps -- -D warnings`. Database TypeScript typecheck passed. Two inherited adapter fixture failures omitted the existing template icon column; corrected fixture rows retain the real positional transport contract.

Activation is deliberately held for 1b: starting adoption before every effective reader uses the selected-account projection would concatenate the alternate language. The real native baseline remains verified; registry adoption in the running interface will be checked with 1b. The workspace selector is still absent. No paid calls or speaker-identity milestone is included here.
