import { describe, expect, it } from "vitest";

import fixture from "../../../../dialext/fixtures/language-practice.json";
import sourceReview from "../../../../dialext/fixtures/source-review.json";
import { prepareDialextImport } from "./recording-import";

import { isTranscriptWordSeekable } from "~/stt/timing";

const identity = { workspaceId: "dialext-local", ownerUserId: "test-user" };
const prepare = (bundle = fixture, language: "english" | "irish" = "english") =>
  prepareDialextImport(JSON.stringify(bundle), language, identity);

describe("Dialext recording import", () => {
  it("imports only the chosen reading and stores independent original evidence", () => {
    const { envelope } = prepare();
    expect(envelope.transcripts).toHaveLength(1);
    expect(envelope.transcripts[0].words[0].text).toBe(
      "I would like to order coffee.",
    );
    expect(
      envelope.session.metadata.dialext.original.evidence.sources[0].segments[0]
        .text,
    ).toBe("Ba mhaith liom caife a ordú.");
    envelope.transcripts[0].words[0].text = "A correction";
    expect(
      envelope.session.metadata.dialext.original.accounts.english?.segments[0]
        .text,
    ).toBe("I would like to order coffee.");
  });

  it("can import Irish without substituting the English account", () => {
    const { envelope } = prepare(fixture, "irish");
    expect(envelope.transcripts[0].language).toBe("ga");
    expect(envelope.transcripts[0].words[1].text).toBe(
      "Is féidir leat caife le bainne a iarraidh.",
    );
    expect(
      envelope.transcripts[0].words[1].metadata.dialext.spoken_language,
    ).toBe("english");
    expect(envelope.transcripts[0].words[1].metadata.dialext.timing).toBe(
      "passage",
    );
    expect(isTranscriptWordSeekable(envelope.transcripts[0].words[1])).toBe(
      false,
    );
  });

  it("uses stable identity and a finalized envelope so reimport cannot overwrite edits", () => {
    expect(prepare()).toEqual(prepare());
    expect(prepare().sessionId).toBe(prepare(fixture, "irish").sessionId);
    expect(prepare().envelope.finalized).toBe(true);
  });

  it("refuses fabricated or near-match source anchors before persistence", () => {
    const bundle = structuredClone(fixture);
    bundle.accounts.english.segments[0].anchors[0].end_ms -= 1;
    expect(() => prepare(bundle)).toThrow("not a segment of that leg");
  });

  it("validates the stored alternate account as well as the displayed one", () => {
    const bundle = structuredClone(fixture);
    bundle.accounts.irish.segments[1].anchors[0].start_ms += 1;
    expect(() => prepare(bundle)).toThrow("not a segment of that leg");
  });

  it("refuses a wrong speaker and content beyond the recording", () => {
    const bundle = structuredClone(fixture);
    bundle.accounts.english.segments[0].speaker = "someone-else";
    expect(() => prepare(bundle)).toThrow("attributed to");
    const short = structuredClone(fixture);
    short.recording.duration_ms = 1000;
    expect(() => prepare(short)).toThrow("audio interval");
  });

  it("never infers spoken language from a forced ASR locale", () => {
    const bundle = JSON.parse(JSON.stringify(fixture));
    delete bundle.accounts.english.segments[0].spoken_language;
    expect(
      prepare(bundle).envelope.transcripts[0].words[0].metadata.dialext
        .spoken_language,
    ).toBe("unknown");
  });

  it("refuses invented passage timing even when the source anchor resolves", () => {
    const bundle = structuredClone(fixture);
    bundle.accounts.english.segments[0].end_ms = 3900;
    expect(() => prepare(bundle)).toThrow("supporting audio interval");
    const duplicate = structuredClone(fixture);
    duplicate.evidence.sources[0].segments.push(
      duplicate.evidence.sources[0].segments[0],
    );
    expect(() => prepare(duplicate)).toThrow("ambiguous audio interval");
  });

  it("carries a declared source audio file without embedding its bytes", () => {
    const prepared = prepareDialextImport(
      JSON.stringify(sourceReview),
      "english",
      identity,
    );
    expect(prepared.audio).toEqual({
      filename: "source-review.wav",
      format: "wav",
      sha256: sourceReview.audio.sha256,
    });
    expect(prepare().audio).toBeNull();
    expect(JSON.stringify(prepared.envelope)).not.toContain("RIFF");
  });

  it("accepts a declared attribution and refuses one that names nothing real", () => {
    expect(() =>
      prepareDialextImport(JSON.stringify(sourceReview), "irish", identity),
    ).not.toThrow();

    const unheard = structuredClone(sourceReview);
    unheard.speakers.push({ id: "never-spoke" });
    expect(() =>
      prepareDialextImport(JSON.stringify(unheard), "english", identity),
    ).toThrow("never heard");

    const unknownLabel = structuredClone(sourceReview);
    unknownLabel.source_speakers[0].provider_label = "spk-9";
    expect(() =>
      prepareDialextImport(JSON.stringify(unknownLabel), "english", identity),
    ).toThrow("never used");

    const undeclared = structuredClone(sourceReview);
    undeclared.source_speakers[0].speaker_id = "someone";
    expect(() =>
      prepareDialextImport(JSON.stringify(undeclared), "english", identity),
    ).toThrow("undeclared speaker");

    const twice = structuredClone(sourceReview);
    twice.source_speakers.push(twice.source_speakers[0]);
    expect(() =>
      prepareDialextImport(JSON.stringify(twice), "english", identity),
    ).toThrow("attributed twice");
  });

  it("rejects duplicate raw readings and oversized input", () => {
    const bundle = structuredClone(fixture);
    bundle.evidence.sources[1].source_id = bundle.evidence.sources[0].source_id;
    expect(() => prepare(bundle)).toThrow("independent ASR");
    expect(() =>
      prepareDialextImport(
        " ".repeat(2 * 1024 * 1024 + 1),
        "english",
        identity,
      ),
    ).toThrow("2 MB");
  });
});
