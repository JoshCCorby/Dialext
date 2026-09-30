# Dialext

**Understand any conversation, in the language you read.**

Dialext records or imports a multilingual conversation and gives you one readable account of it in your own language. You get who said what, a summary shaped to the kind of recording it was, and the original audio behind every line. You don't need to be bilingual to use it.

Irish–English is the first language pair.

> **Status:** early prototype, in active development. The workflow below runs end to end in the desktop app on synthetic sample recordings. A live speech provider is next. See [what works today](#what-works-today).

---

## The problem

Mixed-language conversation is normal: a meeting that moves between Irish and English, a family call, an interview, a lecture. Transcription tools assume a single language. Put a mixed-language recording through one and you get a transcript that is half gibberish, or one in two languages that a monolingual reader can't follow.

Everyone who wasn't fluent in both languages misses what was said. That includes colleagues, family members, researchers and learners.

## What Dialext does

**One readable account, in your language.** Dialext transcribes the audio independently in each language, then builds a single account from both readings. An English view reads entirely in English and an Irish view entirely in Irish, including passages that were spoken in the other language. Your preferred language is the default, and the other view is generated when you ask for it.

**Never a black box.** Source audio and the raw transcription readings are kept as immutable evidence. Each passage in the readable account is anchored to the exact stretch of audio it came from. When you want to check a line, you can open it and listen to the source.

**Summaries that fit the recording.** A lecture isn't a meeting and an interview isn't a one-to-one. Summaries follow the recording's content, and templates (Auto, Meeting, Lecture, Interview, One-to-one) give you another view without replacing the one you have. Every summary point has a quiet source control that shows the passage and audio it's based on.

**Ask about it later.** Months afterwards you can ask a specific question about a recording. Answers come from the recording itself, show their sources, and say so when the recording doesn't contain the answer.

**Corrections that stick and don't collide.** Fix a phrase and the correction is saved with a full edit history and undo. A correction can propose updates to the summary. You review each change, only what you accept is applied, and your own edits are never silently overwritten.

**People, not "Speaker 2".** Name a speaker once. The name carries through the transcript, search and every export.

**Yours, on your machine.** A native desktop app with a local library. Recordings, transcripts and edits are stored in local SQLite and plain files, and hosted processing only happens when you choose it. You can search everything you've recorded and export plain text or Markdown whenever you like.

## Who it's for

- People in bilingual workplaces and communities who need to follow, and later find, what was agreed, whichever language it was said in.
- Families and friends across a language gap.
- Journalists, researchers and oral historians working with mixed-language interviews.
- Language learners. If you switched to English mid-conversation, you can see afterwards how it might have been said in Irish.

## What works today

Each milestone is checked in the running native app, not just in tests.

| | Status |
| --- | --- |
| Import or generate a recording's reading from audio, with evidence validated against exact source anchors | ✅ Working (development provider) |
| English / Gaeilge views in one workspace, with separate saved edits that survive restarts | ✅ Working |
| Source audio stored as immutable, digest-verified evidence, with playback of a passage's source interval | ✅ Working |
| Named speakers carried through the transcript, search and export | ✅ Working |
| Version-pinned corrections with append-only history and undo | ✅ Working |
| Correction-driven summary proposals, applied atomically and only when accepted | ✅ Working |
| Per-point summary sources and grounded questions about a recording | ✅ Working |
| Local search, and TXT / Markdown export of the selected language view | ✅ Working |
| Fully local personal build with no accounts, logins or paywalls | ✅ Working |
| Live speech-recognition provider for real recordings | 🔜 Next |
| Model-written adaptive summaries (current outputs are deterministic placeholders) | 🔜 Next |
| Quality evaluation on real Irish–English recordings | 🔜 Planned |
| Dialext branding throughout, and packaged installers | 🔜 Planned |
| More language pairs | 🔭 Later, each pair evaluated on its own |

We don't publish accuracy claims yet. Quality will be measured on a representative set of real recordings before anything is claimed.

## How it works

```
Audio ──► Irish reading ─┐
      └─► English reading ┴─► Readable account (your language) ──► Summary · Questions · Export
             ▲  immutable evidence  ▲          │ each passage anchored to exact audio
             └──────────────────────┴──────────┘
```

- The two speech-recognition readings are never edited. Corrections are a separate versioned record on top of them, so evidence and edits can't overwrite each other.
- Summaries and answers must cite the passages they draw on. A citation that doesn't match the evidence exactly is refused rather than shown.
- A Tauri 2 desktop app with a React and TypeScript interface and a Rust core. Schema, migrations and transactions stay on the native side.

## Run the development build

You need Node 22, pnpm 11.1.1, Rust 1.94.0 and, on macOS, Xcode with its Metal Toolchain.

```sh
npx --yes pnpm@11.1.1 install --frozen-lockfile
node dialext/dev.mjs
```

This starts an isolated debug build (`app.dialext.prototype`) with its own data directory. Import the synthetic sample at [`dialext/fixtures/language-practice.json`](dialext/fixtures/language-practice.json) from **Settings → Imports**. Don't use a release build: it maps to a different application's data folder.

Contributors should start with [`dialext/HANDOFF.md`](dialext/HANDOFF.md) for verified status, [`dialext/ARCHITECTURE.md`](dialext/ARCHITECTURE.md) for the integration contracts and milestones, and [`dialext/product/product-vision.md`](dialext/product/product-vision.md) for the product brief.

## Acknowledgements and licence

Dialext's desktop foundation is derived from the community edition of [Anarlog](https://github.com/fastrepl/anarlog) (MIT), from baseline [`cbd2468`](https://github.com/fastrepl/anarlog/tree/cbd2468f8f22e173390aa7953f0889e91694591e). Dialext is an independent project and is not affiliated with or endorsed by Anarlog or fastrepl. The original [licence](LICENSE), [licensing boundary](LICENSING.md), [upstream README](dialext/UPSTREAM-README.md) and third-party notices are preserved. Commercially licensed `enterprise/` implementation code is not included.
