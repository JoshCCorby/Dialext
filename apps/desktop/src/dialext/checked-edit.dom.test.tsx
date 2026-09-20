import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  editDialextPassage: vi.fn(),
  undoDialextEdit: vi.fn(),
  updateTranscriptSegmentText: vi.fn(() => Promise.resolve()),
}));

vi.mock("~/db", () => ({ liveQueryClient: { execute: mocks.read } }));
vi.mock("@anlg/plugin-db", () => ({
  editDialextPassage: mocks.editDialextPassage,
  undoDialextEdit: mocks.undoDialextEdit,
}));
vi.mock("~/stt/queries", () => ({
  updateTranscriptSegmentText: mocks.updateTranscriptSegmentText,
}));
vi.mock(
  "~/session/components/note-input/transcript/renderer/segment-header",
  () => ({ SegmentHeader: () => null }),
);

const { editDialextPassageText, undoDialextPassageEdit } =
  await import("./checked-edit");
const { EMPTY_TRANSCRIPT_SEARCH, SegmentRenderer } =
  await import("~/session/components/note-input/transcript/renderer/segment");
const { TranscriptSelectionProvider } =
  await import("~/session/components/note-input/transcript/renderer/selection-context");

const ACCOUNT = {
  session_id: "dialext-recording",
  account_id: "account-en",
  content_version: "version-one",
};

describe("Dialext checked account edits", () => {
  beforeEach(() => {
    mocks.read.mockReset();
    mocks.editDialextPassage.mockReset();
    mocks.undoDialextEdit.mockReset();
    mocks.updateTranscriptSegmentText.mockClear();
  });

  it("submits the account and the reading's own version, never a bare transcript id", async () => {
    mocks.read.mockResolvedValue([ACCOUNT]);
    mocks.editDialextPassage.mockResolvedValue({
      outcome: "applied",
      contentVersion: "version-two",
      editId: "account-en:edit:1",
      sequence: 1,
    });

    const attempt = await editDialextPassageText({
      transcriptId: "dialext-recording:english",
      wordIds: ["word-1"],
      text: "I would like to order tea.",
    });

    expect(mocks.editDialextPassage).toHaveBeenCalledWith(
      "dialext-recording",
      "account-en",
      "version-one",
      ["word-1"],
      "I would like to order tea.",
    );
    expect(attempt).toEqual({
      outcome: "applied",
      contentVersion: "version-two",
    });
  });

  it("reports a stale reading as an outcome rather than throwing", async () => {
    mocks.read.mockResolvedValue([ACCOUNT]);
    mocks.editDialextPassage.mockResolvedValue({
      outcome: "stale",
      contentVersion: "version-moved",
      editId: null,
      sequence: null,
    });

    await expect(
      editDialextPassageText({
        transcriptId: "dialext-recording:english",
        wordIds: ["word-1"],
        text: "Typed against the old base.",
      }),
    ).resolves.toEqual({ outcome: "stale", contentVersion: "version-moved" });
  });

  it("leaves an ordinary transcript to the existing path", async () => {
    mocks.read.mockResolvedValue([]);
    await expect(
      editDialextPassageText({
        transcriptId: "ordinary-transcript",
        wordIds: ["word-1"],
        text: "Anything.",
      }),
    ).resolves.toEqual({ outcome: "not-dialext" });
    expect(mocks.editDialextPassage).not.toHaveBeenCalled();
  });

  it("says plainly when there is nothing recorded to undo", async () => {
    mocks.read.mockResolvedValue([ACCOUNT]);
    mocks.undoDialextEdit.mockResolvedValue({
      outcome: "unchanged",
      contentVersion: "version-one",
      editId: null,
      sequence: null,
    });
    await expect(
      undoDialextPassageEdit("dialext-recording:english"),
    ).resolves.toEqual({ outcome: "nothing-to-undo" });
  });

  it("keeps the reader's typing on screen when the reading moved underneath it", async () => {
    mocks.read.mockResolvedValue([ACCOUNT]);
    mocks.editDialextPassage.mockResolvedValue({
      outcome: "stale",
      contentVersion: "version-moved",
      editId: null,
      sequence: null,
    });

    const view = render(
      <TranscriptSelectionProvider
        selectMode={false}
        selectedKeys={new Set<string>()}
        registerSource={() => () => {}}
      >
        <SegmentRenderer
          segment={{
            id: "segment-1",
            text: "I would like to order coffee.",
            start_ms: 0,
            end_ms: 900,
            key: {
              channel: "MixedCapture",
              speaker_index: null,
              speaker_human_id: null,
            },
            words: [
              {
                id: "word-1",
                text: "I would like to order coffee.",
                start_ms: 0,
                end_ms: 900,
                channel: "MixedCapture",
                is_final: true,
              },
            ],
          }}
          offsetMs={0}
          transcriptId="dialext-recording:english"
          speakerLabel="Gary"
          currentMs={0}
          seekAndPlay={vi.fn()}
          audioExists
          search={EMPTY_TRANSCRIPT_SEARCH}
          editMode
        />
      </TranscriptSelectionProvider>,
    );

    const editor = view.container.querySelector<HTMLElement>(
      "[data-transcript-editor]",
    );
    editor!.innerText = "I would like to order tea.";
    fireEvent.blur(editor!);

    await waitFor(() => {
      expect(view.getByRole("alert").textContent).toContain(
        "Your text is still here",
      );
    });
    expect(editor!.innerText).toBe(
      "I would like to order tea.",
      // Overwriting the typed text here is exactly the loss the version pin exists
      // to prevent, so the refusal must not restore the stored wording.
    );
    expect(mocks.updateTranscriptSegmentText).not.toHaveBeenCalled();
  });
});
