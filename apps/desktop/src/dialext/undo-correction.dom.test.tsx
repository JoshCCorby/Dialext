import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ undo: vi.fn() }));
vi.mock("./checked-edit", () => ({
  undoDialextPassageEdit: mocks.undo,
  useDialextEditVersion: () => "version-on-screen",
}));
vi.mock("~/db/write-queue", () => ({
  flushDatabaseWrites: vi.fn().mockResolvedValue(undefined),
}));

const { UndoCorrection } = await import("./undo-correction");

function renderUndo() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UndoCorrection transcriptId="recording:english" disabled={false} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Undo last correction" }));
}

describe("UndoCorrection", () => {
  beforeEach(() => mocks.undo.mockReset());
  afterEach(cleanup);

  it("undoes through the checked path for the selected reading", async () => {
    mocks.undo.mockResolvedValue({ outcome: "applied", contentVersion: "v3" });
    renderUndo();
    expect(await screen.findByText("Correction undone.")).toBeTruthy();
    expect(mocks.undo).toHaveBeenCalledWith(
      "recording:english",
      "version-on-screen",
    );
  });

  it("says so when there is nothing to undo", async () => {
    mocks.undo.mockResolvedValue({ outcome: "nothing-to-undo" });
    renderUndo();
    expect(
      await screen.findByText("No correction to undo in this reading."),
    ).toBeTruthy();
  });

  it("reports a stale reading without claiming anything was undone", async () => {
    mocks.undo.mockResolvedValue({ outcome: "stale", contentVersion: "v9" });
    renderUndo();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Nothing was undone",
    );
  });
});
