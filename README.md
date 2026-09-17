# Dialext

A personal multilingual recording workspace, built on Anarlog's community desktop application. Start with [the handover brief](dialext/HANDOFF.md), [implementation architecture](dialext/ARCHITECTURE.md) and [product brief](dialext/product/product-vision.md).

Irish–English is the first pair. The aim is one readable language account, useful summaries, remembered speaker names, source-audio review and easy text exports. This is a development prototype, not a completed transcription product.

## Run the development app

Requirements: Node 22, pnpm 11.1.1, Rust 1.94.0, and on macOS a completed Xcode installation with its Metal Toolchain.

```sh
npx --yes pnpm@11.1.1 install --frozen-lockfile
node dialext/dev.mjs
```

On Xcode 27, the launcher selects SwiftPM’s native build mode to match the upstream Swift linker’s library paths. It builds shared UI first, then starts the native app in debug mode under `app.dialext.prototype`. Notes/settings use that separate application-support directory; audio uses `.dialext-data/vault/`. The locally installed Rust toolchain, when present, lives in `.dialext-tools/`. These directories are ignored by Git. The launcher does not load the old Dialext credentials or database.

The launcher skips the upstream tutorial for the prepared-sample experiment; use `ONBOARDING=true node dialext/dev.mjs` to include it. Native compilation and process launch have passed on this Mac. The interactive import/edit/export check is still pending; see the handover for the exact automation blocker and acceptance steps.

## First integration slice

Settings → Imports → Import a Dialext recording accepts a prepared JSON bundle. [The synthetic sample](dialext/fixtures/language-practice.json) contains English and Irish accounts. Choose the reading language before importing. Only that account enters the editable transcript; the original evidence and supplied alternate account are retained separately. The native import is finalized and idempotent, so reimporting cannot overwrite edits.

This import slice does not run speech recognition or generate translations. In-workspace language switching, translation marks, attached source-audio playback, correction-driven summary proposals and live provider integration still need to be connected and verified. The sample has no associated real recording.

Focused checks:

```sh
node --test dialext/engine/reconstruction-validate.test.mjs
npx --yes pnpm@11.1.1 -F @anlg/desktop exec vitest run src/dialext src/settings/imports/index.test.tsx
npx --yes pnpm@11.1.1 -F @anlg/desktop typecheck
cargo test --locked -p session-ingest --features apply
```

## Source and references

- Anarlog community baseline: [`fastrepl/anarlog@cbd2468f8f22e173390aa7953f0889e91694591e`](https://github.com/fastrepl/anarlog/tree/cbd2468f8f22e173390aa7953f0889e91694591e), MIT except nearer notices. Original [README](dialext/UPSTREAM-README.md), [licence](LICENSE), [licensing boundary](LICENSING.md) and third-party notices are preserved. Commercial `enterprise/` implementation code is excluded from the published snapshot; its boundary licence notice is retained.
- `dialext/engine/reconstruction-validate.mjs` and its tests were copied from Joshua's original Dialext project on 15 September 2026. The implementation is unchanged. It checks exact source anchors, speaker consistency and temporal bounds; it cannot prove that generated text is accurate.
- `dialext/design/` preserves Joshua's Claude Design mockup and supplied assets as a reference, separate from the runtime interface.
- `dialext/product/` preserves the agreed brief and dated architecture assessments. Historical assessments describe the project at the time they were written.

The original `Transcip` checkout remains intact as a reference. Its provider credentials, audio library and databases have not been migrated. New development belongs here. GitHub Actions are disabled on the private fork until its own workflows are deliberately configured.
