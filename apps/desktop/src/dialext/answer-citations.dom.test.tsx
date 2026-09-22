import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openNew: vi.fn(),
  currentTab: null as { type: string; id: string } | null,
  read: vi.fn(() => new Promise(() => {})),
}));
vi.mock("~/store/zustand/tabs", () => {
  const useTabs = (select: (state: unknown) => unknown) =>
    select({ openNew: mocks.openNew });
  useTabs.getState = () => ({ currentTab: mocks.currentTab });
  return { useTabs };
});
vi.mock("@anlg/plugin-db", () => ({
  readDialextSourceInterval: mocks.read,
}));

import { DialextAnswerCitations } from "./answer-citations";
import { DialextSourcePanelSlot, DialextSourceProvider } from "./source-panel";

const answer = {
  sessionId: "recording",
  outcome: "answer",
  accountId: "account-en",
  contentVersion: "v3",
  targetLanguage: "en",
  citations: [
    {
      quote: "three tickets",
      speaker: "Gary",
      passage: {
        wordId: "recording:passage:0",
        text: "I would like three tickets, please.",
        anchors: [{ source_id: "irish-asr", start_ms: 0, end_ms: 4000 }],
        spokenLanguage: "irish",
        targetLanguage: "english",
      },
    },
  ],
};

function renderWorkspace(data: unknown) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DialextAnswerCitations data={data} />
      <DialextSourceProvider sessionId="recording">
        <DialextSourcePanelSlot />
      </DialextSourceProvider>
    </QueryClientProvider>,
  );
}

describe("answer citations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentTab = { type: "sessions", id: "recording" };
  });
  afterEach(() => cleanup());

  it("keeps the model's answer apart from the reading's quotation", () => {
    renderWorkspace(answer);
    expect(
      screen.getByText(
        /Answer written by the model from these passages of the English reading/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("three tickets").tagName).toBe("Q");
  });

  it("opens the recording's one source panel for the cited passage", () => {
    renderWorkspace(answer);
    fireEvent.click(screen.getByRole("button", { name: /translated · Irish/ }));

    expect(screen.getByRole("region", { name: "Source for this passage" }))
      .toBeTruthy();
    expect(screen.getByText("The answer quoted this passage:")).toBeTruthy();
    expect(mocks.read).toHaveBeenCalledWith("recording", "irish-asr", 0, 4000);
    expect(mocks.openNew).not.toHaveBeenCalled();
  });

  it("opens the recording first when another tab is in front", () => {
    mocks.currentTab = { type: "sessions", id: "another-note" };
    renderWorkspace(answer);
    fireEvent.click(screen.getByRole("button", { name: /translated · Irish/ }));
    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "sessions",
      id: "recording",
    });
  });

  it("offers no source for a refusal and says no model was asked", () => {
    renderWorkspace({ ...answer, outcome: "no-match", citations: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/so no model was asked/)).toBeTruthy();
  });
});
