// What a reconstruction must prove before it is allowed to exist.
//
// The reconstructed TEXT cannot be checked — it deliberately differs from both
// legs, which is the entire point — so everything that CAN be checked has to
// be, and the anchor checks carry most of the weight. A reconstruction whose
// segments do not point back at real spans is prose nobody can verify, play
// back, or aim a provenance control at.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ReconstructionValidationError,
  anchorIndexFor,
  lastTranscribedMs,
  validateReconstruction,
} from "./reconstruction-validate.mjs";

const PAYLOAD = {
  sources: [
    {
      source_id: "irish-asr",
      language_hint: "irish",
      segments: [
        { start_ms: 0, end_ms: 5000, speaker: "speaker-0", text: "Tosóimid leis an bplean." },
        { start_ms: 5000, end_ms: 9000, speaker: "speaker-1", text: "Aontaím leis sin." },
      ],
    },
    {
      source_id: "english-asr",
      language_hint: "english",
      segments: [
        { start_ms: 9000, end_ms: 13000, speaker: "speaker-1", text: "The ceiling moves to twelve thousand." },
      ],
    },
  ],
};

function segment(overrides = {}) {
  return {
    start_ms: 0,
    end_ms: 5000,
    speaker: "speaker-0",
    text: "We will start with the language plan.",
    anchors: [{ source_id: "irish-asr", start_ms: 0, end_ms: 5000 }],
    ...overrides,
  };
}

function run(segments, extra = {}) {
  return validateReconstruction({
    segments,
    language: "english",
    transcriptPayload: PAYLOAD,
    ...extra,
  });
}

function refusalCode(segments, extra = {}) {
  try {
    run(segments, extra);
  } catch (error) {
    assert.ok(error instanceof ReconstructionValidationError, `unexpected error: ${error}`);
    return error.code;
  }
  return null;
}

test("a well-anchored reconstruction is accepted and normalised", () => {
  const result = run([
    segment(),
    segment({
      start_ms: 9000,
      end_ms: 13000,
      speaker: "speaker-1",
      text: "The ceiling moves to twelve thousand.",
      anchors: [{ source_id: "english-asr", start_ms: 9000, end_ms: 13000 }],
    }),
  ]);

  assert.equal(result.length, 2);
  // Normalised, so what is stored is exactly what was checked rather than the
  // raw provider output sitting beside it.
  assert.deepEqual(Object.keys(result[0]).sort(), [
    "anchors", "end_ms", "language", "speaker", "start_ms", "text",
  ]);
  assert.equal(result[0].language, "english");
});

test("a segment with no anchors is REFUSED — this is the whole design", () => {
  assert.equal(refusalCode([segment({ anchors: [] })]), "segment_unanchored");
  assert.equal(refusalCode([segment({ anchors: undefined })]), "segment_unanchored");
});

test("an anchor that does not resolve to a real leg segment is refused", () => {
  // Exact-key, deliberately. These three are the same near-miss family the
  // reveal's regression fixture uses: inside the segment, straddling it, and
  // one millisecond past its end. A containment lookup would accept all three.
  for (const [startMs, endMs] of [[1000, 4000], [0, 5001], [0, 4999]]) {
    assert.equal(
      refusalCode([segment({ anchors: [{ source_id: "irish-asr", start_ms: startMs, end_ms: endMs }] })]),
      "anchor_unresolved",
      `${startMs}-${endMs} must not resolve`
    );
  }
});

test("an anchor into something that is not a leg is refused", () => {
  assert.equal(
    refusalCode([segment({ anchors: [{ source_id: "reconstructed-ga", start_ms: 0, end_ms: 5000 }] })]),
    "anchor_source",
    "a reconstruction may not anchor into another reconstruction"
  );
  assert.equal(
    refusalCode([segment({ anchors: [{ source_id: "", start_ms: 0, end_ms: 5000 }] })]),
    "anchor_source"
  );
});

test("segments must be chronological and non-overlapping", () => {
  const first = segment();
  const overlapping = segment({
    start_ms: 4000,
    end_ms: 9000,
    speaker: "speaker-1",
    anchors: [{ source_id: "irish-asr", start_ms: 5000, end_ms: 9000 }],
  });

  // Two segments covering the same instant make "the reconstruction at 00:04"
  // ambiguous, and the reveal index is a Map — the second would silently win.
  assert.equal(refusalCode([first, overlapping]), "segment_order");
});

test("a segment attributed to someone its evidence contradicts is refused", () => {
  assert.equal(
    refusalCode([segment({ speaker: "speaker-9" })]),
    "speaker_mismatch",
    "a reconstruction may not invent an attribution"
  );
});

test("a speaker is only checked when both sides name one", () => {
  // The legs diarise independently and one may carry no speaker at all. Forcing
  // every segment anonymous in that case would throw away real information.
  const anonymousLeg = {
    sources: [{
      source_id: "irish-asr",
      language_hint: "irish",
      segments: [{ start_ms: 0, end_ms: 5000, speaker: null, text: "x" }],
    }],
  };

  assert.doesNotThrow(() => validateReconstruction({
    segments: [segment({ speaker: "speaker-0" })],
    language: "english",
    transcriptPayload: anonymousLeg,
  }));

  assert.doesNotThrow(() => run([segment({ speaker: null })]));
});

test("nothing may claim speech past the last moment either leg transcribed", () => {
  // The bound is DERIVED from the legs, because the recording's duration does
  // not exist anywhere in this system: `jobs` has no such column and
  // `transcription_results.duration_ms` is ASR request latency. This check used
  // to read a `job.duration_ms` that was always undefined, so it silently never
  // ran — dead code that looked live.
  assert.equal(
    refusalCode([segment({
      end_ms: 20_000,
      anchors: [{ source_id: "english-asr", start_ms: 9000, end_ms: 13_000 }],
      speaker: "speaker-1",
      start_ms: 9000,
    })]),
    "segment_past_end",
    "the last leg segment ends at 13000; nothing may run past it"
  );

  // With no explicit duration the derived bound STILL applies.
  assert.doesNotThrow(() => run([segment()]));

  // A real measured duration, when one ever exists, may only tighten it.
  assert.equal(refusalCode([segment({ end_ms: 5000 })], { durationMs: 4000 }), "segment_past_end");
  assert.doesNotThrow(() => run([segment()], { durationMs: 999_999 }));
});

test("the derived bound is the latest end across BOTH legs", () => {
  assert.equal(lastTranscribedMs(PAYLOAD), 13_000);
  assert.equal(lastTranscribedMs({ sources: [] }), null);
  assert.equal(lastTranscribedMs(undefined), null);
});

test("ranges, text and size limits are enforced", () => {
  assert.equal(refusalCode([segment({ start_ms: 5000, end_ms: 5000 })]), "segment_range");
  assert.equal(refusalCode([segment({ start_ms: -1 })]), "segment_range");
  assert.equal(refusalCode([segment({ start_ms: 1.5 })]), "segment_range");
  assert.equal(refusalCode([segment({ text: "   " })]), "segment_text");
  assert.equal(refusalCode([segment({ text: 42 })]), "segment_text");
  assert.equal(refusalCode([]), "empty");
  assert.equal(refusalCode([segment()], { limits: { maxSegments: 0, maxTextChars: 10, maxAnchorsPerSegment: 1 } }), "segment_count");
  assert.equal(
    refusalCode([segment({ text: "x".repeat(50) })], { limits: { maxSegments: 10, maxTextChars: 10, maxAnchorsPerSegment: 1 } }),
    "segment_text_length"
  );
});

test("the target language must be one we reconstruct into", () => {
  for (const language of ["french", "", null, undefined, "IRISH"]) {
    assert.equal(
      refusalCode([segment()], { language }),
      "language",
      `${String(language)} must not be accepted as a target language`
    );
  }
});

test("a job with no leg segments cannot be reconstructed against", () => {
  try {
    validateReconstruction({
      segments: [segment()],
      language: "english",
      transcriptPayload: { sources: [] },
    });
    assert.fail("expected a refusal");
  } catch (error) {
    assert.equal(error.code, "no_legs");
  }
});

test("the anchor index maps raw-leg triples to reconstructed positions", () => {
  // This is what lets a minutes citation — which names a RAW-LEG triple —
  // resolve to the reconstructed segment covering it, once the reader is
  // looking at a reconstruction rather than the legs.
  const segments = run([
    segment(),
    segment({
      start_ms: 9000,
      end_ms: 13000,
      speaker: "speaker-1",
      text: "The ceiling moves to twelve thousand.",
      anchors: [
        { source_id: "english-asr", start_ms: 9000, end_ms: 13000 },
        { source_id: "irish-asr", start_ms: 5000, end_ms: 9000 },
      ],
    }),
  ]);

  const index = anchorIndexFor(segments);

  assert.equal(index.get("irish-asr:0:5000"), 0);
  assert.equal(index.get("english-asr:9000:13000"), 1);
  assert.equal(index.get("irish-asr:5000:9000"), 1, "a segment may be reached by any of its anchors");
  assert.equal(index.get("irish-asr:0:5001"), undefined, "exact key only");
});
