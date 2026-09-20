import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@anlg/plugin-db", () => ({
  readDialextSourceInterval: mocks.read,
}));

import {
  DialextPassageSource,
  DialextSourcePanelSlot,
  DialextSourceProvider,
} from "./source-panel";

const translated = {
  id: "recording:passage:0",
  text: "I would like two tickets, please.",
  metadata: {
    timing: { source: "synthetic_text" },
    dialext: {
      anchors: [{ source_id: "irish-asr", start_ms: 0, end_ms: 4000 }],
      source_speaker: "spk-1",
      target_language: "english",
      spoken_language: "irish",
      timing: "passage",
    },
  },
};
const unknownOrigin = {
  ...translated,
  id: "recording:passage:3",
  text: "Hmm.",
  metadata: {
    ...translated.metadata,
    dialext: { ...translated.metadata.dialext, spoken_language: "unknown" },
  },
};
const ordinary = { id: "plain:word:0", text: "Hello", metadata: {} };

const resolved = {
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
  audio: { measuredDurationMs: 12000, clipWav: [82, 73, 70, 70] },
  audioUnavailable: null,
};

function mount(words = [translated, ordinary]) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DialextSourceProvider sessionId="recording">
        {words.map((word) => (
          <DialextPassageSource key={word.id} word={word} />
        ))}
        <DialextSourcePanelSlot />
      </DialextSourceProvider>
    </QueryClientProvider>,
  );
}

describe("Dialext source review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue(resolved);
    globalThis.URL.createObjectURL = vi.fn(() => "blob:clip");
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(cleanup);

  it("offers a quiet control only for a passage that names a source", () => {
    mount();
    const controls = screen.getAllByRole("button");
    expect(controls).toHaveLength(1);
    expect(controls[0].textContent).toBe("translated · Irish");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("says the original language is unknown rather than guessing it", () => {
    mount([unknownOrigin]);
    expect(screen.getByRole("button").textContent).toBe("language unknown");
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByText(/original language of this passage was not established/),
    ).toBeTruthy();
  });

  it("reveals the provider's own words and plays the measured interval", async () => {
    mount();
    fireEvent.click(screen.getByText("translated · Irish"));
    const panel = screen.getByLabelText("Source for this passage");
    expect(document.activeElement?.textContent).toBe("Source for this passage");
    await waitFor(() =>
      expect(
        panel.textContent?.includes("Ba mhaith liom dhá thicéad, le do thoil."),
      ).toBe(true),
    );
    expect(mocks.read).toHaveBeenCalledWith("recording", "irish-asr", 0, 4000);
    expect(panel.textContent).toContain("Irish reading · 0:00–0:04");
    // The reading's own label is reported as that reading's, never as a person.
    expect(panel.textContent).toContain("This reading heard spk-1");
    const player = panel.querySelector("audio");
    expect(player?.getAttribute("src")).toBe("blob:clip");
    expect(panel.textContent).toContain("not a measured word timing");
  });

  it("keeps a refusal visible instead of showing a player", async () => {
    mocks.read.mockRejectedValue(
      new Error("That passage does not name a stored interval of this reading"),
    );
    mount();
    fireEvent.click(screen.getByText("translated · Irish"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "does not name a stored interval",
      ),
    );
    expect(document.querySelector("audio")).toBeNull();
  });

  it("names why audio is unavailable and offers no player", async () => {
    mocks.read.mockResolvedValue({
      ...resolved,
      audio: null,
      audioUnavailable: "audio_missing_or_corrupt",
    });
    mount();
    fireEvent.click(screen.getByText("translated · Irish"));
    await waitFor(() =>
      expect(
        screen.getByText(/missing or does not match its recorded digest/),
      ).toBeTruthy(),
    );
    expect(document.querySelector("audio")).toBeNull();
  });

  it("closes on Escape without leaving the reveal marked open", async () => {
    mount();
    const control = screen.getByText("translated · Irish");
    fireEvent.click(control);
    expect(control.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(screen.getByLabelText("Source for this passage"), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByLabelText("Source for this passage")).toBeNull(),
    );
    expect(control.getAttribute("aria-pressed")).toBe("false");
  });
});
