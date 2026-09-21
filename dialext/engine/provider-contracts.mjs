import {
  RECONSTRUCTION_LIMITS,
  validateReconstruction,
} from "./reconstruction-validate.mjs";

export const PROVIDER_PROTOCOL_VERSION = 1;
export const PROVIDER_PROTOCOL_MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const PROVIDER_PROTOCOL_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

function numberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function addNumbers(left, right) {
  return Number.isFinite(left) && Number.isFinite(right)
    ? Number(left) + Number(right)
    : null;
}

function formatSpeakerLabel(phrase) {
  const speaker = numberOrNull(phrase?.speaker);
  if (speaker === null) return null;
  const channel = numberOrNull(phrase?.channel);
  return channel === null
    ? `speaker-${speaker}`
    : `speaker-ch${channel}-${speaker}`;
}

export function normalizeAzureResult(raw, locale, region = "unknown") {
  const phrases = Array.isArray(raw?.phrases) ? raw.phrases : [];
  const combined = Array.isArray(raw?.combinedPhrases)
    ? raw.combinedPhrases
        .map((phrase) => phrase?.text)
        .filter(Boolean)
        .join(" ")
    : "";
  const text =
    combined ||
    phrases
      .map((phrase) => phrase?.text)
      .filter(Boolean)
      .join(" ");
  const words = phrases
    .flatMap((phrase) => {
      const speaker = formatSpeakerLabel(phrase);
      const channel = numberOrNull(phrase?.channel);
      const phraseWords = Array.isArray(phrase?.words) ? phrase.words : [];
      if (phraseWords.length === 0 && phrase?.text) {
        return [
          {
            text: phrase.text,
            startMs: numberOrNull(phrase.offsetMilliseconds),
            endMs: addNumbers(
              phrase.offsetMilliseconds,
              phrase.durationMilliseconds,
            ),
            confidence: numberOrNull(phrase.confidence),
            speaker,
            channel,
          },
        ];
      }
      return phraseWords.map((word) => ({
        text: word.text || word.word || "",
        startMs: numberOrNull(word.offsetMilliseconds),
        endMs: addNumbers(word.offsetMilliseconds, word.durationMilliseconds),
        confidence: numberOrNull(word.confidence ?? phrase?.confidence),
        speaker,
        channel,
      }));
    })
    .filter((word) => word.text);
  const confidences = words
    .map((word) => word.confidence)
    .filter(Number.isFinite);
  return {
    provider: "azure-speech",
    model: "fast-transcription-2024-11-15",
    locale,
    region,
    text,
    words,
    providerConfidence: confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null,
    raw,
  };
}

function requestMessages({ systemPrompt, protectedContext, user }) {
  if (!String(systemPrompt || "").trim()) {
    throw new Error("A versioned system prompt is required.");
  }
  if (!String(protectedContext || "").trim()) {
    throw new Error("Protected application context is required.");
  }
  return [
    { role: "system", content: systemPrompt },
    { role: "system", content: protectedContext },
    { role: "user", content: JSON.stringify(user) },
  ];
}

export function buildReconstructionRequest({
  targetLanguage,
  transcriptPayload,
  model,
  systemPrompt,
  protectedContext,
  maxOutputTokens = 16_000,
}) {
  return {
    model,
    temperature: 0.1,
    max_tokens: maxOutputTokens,
    messages: requestMessages({
      systemPrompt,
      protectedContext,
      user: { target_language: targetLanguage, transcript: transcriptPayload },
    }),
  };
}

export function buildChatRequest({
  question,
  transcriptPayload,
  model,
  systemPrompt,
  protectedContext,
  maxOutputTokens = 4_000,
}) {
  return {
    model,
    temperature: 0.2,
    max_tokens: maxOutputTokens,
    messages: requestMessages({
      systemPrompt,
      protectedContext,
      user: { question, transcript: transcriptPayload },
    }),
  };
}

export class ChatAnswerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ChatAnswerError";
    this.code = code;
  }
}

function failChat(code, message) {
  throw new ChatAnswerError(code, message);
}

function exactSegment(citation, transcriptPayload) {
  const source = transcriptPayload?.sources?.find(
    (candidate) => candidate.source_id === citation.source_id,
  );
  if (!source)
    failChat("unknown_source_ref", "Citation names an unknown source.");
  const segment = source.segments?.find(
    (candidate) =>
      candidate.start_ms === citation.start_ms &&
      candidate.end_ms === citation.end_ms,
  );
  if (!segment)
    failChat(
      "invalid_source_range",
      "Citation range does not exactly resolve.",
    );
  return segment;
}

export function validateChatAnswer(candidate, transcriptPayload) {
  const keys = Object.keys(candidate ?? {}).sort();
  if (
    keys.join(",") !== "answer,citations,insufficient_evidence" ||
    typeof candidate.answer !== "string" ||
    !Array.isArray(candidate.citations) ||
    typeof candidate.insufficient_evidence !== "boolean"
  ) {
    failChat(
      "schema_validation",
      "Chat answer does not conform to the answer schema.",
    );
  }
  if (/\[\s*\d+\s*(?:[,;]\s*\d+\s*)*\]/.test(candidate.answer)) {
    failChat(
      "answer_contains_markers",
      "Answer prose must not contain citation markers.",
    );
  }
  if (candidate.citations.length === 0 && !candidate.insufficient_evidence) {
    failChat(
      "uncited_answer",
      "An answer with no citations must declare insufficient evidence.",
    );
  }
  if (candidate.insufficient_evidence && candidate.citations.length > 0) {
    failChat(
      "contradictory_evidence_claim",
      "An insufficient answer may not cite evidence.",
    );
  }
  const citations = candidate.citations.map((citation) => {
    const citationKeys = Object.keys(citation ?? {}).sort();
    if (
      ![
        "end_ms,quote,source_id,start_ms",
        "end_ms,quote,source_id,speaker,start_ms",
      ].includes(citationKeys.join(",")) ||
      typeof citation.source_id !== "string" ||
      !Number.isInteger(citation.start_ms) ||
      !Number.isInteger(citation.end_ms) ||
      typeof citation.quote !== "string"
    ) {
      failChat(
        "schema_validation",
        "A citation does not conform to the answer schema.",
      );
    }
    const segment = exactSegment(citation, transcriptPayload);
    if (!segment.text.includes(citation.quote)) {
      failChat(
        "quote_mismatch",
        "Citation quote is not contiguous source text.",
      );
    }
    if (
      citation.speaker != null &&
      segment.speaker != null &&
      citation.speaker !== segment.speaker
    ) {
      failChat(
        "speaker_mismatch",
        "Citation speaker does not match its source.",
      );
    }
    return {
      source_id: citation.source_id,
      start_ms: citation.start_ms,
      end_ms: citation.end_ms,
      quote: citation.quote,
      speaker: citation.speaker ?? null,
      segment_text: segment.text,
    };
  });
  return {
    answer: candidate.answer,
    citations,
    insufficientEvidence: candidate.insufficient_evidence,
  };
}

export function validateProviderEnvelope(value, expectedStage) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provider protocol message must be an object.");
  }
  if (value.protocol_version !== PROVIDER_PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported provider protocol version: ${value.protocol_version}.`,
    );
  }
  if (value.stage !== expectedStage) {
    throw new Error(
      `Provider returned ${value.stage || "no stage"}; expected ${expectedStage}.`,
    );
  }
  if (!value.result || typeof value.result !== "object") {
    throw new Error("Provider result is missing.");
  }
  return value.result;
}

export function validateReconstructionResult(
  candidate,
  transcriptPayload,
  targetLanguage,
) {
  return validateReconstruction({
    segments: candidate,
    transcriptPayload,
    language: targetLanguage,
    limits: RECONSTRUCTION_LIMITS,
  });
}
