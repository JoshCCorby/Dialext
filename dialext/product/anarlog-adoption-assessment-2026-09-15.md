# Anarlog adoption assessment

15 September 2026. Source inspection and architecture proposal; no Anarlog build, provider run, integration or data migration has been completed. The user's clarified requirements are recorded in [product-vision.md](product-vision.md).

**Recommendation: use Anarlog's community desktop application as the candidate foundation and add Dialext's multilingual reading capability through a narrow integration.** This is a stronger fit than recreating its generic application features in the existing web shell. Prove the integration on a separate development build before adopting it or moving any existing recordings.

The application is a Tauri desktop app with a React/TypeScript interface and Rust backend. Its local SQLite store, editor and native plugins are part of the product, not incidental dependencies that can be removed by copying a few React files. `apps/web` is the website/account/shared-note surface, not the desktop notepad. Starting that web app would not establish that the desired product works. The upstream README describes a local community workflow with optional hosted services and configurable speech/LLM providers. Those are upstream claims; local buildability and offline behaviour have not been verified here. [Repository overview](https://github.com/fastrepl/anarlog).

**Source baseline and reuse boundary**

These revisions were inspected in temporary checkouts outside Transcip. No upstream code has been copied into this application and no credentials were supplied to any of these projects.

| Repository | Inspected revision | Licence / role |
| --- | --- | --- |
| fastrepl/anarlog | `cbd2468f8f22e173390aa7953f0889e91694591e` | Community code generally MIT; candidate product foundation |
| dannymcc/Granola-to-Obsidian | `fd595b4f610bae07bfd84364adf0c4fb73b14de9` | MIT; Obsidian sync/export reference |
| pedramamini/GranolaMCP | `518e860f2d6271aef32c895f1cc0704ce365d57e` | Apache-2.0; local Granola-cache access and MCP reference |
| theantichris/granola | `5b13c4251e23e061d5cf858ce61f4616aafdcd25` | MIT; Granola Markdown/TXT export reference |

Anarlog's licence boundary is path-based: `enterprise/**` is commercially licensed; other paths are MIT unless a nearer licence or third-party notice applies. The community application is intended to build without enterprise code. Use that community layer and retain required notices for reused code. The reason reuse is possible is the applicable licence, not simply that the project will be personal or unmonetised. [Licensing boundary](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/LICENSING.md).

**Features already represented in Anarlog's source**

| User need | Inspected implementation | Remaining Dialext-specific work |
| --- | --- | --- |
| Flexible summaries and selectable templates | `apps/desktop/src/session/components/note-input/template-picker.tsx` has selection, creation and regeneration hooks; summary-length policy adapts to transcript size | Configure the desired Auto/Lecture/Interview/Meeting outputs; ensure they use the selected effective account |
| Remember Gary and assign a voice throughout a recording | `speaker-assign.tsx` searches session participants and saved contacts, creates new people and supports whole-session assignment | Map independent ASR speaker labels to a recording-level identity shared across language views |
| Edit a summary without surprise replacement | `chat/tools/edit-summary.ts` persists a proposed replacement and opens a diff review with apply/decline | Connect transcript corrections to affected-summary proposals; retain stable evidence links and avoid broad unsolicited rewrites |
| Edit the transcript | `stt/queries.ts:updateTranscriptSegmentText` changes selected working-word text | Keep raw evidence outside that mutable working representation; preserve correction history and truthful timing |
| Consistent transcript export | `transcript/export-data.ts` calls the same transcript renderer to obtain text, speaker labels and intervals | Export the chosen language view and saved corrections, including translation labels where appropriate |
| Questions, saved notes and reusable editing | Chat, session documents and the shared editor exist in the desktop application | Verify grounding against the new multilingual representation and place the question input as requested |

Direct source references: [template picker](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/apps/desktop/src/session/components/note-input/template-picker.tsx), [speaker picker](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/apps/desktop/src/session/components/note-input/transcript/renderer/speaker-assign.tsx), [summary proposals](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/apps/desktop/src/chat/tools/edit-summary.ts), [transcript mutations](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/apps/desktop/src/stt/queries.ts), [export projection](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/apps/desktop/src/session/components/note-input/transcript/export-data.ts).

These are source-backed capabilities, not claims that their unmodified behaviour satisfies all the new requirements. In particular, its reviewed summary-edit tool proposes an entire replacement; it is not already a targeted correction-to-summary updater. No bilingual reconstruction or translation-provenance feature matching Dialext's requirement was established in this inspection.

**How the other repositories help**

[Granola-to-Obsidian](https://github.com/dannymcc/Granola-to-Obsidian) is useful for filename/frontmatter templates, attendee links, duplicate handling and preserving local edits during exports. Its data source is Granola's API, using local Granola authentication or an official key. It is not an independent recording engine. Start with portable Markdown exports; Obsidian-specific synchronisation can come later if wanted.

[GranolaMCP](https://github.com/pedramamini/GranolaMCP) reads Granola's local cache and exposes meeting search, details and transcripts through Python/CLI/MCP. Its tool shapes are useful references for future external-assistant access. Its parser assumes Granola's cache format, and the repository does not supply the in-app question-answering engine. Anarlog also has a CLI/MCP surface, so importing another server now would create overlap. [Licence](https://github.com/pedramamini/GranolaMCP/blob/518e860f2d6271aef32c895f1cc0704ce365d57e/LICENSE).

[theantichris/granola](https://github.com/theantichris/granola) is a Go exporter: notes use Granola API access and transcripts use local cache data. Useful references include Markdown with metadata, timestamped text and skipping unchanged output. Its cache/authentication plumbing is unnecessary for recordings owned by the new application. None of these tools requires us to make Dialext depend on Granola simply to copy their useful interaction or export patterns.

**The integration should have one owner for each kind of data**

Use Anarlog for the application workspace: sessions, documents, contacts, saved user edits, selected language views, search and exports. Preserve Dialext's original ASR readings and their audio anchors as evidence. Let a dedicated processing component produce derived language accounts. A small Node helper is a plausible initial way to reuse existing JavaScript code without immediately rewriting it in Rust; the experiment must establish how it is packaged, started, cancelled and resumed.

Do not transplant the entire old delivery service into the desktop app. Do not make Anarlog and the old pipeline database independently authoritative for the same summary or transcript edits. Keep the current data and deployment intact while the new path is tested. The exact job-queue ownership and provider bridge are implementation decisions for that experiment, not facts inferred from the presence of a plugin SDK.

Anarlog has a typed session-ingestion model containing documents, transcripts, words, participants and attachments. That is a useful mapping reference, but this review has not established a ready-to-use local import endpoint for the complete bilingual workflow. Its JavaScript plugin SDK provides views and event lifecycle helpers; it does not by itself expose a complete transcription-provider integration. Inspect the native transcription path before promising a plugin-only solution. [Ingestion model](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/crates/session-ingest/src/model.rs), [plugin SDK](https://github.com/fastrepl/anarlog/blob/cbd2468f8f22e173390aa7953f0889e91694591e/packages/plugin-sdk/src/index.ts).

The bridge should distinguish:

- **Original evidence:** recording identity, content digest, ASR source, immutable word/timing data and original speaker labels.
- **Readable account:** target language, version, stable passage IDs, recording-level speaker IDs, text and source anchors; source-language information and translated status can be uncertain or mixed.
- **Edits and generated outputs:** the base version, user changes, summary template, stable summary blocks and references to the inputs used.

This enables language switching without changing what evidence a source button resolves to. It also lets search, copying, exports and chat use the same corrected view. It avoids inventing precise translated-word timestamps: playback uses the actual supporting interval.

**Suggested behaviour for the new work**

The app remembers one preferred reading language and generates it first. Another language is an explicit additional view. Distinguish translated content quietly with an accessible label, not colour alone. Keep uncertain wording separately identifiable. Provider locale is not reliable proof of the spoken language; both engines were forced to their locales. The original audio remains original in every view.

A summary bullet can expose a small source/detail action on hover, keyboard focus or touch selection. Opening it reveals an excerpt and playback, with an optional explanation in the reader's language. Store its source references while generating the bullet. Do not ask a model afterwards to invent where the bullet came from. If a user rewrites it substantially, its old references need rechecking rather than automatic endorsement.

After a transcript correction, offer to check the summary. Generate a version-pinned proposal for affected blocks, show the changes, and accept or reject them without touching unrelated manual work. Applying another template creates a separate version/output. Existing model conversation memory is unnecessary: construct each request from saved source material and explicit versions so it is reproducible after a restart.

For future languages, parameterise source-language selection, target language and provider capabilities. Keep Irish–English as the first verified path. Architectural extensibility does not establish that every provider supports every pair or that two forced-language passes are best for all of them.

**The first implementation experiment**

1. Build a pinned community Anarlog checkout with an isolated development data directory. Verify a recording can be opened, edited, exported and reopened, without hosted-account dependencies for that local path. Use synthetic or approved sample data and deterministic provider responses initially.
2. Feed one two-speaker Irish–English fixture through a narrow Dialext bridge. Display the preferred-language account, generate the other view on demand, mark translated passages, retain audio anchors and persist a speaker rename and correction.
3. Prove that a saved correction survives restart and appears in search/export/question context. Exercise one summary template and one reviewed summary-change proposal. Then assess a short live recording separately; do not pay for fresh ASR merely to test the editor.

That experiment determines whether adoption saves work in practice. It should finish before broad rebranding, migrating the old library, changing all providers, adding every language or copying the full legacy pipeline. The user's product direction is clear enough to undertake a bounded build plan; the remaining uncertainty is technical integration, not another round of product discovery.
