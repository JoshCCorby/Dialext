import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("~/db", () => ({
  liveQueryClient: { execute: mocks.read },
  executeTransaction: vi.fn(),
}));

const { loadDialextSummaryPassages } = await import("./summary");

describe("loadDialextSummaryPassages", () => {
  it("takes only anchored passages of the selected reading, by their own ids", async () => {
    const anchors = { dialext: { anchors: [{ source_id: "english-asr" }] } };
    mocks.read.mockResolvedValue([
      {
        words_json: JSON.stringify([
          { id: "p1", text: " I would like tea. ", metadata: anchors },
          { id: "loose", text: "unanchored" },
          { id: "p2", text: "   ", metadata: anchors },
          { id: "p3", text: "Thank you.", metadata: anchors },
        ]),
      },
    ]);
    await expect(loadDialextSummaryPassages("recording")).resolves.toEqual([
      { wordId: "p1", text: "I would like tea." },
      { wordId: "p3", text: "Thank you." },
    ]);
  });

  it("returns nothing when there is no usable selected reading", async () => {
    mocks.read.mockResolvedValue([]);
    await expect(loadDialextSummaryPassages("recording")).resolves.toEqual([]);
  });
});
