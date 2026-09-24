import { cleanup, render, screen } from "@testing-library/react";
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

  it("shows the Dialext imports and no link to Anarlog's documentation", () => {
    render(<SettingsImports />);
    expect(screen.getByText("Dialext recording import")).toBeTruthy();
    expect(screen.getByText("Dialext provider generation")).toBeTruthy();
    expect(screen.getByText("Import list")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Documentation" })).toBeNull();
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });
});
