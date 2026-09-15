// Validating a reconstructed transcript against the immutable legs.
//
// A reconstruction is a claim about what was said. `anchors` is what stops it
// being an unfalsifiable free-text blob: every segment must point back at one
// or more real `(source_id, start_ms, end_ms)` spans in `words_json`, and a
// segment with no resolvable anchor is REFUSED rather than stored and shown.
//
// What can be checked here is deliberately bounded, and the boundary is the
// weakest point in the whole design, so it is stated rather than implied:
//
//   CAN be checked — that anchors resolve, that segments are chronological and
//   non-overlapping, that a segment's speaker matches its anchors' speaker,
//   that nothing runs past the end of the audio, and the size limits.
//
//   CANNOT be checked — the reconstructed TEXT. It deliberately differs from
//   both legs; that is the entire point of reconstructing, so there is no
//   string to compare it against.
//
// That gap is handled in the product rather than hidden: the reconstruction is
// labelled as a reconstruction, both raw readings stay one click away, and
// minutes citations continue to be validated against the raw legs. See the
// roadmap section in AGENTS.md.

export class ReconstructionValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReconstructionValidationError";
    this.code = code;
  }
}

export const RECONSTRUCTION_SOURCE_IDS = Object.freeze({
  irish: "reconstructed-ga",
  english: "reconstructed-en",
});

/** The legs a reconstruction may anchor into. Nothing else is addressable. */
export const ANCHORABLE_SOURCE_IDS = Object.freeze(["irish-asr", "english-asr"]);

export const RECONSTRUCTION_LIMITS = Object.freeze({
  maxSegments: 2000,
  maxTextChars: 4000,
  maxAnchorsPerSegment: 8,
});

const LANGUAGES = Object.freeze(["irish", "english"]);

function fail(code, message) {
  throw new ReconstructionValidationError(code, message);
}

function isMillisecond(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Index the legs by the exact triple an anchor names.
 *
 * EXACT-KEY, like `resolveCitedSegment` and like the transcript reveal. Not a
 * containment search and not a nearest match: the reconstruction is generated
 * from these very segments, so an exact key is always available when the two
 * genuinely agree, and a fuzzy fallback would hide precisely the drift this
 * check exists to catch.
 */
export function indexLegSegments(transcriptPayload) {
  const index = new Map();

  for (const source of transcriptPayload?.sources || []) {
    const sourceId = String(source.source_id);
    for (const segment of source.segments || []) {
      index.set(`${sourceId}:${segment.start_ms}:${segment.end_ms}`, {
        sourceId,
        speaker: segment.speaker ?? null,
        startMs: segment.start_ms,
        endMs: segment.end_ms,
      });
    }
  }

  return index;
}

/**
 * The last moment either leg transcribed anything.
 *
 * This is the bound a reconstruction is actually held to, and it is derived
 * from the legs rather than from the recording's duration — because the
 * recording's duration IS NOT AVAILABLE. `jobs` has no such column;
 * `transcription_results.duration_ms` is how long the ASR request took, which
 * is a different quantity entirely and would be nonsense to compare against a
 * segment's end time.
 *
 * The bound is weaker than the audio length (trailing silence is invisible to
 * it) and it is the one that catches the failure that matters: a segment
 * claiming speech past the point where either engine heard any.
 */
export function lastTranscribedMs(transcriptPayload) {
  let latest = null;

  for (const source of transcriptPayload?.sources || []) {
    for (const segment of source.segments || []) {
      const endMs = Number(segment.end_ms);
      if (Number.isFinite(endMs) && (latest === null || endMs > latest)) {
        latest = endMs;
      }
    }
  }

  return latest;
}

/**
 * Check one reconstruction, or refuse it.
 *
 * No segment may end after the last moment either leg transcribed anything.
 * That bound comes from the legs, NOT from the recording's duration, which this
 * system does not have — see `lastTranscribedMs`. `durationMs` is accepted as a
 * tighter bound for the day something does measure the audio, and when it is
 * absent the derived bound is used rather than the check being skipped.
 *
 * Returns the normalised segments, so a caller stores exactly what was checked
 * rather than the raw provider output beside it.
 */
export function validateReconstruction({
  segments,
  language,
  transcriptPayload,
  durationMs = null,
  limits = RECONSTRUCTION_LIMITS,
}) {
  if (!LANGUAGES.includes(language)) {
    fail("language", "A reconstruction must target Irish or English.");
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    fail("empty", "A reconstruction must contain at least one segment.");
  }

  if (segments.length > limits.maxSegments) {
    fail("segment_count", `A reconstruction may contain at most ${limits.maxSegments} segments.`);
  }

  const index = indexLegSegments(transcriptPayload);

  if (index.size === 0) {
    fail("no_legs", "There are no transcript segments to anchor against.");
  }

  // The tighter of the two, so a real measured duration wins when one exists
  // and the derived bound always applies when it does not.
  const derivedBound = lastTranscribedMs(transcriptPayload);
  // `typeof` rather than `Number.isFinite(Number(durationMs))`: `Number(null)`
  // is 0, not NaN, so the default would have coerced to a zero bound and
  // refused every segment. Anything that is not literally a number is "no
  // measured duration".
  const measuredBound = typeof durationMs === "number" && Number.isFinite(durationMs)
    ? durationMs
    : null;
  const endBound = measuredBound === null
    ? derivedBound
    : Math.min(measuredBound, derivedBound ?? measuredBound);

  const normalised = [];
  let previousEnd = -1;

  segments.forEach((segment, position) => {
    const at = `segment ${position}`;

    if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
      fail("segment_shape", `${at} is not an object.`);
    }

    const startMs = segment.start_ms;
    const endMs = segment.end_ms;

    if (!isMillisecond(startMs) || !isMillisecond(endMs) || endMs <= startMs) {
      fail("segment_range", `${at} does not carry an ordered millisecond range.`);
    }

    // Chronological AND non-overlapping. Two segments covering the same instant
    // would make "the reconstruction at 04:12" ambiguous, and the reveal index
    // is a Map — the second would silently win.
    if (startMs < previousEnd) {
      fail("segment_order", `${at} overlaps the segment before it.`);
    }
    previousEnd = endMs;

    if (endBound !== null && endMs > endBound) {
      fail(
        "segment_past_end",
        `${at} ends at ${endMs}, after the last moment either leg transcribed (${endBound}).`
      );
    }

    const text = typeof segment.text === "string" ? segment.text.trim() : "";

    if (!text) {
      fail("segment_text", `${at} has no text.`);
    }

    if (text.length > limits.maxTextChars) {
      fail("segment_text_length", `${at} exceeds ${limits.maxTextChars} characters.`);
    }

    const anchors = Array.isArray(segment.anchors) ? segment.anchors : [];

    // The refusal that matters most. Without it a reconstruction is prose
    // nobody can check, play back, or point a provenance control at.
    if (anchors.length === 0) {
      fail("segment_unanchored", `${at} has no anchors.`);
    }

    if (anchors.length > limits.maxAnchorsPerSegment) {
      fail("anchor_count", `${at} has more than ${limits.maxAnchorsPerSegment} anchors.`);
    }

    const resolved = [];

    for (const anchor of anchors) {
      const sourceId = String(anchor?.source_id ?? "");

      if (!ANCHORABLE_SOURCE_IDS.includes(sourceId)) {
        fail("anchor_source", `${at} anchors into ${sourceId || "nothing"}, which is not a leg.`);
      }

      if (!isMillisecond(anchor.start_ms) || !isMillisecond(anchor.end_ms)) {
        fail("anchor_range", `${at} has an anchor without an ordered millisecond range.`);
      }

      const found = index.get(`${sourceId}:${anchor.start_ms}:${anchor.end_ms}`);

      if (!found) {
        fail(
          "anchor_unresolved",
          `${at} anchors at ${sourceId} ${anchor.start_ms}-${anchor.end_ms}, which is not a segment of that leg.`
        );
      }

      resolved.push({ found, anchor });
    }

    // A segment attributed to one person whose evidence is another person
    // speaking is a reconstruction that has invented an attribution. Checked
    // only when BOTH sides name a speaker: the legs diarise independently and
    // a leg with no diarisation must not force every segment to be anonymous.
    const speaker = segment.speaker === null || segment.speaker === undefined
      ? null
      : String(segment.speaker);

    if (speaker !== null) {
      for (const { found } of resolved) {
        if (found.speaker !== null && String(found.speaker) !== speaker) {
          fail(
            "speaker_mismatch",
            `${at} is attributed to ${speaker} but anchors to ${found.speaker}.`
          );
        }
      }
    }

    normalised.push({
      start_ms: startMs,
      end_ms: endMs,
      speaker,
      language,
      text,
      anchors: resolved.map(({ anchor }) => ({
        source_id: String(anchor.source_id),
        start_ms: anchor.start_ms,
        end_ms: anchor.end_ms,
      })),
    });
  });

  return normalised;
}

/**
 * Every leg span a reconstruction claims to cover.
 *
 * The reveal index uses this: a minutes citation names a RAW-LEG triple, and
 * once the reader is looking at a reconstruction that citation has to resolve
 * to the reconstructed segment whose anchors contain that exact triple.
 */
export function anchorIndexFor(segments) {
  const index = new Map();

  segments.forEach((segment, position) => {
    for (const anchor of segment.anchors || []) {
      index.set(
        `${anchor.source_id}:${anchor.start_ms}:${anchor.end_ms}`,
        position
      );
    }
  });

  return index;
}
