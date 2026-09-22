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
  select: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
  flush: vi.fn(),
  latest: null,
  rows: [] as Array<{
    active_account_id: string | null;
    id: string;
    transcript_id: string;
    target_language: string;
    usable: number;
    has_source_audio: number;
  }>,
}));
vi.mock("@anlg/plugin-db", () => ({
  selectDialextAccount: mocks.select,
  startDialextProviderTask: mocks.start,
  cancelDialextProviderTask: mocks.cancel,
}));
vi.mock("./account-query", () => ({
  useDialextAccounts: () => ({ data: mocks.rows }),
}));
vi.mock("~/db/write-queue", () => ({ flushDatabaseWrites: mocks.flush }));
vi.mock("./checked-edit", () => ({
  undoDialextPassageEdit: vi.fn(),
  useDialextEditVersion: () => "version-on-screen",
}));
vi.mock("./provider-task", () => ({
  useLatestDialextProviderTask: () => mocks.latest,
  providerTaskLabel: () => "Provider task status",
}));
import { ReadingSelector } from "./reading-selector";

function mount(editing = false) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <ReadingSelector sessionId="recording" editing={editing} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockResolvedValue(undefined);
  mocks.flush.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue({ taskId: "task", sessionId: "recording" });
  mocks.cancel.mockResolvedValue(undefined);
  mocks.latest = null;
  mocks.rows = [
    {
      active_account_id: "english",
      id: "english",
      transcript_id: "en-work",
      target_language: "en",
      usable: 1,
      has_source_audio: 1,
    },
    {
      active_account_id: "english",
      id: "irish",
      transcript_id: "ga-work",
      target_language: "ga",
      usable: 1,
      has_source_audio: 1,
    },
  ];
});
afterEach(cleanup);
describe("saved account selection", () => {
  it("flushes saved work, submits the previous account pin and waits for authoritative selection", async () => {
    let finish!: () => void;
    mocks.select.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Gaeilge" }));
    await waitFor(() =>
      expect(mocks.select).toHaveBeenCalledWith(
        "recording",
        "irish",
        "english",
      ),
    );
    expect(mocks.flush).toHaveBeenCalledWith(["transcript:en-work"]);
    expect(
      screen
        .getByRole("button", { name: "English" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      (screen.getByRole("button", { name: "Gaeilge" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    finish();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Gaeilge" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
  });
  it("keeps the reading and explains a stale refusal", async () => {
    mocks.select.mockRejectedValue(
      new Error("The reading changed in another window."),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Gaeilge" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("another window"),
    );
    expect(
      screen
        .getByRole("button", { name: "English" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("prevents switching while a person is editing", () => {
    mount(true);
    expect(
      (screen.getByRole("button", { name: "Gaeilge" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("Finish editing before switching languages."),
    ).toBeTruthy();
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("makes missing alternates unavailable and does not substitute another account for a missing selection", () => {
    mocks.rows = [mocks.rows[0]];
    mocks.rows[0].active_account_id = null;
    mocks.rows[0].has_source_audio = 0;
    mount();
    expect(
      screen
        .getByRole("button", { name: "English" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      (
        screen.getByRole("button", {
          name: "Gaeilge (unavailable)",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toContain(
      "no usable selected reading",
    );
  });
  it("starts an on-demand alternate from retained source audio", async () => {
    mocks.rows = [mocks.rows[0]];
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Gaeilge (generate)" }));
    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith("recording", "ga"),
    );
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("leaves ordinary recordings in the existing interface", () => {
    mocks.rows = [];
    mount();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
