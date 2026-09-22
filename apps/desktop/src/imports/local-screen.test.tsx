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
  detectImportSources: vi.fn(),
  selectFiles: vi.fn(),
  readTextFiles: vi.fn(),
  importMeetingFiles: vi.fn(),
  useAuth: vi.fn(),
  useConnections: vi.fn(),
  connectedImportCredentialsQueryOptions: vi.fn(),
  connectedImportSyncQueryOptions: vi.fn(),
  nangoImportSyncQueryOptions: vi.fn(),
  connectConnectedImport: vi.fn(),
  connectNangoImport: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.selectFiles,
}));

vi.mock("@anlg/plugin-importer", () => ({
  commands: { readTextFiles: mocks.readTextFiles },
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: vi.fn() },
}));

vi.mock("~/dialext/import-recording", () => ({
  ImportDialextRecording: () => <button>Import a Dialext recording</button>,
}));

vi.mock("~/dialext/provider-generation", () => ({
  DialextProviderGeneration: () => <div>Dialext provider generation</div>,
}));

vi.mock("~/auth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("~/auth/useConnections", () => ({
  useConnections: mocks.useConnections,
}));

vi.mock("./detection", () => ({
  detectImportSources: mocks.detectImportSources,
}));

vi.mock("./queries", () => ({
  EMPTY_MEETING_IMPORT_HISTORY: [],
  importMeetingFiles: mocks.importMeetingFiles,
  useMeetingImportHistory: () => ({ data: [] }),
}));

vi.mock("./connected-import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./connected-import")>()),
  connectConnectedImport: mocks.connectConnectedImport,
  connectNangoImport: mocks.connectNangoImport,
  connectedImportCredentialsQueryOptions:
    mocks.connectedImportCredentialsQueryOptions,
  connectedImportSyncQueryOptions: mocks.connectedImportSyncQueryOptions,
  nangoImportSyncQueryOptions: mocks.nangoImportSyncQueryOptions,
}));

import { MEETING_IMPORT_PROVIDERS } from "./providers";
import { MeetingImportScreen } from "./screen";

import { SettingsImports } from "~/settings/imports";

function provider(id: string, installedAppId = `app.${id}`) {
  return {
    ...MEETING_IMPORT_PROVIDERS.find((candidate) => candidate.id === id)!,
    installedAppId,
  };
}

function renderImports(props: { onNoSourcesDetected?: () => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MeetingImportScreen {...props} />
    </QueryClientProvider>,
  );
}

describe("MeetingImportScreen in the personal shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("keeps local file imports and omits connected, account-backed imports", async () => {
    mocks.detectImportSources.mockResolvedValue([
      provider("granola"),
      provider("zoom"),
      provider("plaud"),
      provider("notta"),
      provider("google-meet", "google-meet"),
    ]);

    renderImports();

    expect(await screen.findByText("Granola")).toBeTruthy();
    expect(screen.getByText("Zoom")).toBeTruthy();
    expect(screen.getByText("Plaud")).toBeTruthy();
    expect(screen.getByText("Notta")).toBeTruthy();
    expect(screen.queryByText("Google Meet")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Choose files" }),
    ).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /Connect/ })).toBeNull();
    expect(screen.queryByText(/Sign in/)).toBeNull();
    expect(screen.queryByText(/while Anarlog is running/)).toBeNull();

    expect(mocks.useAuth).not.toHaveBeenCalled();
    expect(mocks.useConnections).not.toHaveBeenCalled();
    expect(mocks.connectedImportCredentialsQueryOptions).not.toHaveBeenCalled();
    expect(mocks.connectedImportSyncQueryOptions).not.toHaveBeenCalled();
    expect(mocks.nangoImportSyncQueryOptions).not.toHaveBeenCalled();
  });

  it("imports chosen export files locally", async () => {
    mocks.detectImportSources.mockResolvedValue([provider("granola")]);
    mocks.selectFiles.mockResolvedValue(["/tmp/granola.md"]);
    mocks.readTextFiles.mockResolvedValue({
      status: "ok",
      data: [{ path: "/tmp/granola.md", content: "# Standup" }],
    });
    mocks.importMeetingFiles.mockResolvedValue({
      discovered: 1,
      imported: 1,
      matched: 0,
      conflicts: 0,
      errors: 0,
    });

    renderImports();

    fireEvent.click(
      await screen.findByRole("button", { name: "Choose files" }),
    );

    await waitFor(() => {
      expect(mocks.importMeetingFiles).toHaveBeenCalledWith("granola", [
        { path: "/tmp/granola.md", content: "# Standup" },
      ]);
    });
    expect(
      await screen.findByText(
        "Brought in 1 new meetings. 0 were already here.",
      ),
    ).toBeTruthy();
    expect(mocks.connectConnectedImport).not.toHaveBeenCalled();
    expect(mocks.connectNangoImport).not.toHaveBeenCalled();
  });

  it("keeps the Dialext recording import beside local file imports in Settings", async () => {
    mocks.detectImportSources.mockResolvedValue([
      provider("granola"),
      provider("google-meet", "google-meet"),
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SettingsImports />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Import a Dialext recording" }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Choose files" }),
    ).toBeTruthy();
    expect(screen.queryByText("Google Meet")).toBeNull();
    expect(screen.queryByRole("button", { name: /Connect/ })).toBeNull();
    expect(mocks.useConnections).not.toHaveBeenCalled();
  });

  it("skips onboarding imports when only hosted connections were listed", async () => {
    const onNoSourcesDetected = vi.fn();
    mocks.detectImportSources.mockResolvedValue([
      provider("google-meet", "google-meet"),
    ]);

    renderImports({ onNoSourcesDetected });

    expect(await screen.findByText("No apps found.")).toBeTruthy();
    await waitFor(() => {
      expect(onNoSourcesDetected).toHaveBeenCalledOnce();
    });
  });
});
