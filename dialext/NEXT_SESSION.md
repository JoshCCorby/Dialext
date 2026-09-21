# Next-session prompt

Continue Dialext in `/Users/joshuacorbett/Coding/Dialext-Anarlog`.

Read `AGENTS.md`, `dialext/HANDOFF.md`, `dialext/ARCHITECTURE.md`, and `dialext/product/product-vision.md`; follow the personal-product scope and existing architecture decisions. Check the current branch and status and preserve unrelated work, including the untracked `dialext/.Rhistory`; do not reset anything in the old `/Users/joshuacorbett/Coding/Transcip` checkout. The working branch is `codex/dialext-personal-prototype`; origin is the private `JoshCCorby/Dialext` repository. Never push to upstream.

**Check out the working branch first.** On 21 September the checkout was found on `main`, which holds only the two baseline commits. The branch tracks `origin/main`, so `git log origin/main..HEAD` is misleading from either branch: compare against `origin/codex/dialext-personal-prototype` to see what is unpushed. `git push` from an agent session has been refused by the permission classifier before, so Joshua pushes manually; ask him rather than working around it.

**Milestone 3 is complete and its native acceptance is recorded.** All acceptance steps passed in the real `app.dialext.prototype` window on 21 September: a stale edit and a stale proposal each refuse with nothing written and the reader's text kept, undo survives a full quit and relaunch, accepting a targeted proposal keeps an unrelated manual edit, and applying Lecture creates another output. Do not repeat them. Read "Milestone 3 — checked editing and proposals" at the end of `HANDOFF.md` before anything else.

Carry forward from that section:

- **Pin what the reader was shown.** Native acceptance found that the desktop bridge pinned `content_version` read at submission, so it could never refuse; `useDialextEditVersion` now pins a live-queried version captured when typing starts. Any new version-sensitive write must pin the version behind what is on screen, never a fresh read.
- **Block identity is the `dialextBlock` wrapper node**, present only in generated outputs. Do not return to an optional attribute on paragraphs: it wrote `dialextBlockId: null` into every note. Do not infer blocks from position.
- **Chat, CLI and MCP inbox proposals still use the upstream timestamp path**, deliberately. Correction-driven work goes through `apply_dialext_proposal`.
- **Defect B is still present, by decision**, and was verified byte-identical to the pre-milestone copy. Do not repair it quietly or re-point the saved `Dialext Test Speaker` assignment.
- The recorded limitations stand, notably that the stale-edit refusal has no refresh control. They are not milestone 4 work unless Joshua asks.

Now begin **milestone 4: the provider bridge**. `ARCHITECTURE.md` ("Processing boundary" and the milestone table) has the contract: a native-owned durable task queue in the app database; a development Node helper that reuses the original engine as a **stateless subprocess** with an argument array, bounded JSON on stdin/stdout, diagnostics on stderr, no HTTP listener, no database connection and no authority to edit the workspace; Rust owns task state, cancellation, result validation and durable writes; unknown protocol versions and oversized results are rejected. Persist each successful stage separately, key requests by audio digest, source locale, provider/model, prompt version and target language, fence late results by task attempt and input revision, and never show invented progress.

Start by extracting the pure request builders, normalisers and validators named in `ARCHITECTURE.md` with their tests. Do not copy the old worker, organisation repository layer, request handlers or deployment stack. Use **deterministic fixture providers** for the interface and for crash, cancel and retry tests; the expired Azure credential is not a blocker. Wire preferred-language generation first, then on-demand alternate generation. Acceptance: cancel, restart and failure preserve successful stages, and a downstream retry never reruns successful ASR. **One short live sample needs Joshua's explicit approval** and is assessed separately; do not make a paid provider call, use credentials, or deploy anything without it.

Keep `effective_transcripts` as the one selected-account projection, keep immutable ASR and generated originals, edited accounts, edit history, contacts and retained metadata intact, and keep personal tables outside enabled CloudSync with additive, downgrade-safe migrations tested on upgrade.

Driving the native window needs full-screen control and a Finder grant: background clicks are delivered to the Tauri webview and ignored. Start the app with `node dialext/dev.mjs` and never substitute a release build or browser mocks. Quit through the application menu and confirm no `dev.mjs`, Vite or desktop process survives before a restart check. Snapshot `~/Library/Application Support/app.dialext.prototype/app.db*` while the app is closed before new migrations run against it.

Keep `dialext/HANDOFF.md` current after each step, document exact native outcomes and limitations, and commit completed work. Write a prompt for the following session when milestone 4 is complete.
