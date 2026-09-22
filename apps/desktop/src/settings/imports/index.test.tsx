import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(),
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));

vi.mock("~/imports/screen", () => ({
  MeetingImportScreen: () => <div>Import list</div>,
}));

vi.mock("~/dialext/import-recording", () => ({
  ImportDialextRecording: () => <div>Dialext recording import</div>,
}));
vi.mock("~/dialext/provider-generation", () => ({
  DialextProviderGeneration: () => <div>Dialext provider generation</div>,
}));

import { SettingsImports } from ".";

describe("SettingsImports", () => {
  afterEach(cleanup);

  it("puts documentation beside the page title", () => {
    render(<SettingsImports />);
    expect(screen.getByText("Dialext recording import")).toBeTruthy();
    expect(screen.getByText("Dialext provider generation")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Documentation" }));

    expect(mocks.openUrl).toHaveBeenCalledWith(
      "https://docs.anarlog.so/imports",
      null,
    );
  });
});
