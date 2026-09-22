import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onScreen: "version-one" as string | null,
  read: vi.fn(),
  editDialextPassage: vi.fn(),
  undoDialextEdit: vi.fn(),
  updateTranscriptSegmentText: vi.fn(() => Promise.resolve()),
}));

vi.mock("~/db", () => ({
  liveQueryClient: { execute: mocks.read },
  // The version behind the words on screen, as the live query last delivered it.
  useLiveQuery: () => ({ data: mocks.onScreen }),
}));
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
    mocks.onScreen = "version-one";
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
      expectedContentVersion: "version-one",
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
        expectedContentVersion: "version-one",
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
        expectedContentVersion: null,
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
      undoDialextPassageEdit("dialext-recording:english", "version-one"),
    ).resolves.toEqual({ outcome: "nothing-to-undo" });
  });

  it("pins the version the reader was shown, not the one the database holds now", async () => {
    // Another writer moved the reading where this window could not see it: the
    // database says version-moved, the screen still shows version-one.
    mocks.read.mockResolvedValue([
      { ...ACCOUNT, content_version: "version-moved" },
    ]);
    mocks.editDialextPassage.mockResolvedValue({
      outcome: "stale",
      contentVersion: "version-moved",
      editId: null,
      sequence: null,
    });
    mocks.onScreen = "version-one";

    const view = renderEditableSegment();
    const editor = view.container.querySelector<HTMLElement>(
      "[data-transcript-editor]",
    );
    fireEvent.focus(editor!);
    editor!.innerText = "I would like to order tea.";
    fireEvent.blur(editor!);

    await waitFor(() => {
      expect(mocks.editDialextPassage).toHaveBeenCalledWith(
        "dialext-recording",
        "account-en",
        "version-one",
        ["word-1"],
        "I would like to order tea.",
      );
    });
  });

  it("refuses rather than guessing when no version was on screen", async () => {
    mocks.read.mockResolvedValue([ACCOUNT]);
    await expect(
      editDialextPassageText({
        transcriptId: "dialext-recording:english",
        wordIds: ["word-1"],
        text: "Anything.",
        expectedContentVersion: null,
      }),
    ).resolves.toEqual({ outcome: "stale", contentVersion: "version-one" });
    expect(mocks.editDialextPassage).not.toHaveBeenCalled();
  });

  it("keeps the reader's typing on screen when the reading moved underneath it", async () => {
    mocks.read.mockResolvedValue([ACCOUNT]);
    mocks.editDialextPassage.mockResolvedValue({
      outcome: "stale",
      contentVersion: "version-moved",
      editId: null,
      sequence: null,
    });

    const view = renderEditableSegment();

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

function renderEditableSegment() {
  return render(
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
}
