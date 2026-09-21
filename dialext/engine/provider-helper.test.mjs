import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const helper = new URL("./provider-helper.mjs", import.meta.url);

function wav(durationMs = 1000) {
  const sampleRate = 8000;
  const samples = Math.floor((sampleRate * durationMs) / 1000);
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + samples * 2, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}

function invoke(message) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [helper.pathname], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("close", (code) =>
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
    child.stdin.end(JSON.stringify(message));
  });
}

test("the stateless fixture helper emits two independent ASR legs and a validated account", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dialext-helper-"));
  try {
    const audio = wav();
    const audioPath = join(directory, "fixture.wav");
    await writeFile(audioPath, audio);
    const digest = createHash("sha256").update(audio).digest("hex");
    const sources = [];
    for (const source_locale of ["ga-IE", "en-IE"]) {
      const run = await invoke({
        protocol_version: 1,
        stage: "asr",
        provider: "fixture",
        request: {
          source_locale,
          model: "fixture-asr-v1",
          audio_path: audioPath,
          audio_sha256: digest,
          duration_ms: 1000,
        },
      });
      assert.equal(run.code, 0, run.stderr);
      sources.push(JSON.parse(run.stdout).result);
    }
    assert.deepEqual(
      sources.map(({ source_id }) => source_id),
      ["irish-asr", "english-asr"],
    );
    const run = await invoke({
      protocol_version: 1,
      stage: "reconstruct",
      provider: "fixture",
      request: {
        target_language: "en",
        model: "fixture-reconstruction-v1",
        prompt_version: "fixture-reconstruction-prompt-v1",
        transcript: { sources },
      },
    });
    assert.equal(run.code, 0, run.stderr);
    const result = JSON.parse(run.stdout).result;
    assert.equal(result.length, 2);
    assert.equal(result[0].anchors.length, 2);
    assert.equal(result[0].language, "english");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the helper refuses unknown protocol versions without stdout", async () => {
  const run = await invoke({
    protocol_version: 2,
    stage: "asr",
    provider: "fixture",
  });
  assert.notEqual(run.code, 0);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /Unsupported provider protocol version/);
});
