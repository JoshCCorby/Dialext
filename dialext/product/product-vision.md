# Dialext product vision

Current direction confirmed by the user on 15 September 2026. This replaces the organisational meeting-service brief. It records desired behaviour; it does not claim these features are implemented. The Anarlog adoption assessment is in [anarlog-adoption-assessment-2026-09-15.md](anarlog-adoption-assessment-2026-09-15.md).

**Dialext helps a person understand, revisit and share a multilingual recording in a language they know.**

The immediate goal is a working personal tool. Office deployment, organisational sales, agency workflows and Microsoft integrations are outside the active scope. Irish–English is the first language pair; the architecture should accommodate other supported pairs without changing the basic experience. Support and quality for further languages must be established individually.

The reader may be fluent in only one language. Do not require them to mentally reconcile two ASR outputs or understand an untranslated passage. The value is an accessible account of who said what, flexible summaries and answers to later questions. Language learning is a useful application: someone who switched to English during an Irish conversation can inspect a suggested Irish rendering afterwards.

**The recording workspace**

A person records or uploads audio, gets a readable result, and can return to it through a searchable library. Anarlog is the preferred foundation to investigate for its overall workflow and layout. The supplied Claude Design mockup remains a reference for a simple reading surface and phrase-review interaction. Its illustrative controls describe intent; their hard-coded data is not a specification for fake production values.

The workspace brings together a summary, transcript, personal notes, original audio and straightforward copying/export. Exact navigation and styling should follow the chosen foundation and the user's references, without redesigning the product around legacy database fields. Transcript TXT and portable Markdown are useful outputs, alongside richer document formats where needed. A Share interaction needs a concrete meaning; personal file sharing does not require launching hosted meeting links.

**Language views**

Remember the preferred reading language in settings. Generate that version by default; generate another supported language view when requested. An English view should be readable entirely in English, and an Irish view entirely in Irish, including passages originally spoken in the other language. Changing the displayed language does not translate the recording's audio.

Preserve the source recordings and ASR readings separately. Use both readings and context to construct the readable account. The account should retain the substance and speaker turns; it need not reproduce every hesitation or claim to be a verbatim quotation.

Distinguish a passage transcribed in its original language from a translation into the reader's language. A quiet label or visual treatment can convey this, with details available on selection. Translation and uncertainty are independent: a fluent translation can be well supported, and same-language transcription can be uncertain. If the engine cannot establish the original language or wording, it must not label it as a confirmed direct quotation. Mixed-origin passages may need more granular annotations than one label for an entire line.

Alternative phrasings are suggestions, not assertions of what was spoken. Do not invent confidence percentages or imply that a translated word has a measured word-level timestamp. Use the real anchored audio interval.

**Summaries and questions**

The default summary adapts to the content with useful headings and bullets. Decisions, actions, owners and deadlines belong where the recording supports them; a lecture or interview must not be forced into meeting-minutes sections. Offer a small set of templates, such as Auto, Meeting, Lecture, Interview and One-to-one. Templates can be selected before generation or applied afterwards. A new template output should preserve previous work rather than silently replace it.

A summary bullet exposes a small contextual source/detail control on hover, focus or selection. Opening it shows the relevant passage and original-audio interval, and can offer a longer explanation. Keep quotations, translated excerpts and AI explanations recognisably distinct. Evidence associations are stored data attached to stable summary blocks, not something inferred from bullet position after edits. Sources should be discoverable without permanent citation clutter.

A question input at the bottom of the summary supports specific queries about the recording, including months later. Answers use recording evidence and offer the same source/audio reveal. The model should acknowledge when the recording does not answer a question. Existing notes supplied by the person, if included in future context, must be explicitly distinguished from recorded speech; there is no decision here to feed all private notes into generation automatically.

**Speakers, corrections and saved work**

Start with neutral Speaker A/B/C identities. A person can name a speaker and apply that assignment throughout the recording. Names persist, are reflected in the effective transcript and new exports, and are available as suggestions on later recordings. Remembering a name is a local contacts feature; it does not require Teams or automatic voice recognition. Labels produced by independent ASR systems are not automatically the same person.

Phrase review should make listening, accepting or correcting a passage straightforward. Keep original evidence and saved edits recoverable. The visible transcript, transcript search, copying, export and question context must consistently use the selected effective version, with its sources available underneath.

After a transcript correction, the system may offer to check the summary for affected points. It should propose changes for review, preserve manual edits, and apply only what the person accepts. Do not silently regenerate the entire summary. Full regeneration with another template is a separate explicit action. A proposal must carry the transcript and summary versions it was prepared against, so accepting an old proposal cannot overwrite more recent work.

**Technical direction and acceptance**

Prefer adapting an existing working application over recreating generic capture, editing, search, chat and export features. Evaluate Anarlog's community desktop application as the foundation; its source-level fit is promising, but a successful build and bilingual integration have not yet been demonstrated here. This is not an instruction to replace the current application or migrate existing recordings immediately.

Keep reusable bilingual transcription and evidence machinery behind a narrow integration boundary. Give one application ownership of the editable recording workspace. Do not join two unrelated SQLite databases by copying tables or make two separate systems authoritative for the same edits. The old deployment topology and fixed minutes schema are not requirements for the personal product.

Use local storage and make hosted processing explicit. Personal use does not imply all speech or language models run offline. Provider choice should be separate from the interface; preserve useful paid work across retries. Existing data-protection settings and database invariants remain intact until an implementation deliberately replaces the relevant paths.

A complete sample workflow must work without live provider credentials: open a recording, read both language views, play the source audio, rename a speaker, correct text, review a proposed summary change, search the correction, export, and reopen after restarting the app. Live short recordings then establish provider behaviour and quality separately. A passing unit suite or a convincing mockup is not a substitute for that working journey.
