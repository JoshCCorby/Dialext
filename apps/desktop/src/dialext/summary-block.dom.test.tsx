import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { schema } from "@anlg/editor/note";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, string>>,
  read: vi.fn(),
}));
vi.mock("~/db", () => ({
  useLiveQuery: () => ({ data: mocks.rows }),
}));
vi.mock("@anlg/plugin-db", () => ({
  readDialextSourceInterval: mocks.read,
}));

import { DialextSourcePanelSlot, DialextSourceProvider } from "./source-panel";
import { DialextBlockView, DialextOutputEvidence } from "./summary-block";

const pinned = {
  block_id: "recording:passage:0",
  passage_word_id: "recording:passage:0",
  block_text: "I would like two tickets, please.",
  anchors_json: JSON.stringify([
    { source_id: "irish-asr", start_ms: 0, end_ms: 4000 },
  ]),
  spoken_language: "irish",
  target_language: "english",
};

function block(id: string, text: string) {
  return schema.nodeFromJSON({
    type: "dialextBlock",
    attrs: { id },
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

function renderBlock(node: ReturnType<typeof block>) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DialextSourceProvider sessionId="recording">
        <DialextOutputEvidence documentId="lecture">
          <DialextBlockView
            nodeProps={
              {
                node,
                getPos: () => 0,
                contentDOMRef: () => {},
              } as never
            }
          >
            <p>{node.textContent}</p>
          </DialextBlockView>
        </DialextOutputEvidence>
        <DialextSourcePanelSlot />
      </DialextSourceProvider>
    </QueryClientProvider>,
  );
}

describe("summary block source control", () => {
  beforeEach(() => {
    mocks.rows = [pinned];
    mocks.read.mockResolvedValue({
      sourceId: "irish-asr",
      revision: 1,
      evidenceSha256: "a".repeat(64),
      startMs: 0,
      endMs: 4000,
      evidenceText: "Ba mhaith liom dhá thicéad, le do thoil.",
      providerLabel: "spk-1",
      speakerKey: "gary",
      speakerDisplayIndex: 0,
      humanId: null,
      audio: null,
      audioUnavailable: "no_source_audio",
    });
  });
  afterEach(() => cleanup());

  it("opens the same source panel with the block's stored anchors", async () => {
    renderBlock(block(pinned.block_id, pinned.block_text));

    fireEvent.click(screen.getByRole("button", { name: /translated · Irish/ }));

    expect(
      screen.getByText(/generated from this passage of the English reading/),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByText("Ba mhaith liom dhá thicéad, le do thoil."),
      ).toBeTruthy(),
    );
    expect(mocks.read).toHaveBeenCalledWith("recording", "irish-asr", 0, 4000);
  });

  it("does not call an edited block verified", () => {
    renderBlock(block(pinned.block_id, "I would like three tickets."));

    fireEvent.click(screen.getByRole("button", { name: "edited · source" }));

    expect(
      screen.getByText(/supports the generated wording, not your edit/),
    ).toBeTruthy();
    expect(screen.queryByText(/generated from this passage/)).toBeNull();
  });

  it("offers nothing for a block with no stored evidence", () => {
    renderBlock(block("a-block-without-evidence", pinned.block_text));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never lends a neighbour's evidence by position", () => {
    mocks.rows = [{ ...pinned, block_id: "recording:passage:1" }];
    renderBlock(block(pinned.block_id, pinned.block_text));
    expect(screen.queryByRole("button")).toBeNull();
  });
});
