import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render as renderUI,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  openCurrent: vi.fn(),
  onOpenChange: vi.fn(),
  notes: [] as Array<{
    shareId: string;
    sessionId: string;
    title: string;
    publishedAt: string;
    manageAccess: boolean;
  }>,
  sessions: [] as Array<{
    id: string;
    title: string;
    created_at: string;
  }>,
}));

vi.mock("~/search/contexts/engine", () => ({
  useSearchEngine: () => ({ search: mocks.search }),
}));
function render(ui: React.ReactNode) {
  return renderUI(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {ui}
    </QueryClientProvider>,
  );
}

vi.mock("~/auth", () => ({
  useAuth: () => ({ session: { user: { id: "viewer-1" } } }),
}));

vi.mock("~/session/queries", () => ({
  useSessionSummaries: () => mocks.sessions,
}));

vi.mock("~/shared-notes/cache", () => ({
  useDurableSharedNotes: () => mocks.notes,
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: {
      openCurrent: typeof mocks.openCurrent;
      recentlyOpenedSessionIds: string[];
    }) => unknown,
  ) =>
    selector({
      openCurrent: mocks.openCurrent,
      recentlyOpenedSessionIds: [],
    }),
}));

import { OpenNoteDialog } from "./open-note-dialog";

describe("OpenNoteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.mockResolvedValue([]);
    mocks.notes = [];
    mocks.sessions = [];
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(cleanup);

  it("closes through the shared dialog escape behavior", () => {
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a durable shared note from All Notes", () => {
    mocks.notes = [
      {
        shareId: "share-1",
        sessionId: "remote-session",
        title: "Shared roadmap",
        publishedAt: "2026-07-16T09:00:00.000Z",
        manageAccess: false,
      },
      {
        shareId: "owned-share",
        sessionId: "local-session",
        title: "Owned note",
        publishedAt: "2026-07-15T09:00:00.000Z",
        manageAccess: true,
      },
      {
        shareId: "viewer-local-share",
        sessionId: "local-session",
        title: "Viewer local snapshot",
        publishedAt: "2026-07-14T09:00:00.000Z",
        manageAccess: false,
      },
    ];
    mocks.sessions = [
      {
        id: "local-session",
        title: "Owned canonical note",
        created_at: "2026-07-15T09:00:00.000Z",
      },
    ];

    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);

    expect(screen.getByRole("dialog", { name: "Find a note..." })).toBeTruthy();
    expect(
      document.querySelector("[data-open-note-dialog-drag-region]"),
    ).toBeTruthy();
    expect(screen.getByText("All Notes")).toBeTruthy();
    const sharedNote = screen.getByRole("option", {
      name: "Shared roadmap",
    });
    expect(
      sharedNote.querySelector("[data-testid='shared-note-icon']"),
    ).toBeTruthy();
    expect(screen.queryByText("Owned note")).toBeNull();
    expect(screen.getByText("Owned canonical note")).toBeTruthy();
    expect(screen.getByText("Viewer local snapshot")).toBeTruthy();

    fireEvent.click(sharedNote);

    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      type: "shared_sessions",
      id: "share-1",
    });
  });
  it("finds a corrected transcript through the native index while filtering foreign and non-session hits", async () => {
    mocks.sessions = [
      { id: "saved", title: "Language practice", created_at: "2026-09-17" },
    ];
    mocks.search.mockResolvedValue([
      { document: { id: "saved", type: "session" } },
      { document: { id: "foreign", type: "session" } },
      { document: { id: "contact", type: "human" } },
    ]);
    render(<OpenNoteDialog open onOpenChange={mocks.onOpenChange} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "corrected tea" },
    });
    await waitFor(() =>
      expect(mocks.search).toHaveBeenCalledWith("corrected tea"),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Language practice" }),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("foreign")).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Language practice" }));
    expect(mocks.openCurrent).toHaveBeenCalledWith({
      id: "saved",
      type: "sessions",
    });
  });
});
