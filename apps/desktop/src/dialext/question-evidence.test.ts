import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  snapshot: vi.fn(),
  segments: vi.fn(),
}));
vi.mock("~/db", () => ({ liveQueryClient: { execute: mocks.account } }));
vi.mock("~/session/content-queries", () => ({
  loadSessionContentSnapshot: mocks.snapshot,
}));
vi.mock("~/chat/context/session-context-hydrator", () => ({
  renderSessionSegments: mocks.segments,
}));

import { loadDialextQuestionEvidence } from "./question-evidence";

const anchored = (id: string, text: string) => ({
  id,
  text,
  metadata: {
    dialext: {
      anchors: [{ source_id: "irish-asr", start_ms: 0, end_ms: 4000 }],
      spoken_language: "irish",
      target_language: "english",
    },
  },
});

describe("loading question evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account.mockResolvedValue([
      {
        account_id: "account-en",
        transcript_id: "recording:english",
        content_version: "v3",
        target_language: "en",
      },
    ]);
    mocks.snapshot.mockResolvedValue({
      transcripts: [{ id: "recording:english" }],
    });
    mocks.segments.mockResolvedValue([
      {
        speaker_label: "Gary",
        words: [
          anchored("p0", " I would like three tickets. "),
          { id: "loose", text: "unanchored" },
        ],
      },
      { speaker_label: "Speaker 1", words: [anchored("p1", "Fine.")] },
    ]);
  });

  it("takes the selected reading's anchored passages with the names the reader sees", async () => {
    const evidence = await loadDialextQuestionEvidence("recording");
    expect(evidence).toMatchObject({
      kind: "passages",
      accountId: "account-en",
      contentVersion: "v3",
      targetLanguage: "en",
      passages: [
        {
          ref: "P1",
          wordId: "p0",
          text: "I would like three tickets.",
          speaker: "Gary",
        },
        { ref: "P2", wordId: "p1", text: "Fine.", speaker: "Speaker 1" },
      ],
    });
  });

  it("refuses when the effective transcript is not the selected reading", async () => {
    mocks.snapshot.mockResolvedValue({
      transcripts: [{ id: "recording:irish" }],
    });
    await expect(loadDialextQuestionEvidence("recording")).resolves.toEqual({
      kind: "unavailable",
    });
    expect(mocks.segments).not.toHaveBeenCalled();
  });

  it("refuses when the recording has no usable selected reading", async () => {
    mocks.account.mockResolvedValue([]);
    await expect(loadDialextQuestionEvidence("recording")).resolves.toEqual({
      kind: "unavailable",
    });
  });
});
