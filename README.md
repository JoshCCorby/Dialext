# Dialext

**Understand any conversation, in the language you read.**

Dialext turns a recording of a mixed-language conversation into one clear account in your own language: who said what, a summary, and the original audio behind every line. You don't need to speak both languages to follow it.

## Why Dialext

Conversations switch language all the time: a meeting that moves between two languages, a family call, an interview. Transcription tools expect one language, so a mixed recording comes back garbled or half in a language the reader can't follow. Anyone who isn't fluent in both misses what was said.

## What it does

- **One account, in your language.** Read the whole conversation in each language separately, including the parts spoken in the other language. Switch views in one click.
- **Every line traceable.** Each passage is linked to the exact stretch of audio it came from, so you can listen to the original.
- **Real names, not "Speaker 2".** Name a speaker once and the name carries through the transcript, search and exports.
- **Corrections you control.** Fixes keep a full history with undo. Dialext suggests matching summary changes and applies only the ones you accept.
- **Sourced summaries and answers.** Every summary point can show the passage and audio behind it. Ask a question about a recording months later and the answer points to where it came from.
- **Private by default.** A desktop app with a local library and no sign-in. Recordings go to a hosted service only if you choose one. Search everything; export to text or Markdown.

## How it works

1. **Bring in a recording.**
2. **Two readings.** The audio is transcribed separately as Irish and as English. Both are kept as an unedited record.
3. **One account.** Dialext combines the two readings into a single account in your chosen language, with every passage anchored to its audio.
4. **Use it.** Read, correct, summarise, ask questions and export.

## Where it stands

Dialext is an early working prototype for macOS. The workflow above runs end to end in the desktop app on sample conversations.

In development:

- live speech recognition for real recordings
- AI summaries that adapt to the kind of recording
- quality testing on real Irish–English conversations
- installers, and further language pairs

## Get started

Dialext isn't packaged yet. To run the development build on a Mac with Node 22, Rust and Xcode installed:

```sh
npx --yes pnpm@11.1.1 install --frozen-lockfile
node dialext/dev.mjs
```

Then open **Settings → Imports** and import the sample conversation, `dialext/fixtures/language-practice.json`.
