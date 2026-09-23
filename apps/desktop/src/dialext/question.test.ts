import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isDialext: vi.fn(),
  evidence: vi.fn(),
}));
vi.mock("./summary", () => ({ isDialextRecording: mocks.isDialext }));
vi.mock("./question-evidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./question-evidence")>()),
  loadDialextQuestionEvidence: mocks.evidence,
}));

import { validateGroundedAnswer } from "./question-answer";
import { answerRecordingQuestion } from "./question-chat";
import {
  contentTerms,
  type EvidencePassage,
  selectQuestionEvidence,
} from "./question-evidence";

function passage(
  ref: string,
  text: string,
  speaker: string | null = null,
): EvidencePassage {
  return {
    ref,
    wordId: `recording:passage:${ref}`,
    text,
    speaker,
    anchors: [{ source_id: "english-asr", start_ms: 0, end_ms: 1000 }],
    spokenLanguage: "english",
    targetLanguage: "english",
  };
}

const passages = [
  passage("P1", "I would like three tickets, please.", "Gary"),
  passage("P2", "That is fine, three tickets.", "Speaker 1"),
  passage("P3", "Thank you very much.", "Gary"),
  passage("P4", "Hmm.", "Speaker 2"),
];

/// A model that answers with whatever it is given and records every call, so a test
/// can prove a refusal was decided before any model was asked.
function model(reply: unknown) {
  const doGenerate = vi.fn(async () => ({
    content: [{ type: "text", text: JSON.stringify(reply) }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  }));
  return {
    doGenerate,
    model: {
      specificationVersion: "v3",
      provider: "test",
      modelId: "test",
      supportedUrls: {},
      doGenerate,
      doStream: vi.fn(),
    } as never,
  };
}

describe("selecting evidence for a question", () => {
  it("refuses a specific question no passage mentions", () => {
    expect(
      selectQuestionEvidence("What is the capital of France?", passages),
    ).toEqual({ kind: "no-match", terms: ["capital", "france"] });
  });

  it("puts passages sharing a term first, then keeps recording order", () => {
    const selected = selectQuestionEvidence(
      "How many tickets did Gary want?",
      passages,
      80,
    );
    expect(selected).toEqual({
      kind: "evidence",
      passages: [passages[0], passages[1]],
    });
  });

  it("finds a passage by the speaker name the reader sees", () => {
    const selected = selectQuestionEvidence("What did Gary say?", passages, 70);
    expect(selected.kind).toBe("evidence");
    if (selected.kind !== "evidence") return;
    expect(selected.passages.map((entry) => entry.ref)).toEqual(["P1", "P3"]);
  });

  it("gives a question about the whole recording the recording in order", () => {
    expect(
      selectQuestionEvidence("What was discussed in this recording?", passages),
    ).toEqual({ kind: "evidence", passages });
  });

  it("drops common Irish function words too", () => {
    expect(contentTerms("Cad a dúirt sé faoi na ticéid?")).toEqual([
      "dúirt",
      "faoi",
      "ticéid",
    ]);
  });
});

describe("validating a grounded answer", () => {
  it("accepts an answer whose citations resolve to contiguous passage text", () => {
    expect(
      validateGroundedAnswer(
        {
          answer: "Gary asked for three tickets [P1].",
          citations: [{ passage: "P1", quote: "three  TICKETS, please" }],
          insufficient_evidence: false,
        },
        passages,
      ),
    ).toEqual({
      kind: "answer",
      text: "Gary asked for three tickets.",
      citations: [{ passage: passages[0], quote: "three  TICKETS, please" }],
    });
  });

  it("accepts the exact labelled passage returned by the on-device model", () => {
    expect(
      validateGroundedAnswer(
        {
          answer: "Gary wanted three tickets.",
          citations: [
            {
              passage: "P1 (Gary): I would like three tickets, please.",
              quote: "three tickets",
            },
          ],
          insufficient_evidence: false,
        },
        passages,
      ),
    ).toEqual({
      kind: "answer",
      text: "Gary wanted three tickets.",
      citations: [{ passage: passages[0], quote: "three tickets" }],
    });
    expect(
      validateGroundedAnswer(
        {
          answer: "Gary wanted five tickets.",
          citations: [
            {
              passage: "P1 (Gary): I would like five tickets, please.",
              quote: "three tickets",
            },
          ],
          insufficient_evidence: false,
        },
        passages,
      ),
    ).toEqual({ kind: "invalid", code: "unknown_passage" });
  });

  it("uses exact labelled text when the on-device model omits a quote", () => {
    expect(
      validateGroundedAnswer(
        {
          answer: "Gary wanted three tickets.",
          citations: [
            {
              passage: "P1 (Gary): I would like three tickets, please.",
            },
          ],
          insufficient_evidence: false,
        },
        passages,
      ),
    ).toEqual({
      kind: "answer",
      text: "Gary wanted three tickets.",
      citations: [
        {
          passage: passages[0],
          quote: "I would like three tickets, please.",
        },
      ],
    });
    expect(
      validateGroundedAnswer(
        {
          answer: "Gary wanted three tickets.",
          citations: [{ passage: "P1" }],
          insufficient_evidence: false,
        },
        passages,
      ),
    ).toEqual({ kind: "invalid", code: "quote_mismatch" });
  });

  it.each([
    [
      "an uncited answer",
      { answer: "Three.", citations: [], insufficient_evidence: false },
      "uncited_answer",
    ],
    [
      "a refusal that cites",
      {
        answer: "No.",
        citations: [{ passage: "P1", quote: "three tickets" }],
        insufficient_evidence: true,
      },
      "contradictory_evidence_claim",
    ],
    [
      "a passage that was never supplied",
      {
        answer: "Five.",
        citations: [{ passage: "P9", quote: "five tickets" }],
        insufficient_evidence: false,
      },
      "unknown_passage",
    ],
    [
      "a quotation the passage does not contain",
      {
        answer: "Five.",
        citations: [{ passage: "P1", quote: "five tickets" }],
        insufficient_evidence: false,
      },
      "quote_mismatch",
    ],
    ["an object of the wrong shape", { answer: "Three." }, "schema_validation"],
  ])("refuses %s", (_, candidate, code) => {
    expect(validateGroundedAnswer(candidate, passages)).toEqual({
      kind: "invalid",
      code,
    });
  });
});

describe("answering a question about a recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDialext.mockResolvedValue(true);
    mocks.evidence.mockResolvedValue({
      kind: "passages",
      accountId: "account-en",
      contentVersion: "v7",
      targetLanguage: "en",
      passages,
    });
  });

  it("leaves an ordinary session to the ordinary chat", async () => {
    mocks.isDialext.mockResolvedValue(false);
    const { model: m } = model({});
    await expect(
      answerRecordingQuestion({ sessionId: "note", question: "Hi", model: m }),
    ).resolves.toBeNull();
  });

  it("refuses without asking a model when nothing in the reading mentions it", async () => {
    const { model: m, doGenerate } = model({});
    const reply = await answerRecordingQuestion({
      sessionId: "recording",
      question: "What is the capital of France?",
      model: m,
    });
    expect(doGenerate).not.toHaveBeenCalled();
    expect(reply).toEqual({
      text: "The recording does not answer that.",
      data: {
        sessionId: "recording",
        accountId: "account-en",
        contentVersion: "v7",
        targetLanguage: "en",
        outcome: "no-match",
        citations: [],
      },
    });
  });

  it("refuses without asking a model when no reading is available", async () => {
    mocks.evidence.mockResolvedValue({ kind: "unavailable" });
    const { model: m, doGenerate } = model({});
    const reply = await answerRecordingQuestion({
      sessionId: "recording",
      question: "How many tickets?",
      model: m,
    });
    expect(doGenerate).not.toHaveBeenCalled();
    expect(reply?.data.outcome).toBe("unavailable");
  });

  it("answers from the selected reading with citations that reopen their source", async () => {
    const { model: m, doGenerate } = model({
      answer: "Gary asked for three tickets.",
      citations: [{ passage: "P1", quote: "three tickets" }],
      insufficient_evidence: false,
    });
    const reply = await answerRecordingQuestion({
      sessionId: "recording",
      question: "How many tickets did Gary want?",
      model: m,
    });
    expect(doGenerate).toHaveBeenCalledTimes(1);
    const prompt = JSON.stringify(doGenerate.mock.calls[0]);
    expect(prompt).toContain("P1 (Gary): I would like three tickets, please.");
    expect(prompt).toContain("Question: How many tickets did Gary want?");
    expect(reply?.text).toBe("Gary asked for three tickets.");
    expect(reply?.data.outcome).toBe("answer");
    expect(reply?.data.citations).toEqual([
      {
        quote: "three tickets",
        speaker: "Gary",
        passage: {
          wordId: "recording:passage:P1",
          text: "I would like three tickets, please.",
          anchors: passages[0].anchors,
          spokenLanguage: "english",
          targetLanguage: "english",
        },
      },
    ]);
  });

  it("shows no model prose when the answer does not check out", async () => {
    const { model: m } = model({
      answer: "Five tickets.",
      citations: [{ passage: "P1", quote: "five tickets" }],
      insufficient_evidence: false,
    });
    const reply = await answerRecordingQuestion({
      sessionId: "recording",
      question: "How many tickets?",
      model: m,
    });
    expect(reply?.text).not.toContain("Five");
    expect(reply?.data).toMatchObject({
      outcome: "invalid",
      code: "quote_mismatch",
    });
  });

  it("refuses in Irish for an Irish reading", async () => {
    mocks.evidence.mockResolvedValue({
      kind: "passages",
      accountId: "account-ga",
      contentVersion: "v2",
      targetLanguage: "ga",
      passages: [passage("P1", "Ba mhaith liom trí thicéad.", "Gary")],
    });
    const { model: m } = model({
      answer: "Níl.",
      citations: [],
      insufficient_evidence: true,
    });
    const reply = await answerRecordingQuestion({
      sessionId: "recording",
      question: "Cad a dúirt Gary faoin aimsir?",
      model: m,
    });
    expect(reply?.text).toBe("Níl freagra air sin sa taifeadadh.");
    expect(reply?.data.outcome).toBe("insufficient");
  });
});
