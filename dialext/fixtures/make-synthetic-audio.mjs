#!/usr/bin/env node
// Regenerates the committed synthetic source audio. The tones are not speech: they
// exist so a reviewer can hear that an anchored interval plays the interval it names,
// and so a test can check a clip by its frequency. Run from the repository root:
//   node dialext/fixtures/make-synthetic-audio.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 8000;
const here = dirname(fileURLToPath(import.meta.url));

// One tone per spoken interval of the bundle, so each anchor has its own pitch.
const RECORDINGS = [
  {
    bundle: "source-review.json",
    audio: "source-review.wav",
    durationMs: 12000,
    tones: [
      [0, 4000, 220],
      [4000, 6500, 330],
      [6500, 10000, 440],
      [10000, 12000, 550],
    ],
  },
  {
    bundle: "second-meeting.json",
    audio: "second-meeting.wav",
    durationMs: 6000,
    tones: [
      [0, 3000, 262],
      [3000, 6000, 392],
    ],
  },
];

function tone(durationMs, tones) {
  const frames = Math.round((durationMs * SAMPLE_RATE) / 1000);
  const body = Buffer.alloc(frames * 2);
  for (const [startMs, endMs, hz] of tones) {
    const from = Math.round((startMs * SAMPLE_RATE) / 1000);
    const to = Math.min(Math.round((endMs * SAMPLE_RATE) / 1000), frames);
    for (let frame = from; frame < to; frame += 1) {
      // A short fade at each edge keeps the clip free of a click that would be
      // mistaken for a boundary artefact when reviewing one interval.
      const into = Math.min(frame - from, to - 1 - frame, SAMPLE_RATE / 100);
      const gain = Math.min(1, into / (SAMPLE_RATE / 100));
      const phase = (frame * hz * 2 * Math.PI) / SAMPLE_RATE;
      body.writeInt16LE(Math.round(Math.sin(phase) * 8000 * gain), frame * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + body.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(body.length, 40);
  return Buffer.concat([header, body]);
}

for (const recording of RECORDINGS) {
  const wav = tone(recording.durationMs, recording.tones);
  const audioPath = join(here, recording.audio);
  writeFileSync(audioPath, wav);
  const sha256 = createHash("sha256").update(wav).digest("hex");

  const bundlePath = join(here, recording.bundle);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  bundle.audio = { filename: recording.audio, format: "wav", sha256 };
  writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(`${recording.audio} ${wav.length} bytes sha256=${sha256}`);
}
