import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import type { EditorView } from "~/store/zustand/tabs/schema";

const exportModalMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("./overflow/export-modal", () => ({
  ExportModal: exportModalMock,
}));

import { PersonalExportButton } from "./personal-export-button";

beforeEach(() => {
  exportModalMock.mockClear();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

it("opens the local export modal from the primary completed-note action", () => {
  render(
    <PersonalExportButton
      sessionId="session-1"
      currentView={{ type: "enhanced", id: "note-1" } as EditorView}
    />,
  );

  expect(exportModalMock).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Export note" }));

  expect(exportModalMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      sessionId: "session-1",
      open: true,
    }),
    undefined,
  );
});
