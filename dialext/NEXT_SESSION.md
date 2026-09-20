# Next-session prompt

Continue Dialext in `/Users/joshuacorbett/Coding/Dialext-Anarlog`.

Read `AGENTS.md`, `dialext/HANDOFF.md`, `dialext/ARCHITECTURE.md`, and `dialext/product/product-vision.md`; follow the personal-product scope and existing architecture decisions. Check the current branch and status and preserve unrelated work, including the untracked `.Rhistory` files; do not reset anything in the old `/Users/joshuacorbett/Coding/Transcip` checkout. The working branch is `codex/dialext-personal-prototype`; origin is the private `JoshCCorby/Dialext` repository. Never push to upstream.

**Milestone 2 is complete and its native acceptance is recorded.** All five acceptance steps passed in the real `app.dialext.prototype` window on 20 September — naming across both readings, per-language TXT export, quit and restart, a second recording reusing the contact, and the original sample reporting no source audio. Do not repeat them. Read "Native acceptance completed on 20 September, evening" in `HANDOFF.md` before anything else.

Two things from that section carry forward:

- **The speaker-key defect is fixed** (`dialext_speakers::write_speaker_indexes`). Every account's `provider_speaker_index` hints are derived from the recording's own speakers, in the adoption transaction and as a backfill. Do not reintroduce numbering by the provider label string, and do not add hints to the import envelope — that would change its content hash and turn an identical repeat import into a revision conflict.
- **Defect B is still present, by decision.** `language-practice`'s English account has passage 0 = `"I"` and passage 1 = `"would like to order tea. You can ask for coffee with milk."`, because the 17 September baseline edit was typed across a passage boundary. The text a reader sees is right; the anchor association is not. It was deliberately left as found. Do not quietly repair it to make something else pass, and do not re-point the saved `Dialext Test Speaker` assignment.

**There may be unpushed commits.** `git push` from an agent session was refused by the permission classifier as a "Remote Repoint", so Joshua pushes manually. Check `git log origin/main..HEAD` before assuming the remote is current, and ask him to push rather than working around it.

Now begin **milestone 3**: native version-pinned account edits with history, and atomic summary proposals. `ARCHITECTURE.md` has the contract — submit account ID plus transcript `content_version`, document ID plus document `content_version` and stable block IDs; compare both versions, apply and transition status in one native transaction; a stale write must refuse with the person's typing intact. Undo is another checked edit and must survive restart, and accepting a targeted proposal must preserve unrelated manual edits.

Read `apps/desktop/src/session/queries/proposals.ts` first. It has been read, and the handover's description is confirmed exactly: `applySessionProposal` loads the proposal, compares a `base_updated_at` **timestamp** rather than a `content_version`, then performs the document update and the status update as two separate writes, replacing the whole markdown via `md2json(proposal.proposedMarkdown)` rather than the affected blocks. That is useful interface infrastructure and not an atomic stale-write guarantee. Fix the transaction before connecting automatic correction proposals.

Use deterministic summary outputs and the existing template UI. Do not implement the provider bridge, rebranding or a new chat UI.

Use prepared fixtures and local synthetic audio without paid provider calls, live customer recordings, provider credentials or cloud deployment. Preserve `effective_transcripts` as the one selected-account projection for readers, search, export, enhancer and chat inputs; account selection remains a checked native transaction and never changes an existing summary. Keep immutable ASR and generated originals, existing edited accounts, contacts and retained metadata intact, and keep personal tables outside enabled CloudSync.

Driving the native window needs full-screen control and a Finder grant: background clicks are delivered to the Tauri webview and ignored, and the file-open panel is hosted by a separate process. Start the app with `node dialext/dev.mjs` and never substitute a release build or browser mocks. The browser relay at `http://localhost:1422` still stalls; `HANDOFF.md` records the confirmed root cause and the shape of a fix, which is development tooling and not milestone work. The Export dialog resets to PDF each time it opens — select TXT and Transcript explicitly.

Keep `dialext/HANDOFF.md` current after each step, document exact native outcomes and limitations, and commit completed work. Write a prompt for the following session when milestone 3 is complete.
