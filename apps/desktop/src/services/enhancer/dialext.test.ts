import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnhancerService } from ".";

const mocks = vi.hoisted(() => ({
  notes: [] as Array<Record<string, any>>,
  ensureSummaryDocument: vi.fn(),
  discardPendingAutoEnhanceJob: vi.fn().mockResolvedValue(undefined),
  write: vi.fn().mockResolvedValue("written"),
  generate: vi.fn().mockResolvedValue(undefined),
  getTemplateById: vi.fn(),
}));

vi.mock("@anlg/plugin-analytics", () => ({
  commands: { event: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("~/session/content-queries", () => ({
  loadSessionContentSnapshot: vi.fn(),
}));
vi.mock("./storage", () => ({
  discardPendingAutoEnhanceJob: mocks.discardPendingAutoEnhanceJob,
  ensurePendingAutoEnhanceDocument: vi.fn(),
  ensureSummaryDocument: mocks.ensureSummaryDocument,
  loadPendingAutoEnhanceJobs: vi.fn().mockResolvedValue([]),
  replaceSummaryDocumentTemplate: vi.fn(),
  updateSummaryDocumentTitleIfCurrent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/templates/queries", () => ({
  getTemplateById: mocks.getTemplateById,
}));
vi.mock("~/store/zustand/listener/instance", () => ({
  listenerStore: { subscribe: vi.fn(), getState: vi.fn() },
}));
vi.mock("~/dialext/summary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/dialext/summary")>()),
  isDialextRecording: vi.fn().mockResolvedValue(true),
  generateDialextOutputIfEmpty: mocks.write,
}));

function service(getModel: () => unknown = () => undefined) {
  return new EnhancerService({
    aiTaskStore: {
      getState: () => ({
        generate: mocks.generate,
        reset: vi.fn(),
        getState: vi.fn(),
      }),
    } as never,
    getModel: getModel as never,
    getLLMConn: () => null,
    getSelectedTemplateId: () => undefined,
  });
}

describe("Dialext deterministic outputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notes = [
      {
        id: "supplied-summary",
        templateId: "",
        title: "Summary",
        content: '{"type":"doc"}',
        contentFormat: "prosemirror_json",
        markdown: "",
        position: 1,
      },
    ];
    mocks.ensureSummaryDocument.mockImplementation(
      async (_session: string, templateId?: string) => {
        const key = templateId ?? "";
        const found = mocks.notes.find((note) => note.templateId === key);
        if (found) return found;
        const created = {
          id: `output-${key}`,
          templateId: key,
          title: "Summary",
          content: "",
          contentFormat: "prosemirror_json",
          markdown: "",
          position: mocks.notes.length + 1,
        };
        mocks.notes.push(created);
        return created;
      },
    );
    mocks.getTemplateById.mockResolvedValue({ title: "Lecture" });
  });

  it("applying Lecture creates another output and leaves the one on screen alone", async () => {
    const result = await service().enhance("recording", {
      templateId: "lecture-template",
      targetNoteId: "supplied-summary",
      templateTitle: "Lecture",
    });

    expect(result).toEqual({
      type: "started",
      noteId: "output-lecture-template",
    });
    expect(mocks.notes.map((note) => note.id)).toEqual([
      "supplied-summary",
      "output-lecture-template",
    ]);
    expect(mocks.write).toHaveBeenCalledWith({
      sessionId: "recording",
      noteId: "output-lecture-template",
      title: "Lecture",
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("needs no model and never regenerates over an output that has text", async () => {
    const result = await service(() => undefined).enhance("recording", {});
    expect(result).toEqual({
      type: "already_active",
      noteId: "supplied-summary",
    });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("reports a reading with no anchored passage as too short", async () => {
    mocks.write.mockResolvedValueOnce("no_passages");
    const result = await service().enhance("recording", {
      templateId: "lecture-template",
    });
    expect(result).toEqual({ type: "too_short" });
  });

  it("clears a pending auto-enhance record it will never resume", async () => {
    const job = {
      sessionId: "recording",
      noteId: "supplied-summary",
      templateId: "",
      expectedBody: "",
      expectedContentFormat: "prosemirror_json",
      generation: "g1",
    };
    await service().enhance("recording", {
      isAuto: true,
      pendingAutoEnhance: job,
    });
    expect(mocks.discardPendingAutoEnhanceJob).toHaveBeenCalledWith(job);
  });
});
