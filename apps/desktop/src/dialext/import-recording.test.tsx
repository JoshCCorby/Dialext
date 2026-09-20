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
import sourceReview from "../../../../dialext/fixtures/source-review.json";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  attachAudio: vi.fn(),
  open: vi.fn(),
  read: vi.fn(),
  preferred: "en",
}));
vi.mock("~/db", () => ({ liveQueryClient: { execute: mocks.read } }));
vi.mock("~/settings/queries", () => ({
  useSettingsReady: () => true,
  useStoredSettingValue: () => ({ value: mocks.preferred }),
}));
vi.mock("@anlg/plugin-db", () => ({
  applySessionIngest: mocks.apply,
  attachDialextSourceAudio: mocks.attachAudio,
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (value: { openCurrent: typeof mocks.open }) => unknown) =>
    selector({ openCurrent: mocks.open }),
}));
vi.mock("~/shared/utils", () => ({ DEFAULT_USER_ID: "local-user" }));

import { ImportDialextRecording } from "./import-recording";

function selectFile(content = JSON.stringify(fixture), extra: File[] = []) {
  const file = new File([content], "recording.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", { value: async () => content });
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [file, ...extra] },
  });
}

// The committed fixture audio is not read here; the digest check is what matters.
function audioFile(name: string, bytes: Uint8Array) {
  const file = new File([bytes], name, { type: "audio/wav" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer.slice(0),
  });
  return file;
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
  it("attaches declared source audio only when its bytes are the ones named", async () => {
    const { readFileSync } = await import("node:fs");
    const bytes = new Uint8Array(
      readFileSync("../../dialext/fixtures/source-review.wav"),
    );
    selectFile(JSON.stringify(sourceReview), [
      audioFile("source-review.wav", bytes),
    ]);
    await waitFor(() => expect(mocks.attachAudio).toHaveBeenCalled());
    expect(mocks.attachAudio.mock.calls[0][0]).toBe(
      "dialext-synthetic-source-review-v1",
    );
    expect(mocks.attachAudio.mock.calls[0][1]).toHaveLength(bytes.length);
  });

  it("imports the accounts and reports the audio it could not verify", async () => {
    selectFile(JSON.stringify(sourceReview), [
      audioFile("source-review.wav", new Uint8Array([1, 2, 3])),
    ]);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "is not the audio this recording names",
      ),
    );
    expect(mocks.apply).toHaveBeenCalled();
    expect(mocks.attachAudio).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.apply.mockResolvedValue("applied");
    mocks.read.mockResolvedValue([]);
    selectFile(JSON.stringify(sourceReview));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "choose that file alongside",
      ),
    );
    expect(mocks.apply).toHaveBeenCalled();
    expect(mocks.attachAudio).not.toHaveBeenCalled();
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
