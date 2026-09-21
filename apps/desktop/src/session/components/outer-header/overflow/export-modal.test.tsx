import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  downloadDir: vi.fn(),
  exportPdf: vi.fn(),
  writeTextFile: vi.fn(),
  revealItemInDir: vi.fn(),
  onOpenChange: vi.fn(),
  save: vi.fn(),
  isAppStoreBuild: vi.fn(),
  enhanced: undefined as { content: string } | undefined,
  transcript: [] as Array<{ speaker: string; text: string }>,
}));

vi.mock("@tauri-apps/api/path", () => ({
  downloadDir: mocks.downloadDir,
  join: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mocks.save }));
vi.mock("@anlg/plugin-export", () => ({
  commands: { export: mocks.exportPdf },
}));
vi.mock("@anlg/plugin-fs2", () => ({
  commands: { writeTextFile: mocks.writeTextFile },
}));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { revealItemInDir: mocks.revealItemInDir },
}));
vi.mock("~/settings/queries", () => ({
  getStoredSettingValues: mocks.settings,
}));
vi.mock("~/shared/app-store", () => ({
  isAppStoreBuild: mocks.isAppStoreBuild,
}));
vi.mock("~/session/queries", () => ({
  useSession: () => ({ title: "Project review" }),
  useEnhancedNote: () => mocks.enhanced,
  useSessionParticipants: () => [],
}));
vi.mock("~/session/utils", () => ({ getSessionEvent: () => null }));
vi.mock("~/session/components/note-input/transcript/export-data", () => ({
  useTranscriptExportSegments: () => ({
    data: mocks.transcript,
    isLoading: false,
  }),
}));
vi.mock("~/stt/queries", () => ({ useSessionTranscriptMetadata: () => [] }));

import { ExportModal } from "./export-modal";

function renderModal(
  currentView: { type: "raw" } | { type: "enhanced"; id: string } = {
    type: "raw",
  },
) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ExportModal
        sessionId="session-1"
        currentView={currentView}
        open
        onOpenChange={mocks.onOpenChange}
      />
    </QueryClientProvider>,
  );
}

describe("ExportModal destination", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enhanced = undefined;
    mocks.transcript = [];
    mocks.settings.mockResolvedValue({ values: {} });
    mocks.downloadDir.mockResolvedValue("/Users/test/Downloads");
    mocks.exportPdf.mockResolvedValue({ status: "ok", data: null });
    mocks.writeTextFile.mockResolvedValue({ status: "ok", data: null });
    mocks.isAppStoreBuild.mockReturnValue(false);
  });
  afterEach(cleanup);

  it.each([
    ["PDF", "pdf"],
    ["TXT", "txt"],
    ["Markdown", "md"],
    ["Org", "org"],
  ])("writes %s to the saved export folder", async (label, extension) => {
    mocks.settings.mockResolvedValue({
      values: { export_directory: "/Volumes/Work/Exports" },
    });
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocks.onOpenChange).toHaveBeenCalledWith(false));
    const writer = extension === "pdf" ? mocks.exportPdf : mocks.writeTextFile;
    expect(writer).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^/Volumes/Work/Exports/Project review_.*\\.${extension}$`),
      ),
      extension === "pdf" ? expect.any(Object) : expect.any(String),
    );
    expect(mocks.revealItemInDir).toHaveBeenCalledWith(writer.mock.calls[0][0]);
    expect(mocks.downloadDir).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each([undefined, ""])(
    "uses Downloads when the preference is %s",
    async (directory) => {
      mocks.settings.mockResolvedValue({
        values: { export_directory: directory },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() =>
        expect(mocks.exportPdf).toHaveBeenCalledWith(
          expect.stringMatching(/^\/Users\/test\/Downloads\//),
          expect.any(Object),
        ),
      );
    },
  );

  it("does not export to Downloads if reading the saved preference fails", async () => {
    mocks.settings.mockRejectedValue(new Error("Database unavailable"));
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await screen.findByRole("alert");
    expect(mocks.downloadDir).not.toHaveBeenCalled();
    expect(mocks.exportPdf).not.toHaveBeenCalled();
  });

  it("keeps the modal open and shows write failures", async () => {
    mocks.writeTextFile.mockResolvedValue({
      status: "error",
      error: "Permission denied",
    });
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Check the export location in Settings",
    );
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.revealItemInDir).not.toHaveBeenCalled();
  });

  it("uses the saved folder as the App Store save dialog default", async () => {
    mocks.isAppStoreBuild.mockReturnValue(true);
    mocks.settings.mockResolvedValue({
      values: { export_directory: "/Users/test/Documents" },
    });
    mocks.save.mockResolvedValue("/Users/test/Documents/review.pdf");
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(mocks.exportPdf).toHaveBeenCalledWith(
        "/Users/test/Documents/review.pdf",
        expect.any(Object),
      ),
    );
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(/^\/Users\/test\/Documents\//),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
  });

  it("leaves the export modal open when the native save dialog is canceled", async () => {
    mocks.isAppStoreBuild.mockReturnValue(true);
    mocks.save.mockResolvedValue(null);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(mocks.exportPdf).not.toHaveBeenCalled();
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.revealItemInDir).not.toHaveBeenCalled();
  });
});

describe("ExportModal for a Dialext recording", () => {
  const block = (id: string, text: string) => ({
    type: "dialextBlock",
    attrs: { id },
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.settings.mockResolvedValue({ values: {} });
    mocks.downloadDir.mockResolvedValue("/Users/test/Downloads");
    mocks.writeTextFile.mockResolvedValue({ status: "ok", data: null });
    mocks.isAppStoreBuild.mockReturnValue(false);
    mocks.enhanced = {
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Lecture" }],
          },
          block("recording:passage:0", "I would like three tickets, please."),
          block("recording:passage:3", "Hmm (pause)."),
        ],
      }),
    };
    mocks.transcript = [
      { speaker: "Gary", text: "I would like three tickets, please." },
      { speaker: "Speaker 1", text: "That is fine, three tickets." },
    ];
  });
  afterEach(cleanup);

  it.each([
    ["TXT", "txt"],
    ["Markdown", "md"],
  ])(
    "writes %s with the output and selected reading as the reader sees them",
    async (label) => {
      renderModal({ type: "enhanced", id: "lecture" });
      fireEvent.click(screen.getByRole("radio", { name: label }));
      fireEvent.click(screen.getByRole("checkbox", { name: /Transcript/ }));
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() => expect(mocks.writeTextFile).toHaveBeenCalled());

      const written: string = mocks.writeTextFile.mock.calls[0][1];
      expect(written).toContain("Lecture");
      expect(written).toContain("I would like three tickets, please.");
      expect(written).toContain("Hmm (pause).");
      expect(written).toContain("Gary: I would like three tickets, please.");
      expect(written).toContain("Speaker 1: That is fine, three tickets.");
      expect(written).not.toContain("recording:passage");
      expect(written).not.toContain("dialext");
    },
  );
});
