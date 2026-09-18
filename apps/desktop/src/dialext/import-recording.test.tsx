import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "../../../../dialext/fixtures/language-practice.json";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  open: vi.fn(),
  read: vi.fn(),
  preferred: "en",
}));
vi.mock("~/db", () => ({ liveQueryClient: { execute: mocks.read } }));
vi.mock("~/settings/queries", () => ({
  useSettingsReady: () => true,
  useStoredSettingValue: () => ({ value: mocks.preferred }),
}));
vi.mock("@anlg/plugin-db", () => ({ applySessionIngest: mocks.apply }));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (value: { openCurrent: typeof mocks.open }) => unknown) =>
    selector({ openCurrent: mocks.open }),
}));
vi.mock("~/shared/utils", () => ({ DEFAULT_USER_ID: "local-user" }));

import { ImportDialextRecording } from "./import-recording";

function selectFile(content = JSON.stringify(fixture)) {
  const file = new File([content], "recording.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", { value: async () => content });
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
}

describe("ImportDialextRecording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preferred = "en";
    mocks.read.mockResolvedValue([]);
    mocks.apply.mockResolvedValue("applied");
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        }
      >
        <ImportDialextRecording />
      </QueryClientProvider>,
    );
  });
  afterEach(cleanup);

  it("saves the chosen reading through the native command and opens its recording", async () => {
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "irish" },
    });
    selectFile();
    await waitFor(() =>
      expect(mocks.open).toHaveBeenCalledWith({
        id: "dialext-synthetic-language-practice-v1",
        type: "sessions",
      }),
    );
    expect(mocks.apply.mock.calls[0][1].transcripts[0].language).toBe("ga");
    expect(mocks.apply.mock.calls[0][1].finalized).toBe(true);
  });

  it("keeps a native refusal visible and does not navigate away", async () => {
    mocks.apply.mockResolvedValue("rejected");
    selectFile();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("preserved"),
    );
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("rejects invalid input before invoking native persistence", async () => {
    selectFile("{}");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "not a supported",
      ),
    );
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("keeps the finalized initial language when an identical recording is imported after selection or preference changes", async () => {
    mocks.read.mockResolvedValue([{ language: "english" }]);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "irish" },
    });
    selectFile();
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    expect(
      mocks.apply.mock.calls[0][1].session.metadata.dialext.selected_language,
    ).toBe("english");
    expect(mocks.apply.mock.calls[0][1].transcripts[0].language).toBe("en");
  });
  it("uses saved Irish preference for a new recording", async () => {
    cleanup();
    mocks.preferred = "ga";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ImportDialextRecording />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("combobox").getAttribute("value") ??
        (screen.getByRole("combobox") as HTMLSelectElement).value,
    ).toBe("irish");
    selectFile();
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    expect(mocks.apply.mock.calls[0][1].transcripts[0].language).toBe("ga");
  });
});
