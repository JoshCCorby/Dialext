#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  PROVIDER_PROTOCOL_MAX_INPUT_BYTES,
  PROVIDER_PROTOCOL_MAX_OUTPUT_BYTES,
  PROVIDER_PROTOCOL_VERSION,
  normalizeAzureResult,
  validateReconstructionResult,
} from "./provider-contracts.mjs";

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > PROVIDER_PROTOCOL_MAX_INPUT_BYTES) {
      throw new Error("Provider protocol input exceeds 2 MiB.");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function assertRequest(message) {
  if (message?.protocol_version !== PROVIDER_PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported provider protocol version: ${message?.protocol_version}.`,
    );
  }
  if (message?.provider !== "fixture") {
    throw new Error("Only the deterministic fixture provider is enabled.");
  }
  if (!message.request || typeof message.request !== "object") {
    throw new Error("Provider request is missing.");
  }
}

async function verifyAudio(request) {
  const bytes = await readFile(request.audio_path);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== request.audio_sha256)
    throw new Error("Source audio digest changed.");
}

function fixturePhrases(locale, durationMs) {
  const split = Math.max(1, Math.floor(durationMs / 2));
  const texts =
    locale === "ga-IE"
      ? ["Dia dhuit. Seo sliocht tástála.", "Go raibh maith agat."]
      : ["Hello. This is a fixture passage.", "Thank you."];
  return texts.map((text, index) => {
    const start = index === 0 ? 0 : split;
    const end = index === 0 ? split : durationMs;
    return {
      text,
      offsetMilliseconds: start,
      durationMilliseconds: end - start,
      confidence: 1,
    };
  });
}

async function fixtureAsr(request) {
  if (!["ga-IE", "en-IE"].includes(request.source_locale)) {
    throw new Error("Fixture ASR supports only ga-IE and en-IE.");
  }
  if (!Number.isInteger(request.duration_ms) || request.duration_ms < 2) {
    throw new Error("A measured audio duration is required.");
  }
  await verifyAudio(request);
  const phrases = fixturePhrases(request.source_locale, request.duration_ms);
  const normalized = normalizeAzureResult(
    {
      combinedPhrases: [{ text: phrases.map(({ text }) => text).join(" ") }],
      phrases,
    },
    request.source_locale,
    "fixture",
  );
  return {
    source_id: request.source_locale === "ga-IE" ? "irish-asr" : "english-asr",
    language_hint: request.source_locale === "ga-IE" ? "irish" : "english",
    provider: "fixture",
    model: request.model,
    text: normalized.text,
    provider_confidence: normalized.providerConfidence,
    segments: normalized.words.map((word) => ({
      start_ms: word.startMs,
      end_ms: word.endMs,
      speaker: word.speaker,
      text: word.text,
    })),
  };
}

function fixtureReconstruction(request) {
  const sources = request.transcript?.sources;
  if (!Array.isArray(sources) || sources.length !== 2) {
    throw new Error("Reconstruction requires both independent ASR sources.");
  }
  const preferredSource = sources.find((source) =>
    request.target_language === "ga"
      ? source.source_id === "irish-asr"
      : source.source_id === "english-asr",
  );
  if (!preferredSource)
    throw new Error("The requested source reading is missing.");
  const candidate = preferredSource.segments.map((segment, index) => ({
    start_ms: segment.start_ms,
    end_ms: segment.end_ms,
    speaker: segment.speaker ?? null,
    text: segment.text,
    spoken_language: "unknown",
    anchors: sources.map((source) => {
      const anchor = source.segments[index];
      if (
        !anchor ||
        anchor.start_ms !== segment.start_ms ||
        anchor.end_ms !== segment.end_ms
      ) {
        throw new Error("Fixture sources do not share exact intervals.");
      }
      return {
        source_id: source.source_id,
        start_ms: anchor.start_ms,
        end_ms: anchor.end_ms,
      };
    }),
  }));
  return validateReconstructionResult(
    candidate,
    request.transcript,
    request.target_language === "ga" ? "irish" : "english",
  ).map((segment, index) => ({
    ...segment,
    id: `passage:${index}`,
    spoken_language: candidate[index].spoken_language,
  }));
}

function writeResult(stage, result) {
  const bytes = Buffer.from(
    JSON.stringify({
      protocol_version: PROVIDER_PROTOCOL_VERSION,
      stage,
      result,
    }),
  );
  if (bytes.length > PROVIDER_PROTOCOL_MAX_OUTPUT_BYTES) {
    throw new Error("Provider protocol output exceeds 2 MiB.");
  }
  process.stdout.write(bytes);
}

try {
  const message = await readStdin();
  assertRequest(message);
  if (message.stage === "asr")
    writeResult("asr", await fixtureAsr(message.request));
  else if (message.stage === "reconstruct") {
    writeResult("reconstruct", fixtureReconstruction(message.request));
  } else throw new Error(`Unsupported provider stage: ${message.stage}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
