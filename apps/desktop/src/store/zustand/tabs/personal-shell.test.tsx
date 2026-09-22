import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  TabContentSharedNote: vi.fn(() => <p>Sign in to view this shared note</p>),
  TabContentSharedNotePreview: vi.fn(() => null),
}));

vi.mock("~/main/empty", () => ({
  TabContentEmpty: () => <p>New Note</p>,
}));

vi.mock("~/shared-notes", () => ({
  TabContentSharedNote: mocks.TabContentSharedNote,
  TabContentSharedNotePreview: mocks.TabContentSharedNotePreview,
}));

import { type TabInput, useTabs } from ".";
import { restorePinnedTabsToStore } from "./pinned-persistence";
import { resetTabsStore } from "./test-utils";

import { ANARLOG_ACCOUNT_SERVICES_ENABLED } from "~/auth/account-services";
import { ClassicMainTabContent } from "~/main/tab-content";
import { commands } from "~/types/tauri.gen";

describe("personal shell tab destinations", () => {
  beforeEach(() => {
    resetTabsStore();
    vi.clearAllMocks();
    vi.mocked(commands.getPinnedTabs).mockResolvedValue({
      status: "ok",
      data: null,
    });
  });

  afterEach(cleanup);

  test("ships without Anarlog account services", () => {
    expect(ANARLOG_ACCOUNT_SERVICES_ENABLED).toBe(false);
  });

  test.each(["shared_sessions", "shared_note_preview"] as const)(
    "opens a %s destination as the local home tab",
    (type) => {
      useTabs.getState().openCurrent({ type, id: "share-1" });

      expect(useTabs.getState().currentTab).toMatchObject({
        type: "empty",
        active: true,
      });
      expect(useTabs.getState().tabs.map((tab) => tab.type)).toEqual(["empty"]);

      render(<ClassicMainTabContent tab={useTabs.getState().currentTab!} />);

      expect(screen.getByText("New Note")).toBeTruthy();
      expect(screen.queryByText(/Sign in/)).toBeNull();
      expect(mocks.TabContentSharedNote).not.toHaveBeenCalled();
      expect(mocks.TabContentSharedNotePreview).not.toHaveBeenCalled();
    },
  );

  test.each(["account", "sync", "team", "todo"])(
    "opens legacy %s settings at General",
    (tab) => {
      useTabs.getState().openNew({
        type: "settings",
        state: { tab },
      } as TabInput);

      expect(useTabs.getState().currentTab).toMatchObject({
        type: "settings",
        state: { tab: "app" },
      });
    },
  );

  test("keeps local settings destinations", () => {
    useTabs.getState().openNew({ type: "settings", state: { tab: "imports" } });

    expect(useTabs.getState().currentTab).toMatchObject({
      type: "settings",
      state: { tab: "imports" },
    });
  });

  test("reopening a closed shared note uses the local home tab", () => {
    useTabs.setState({
      closedTabs: [
        {
          type: "shared_sessions",
          id: "share-1",
          active: false,
          pinned: false,
          slotId: "slot-shared",
        },
      ],
    });

    useTabs.getState().restoreLastClosedTab();

    expect(useTabs.getState().currentTab).toMatchObject({ type: "empty" });
    expect(
      useTabs.getState().tabs.some((tab) => tab.type === "shared_sessions"),
    ).toBe(false);
  });

  test("restores pinned account settings at General and drops shared notes", async () => {
    vi.mocked(commands.getPinnedTabs).mockResolvedValue({
      status: "ok",
      data: JSON.stringify([
        { type: "settings", state: { tab: "account" }, pinned: true },
        { type: "shared_sessions", id: "share-1", pinned: true },
        { type: "sessions", id: "session-1", pinned: true },
      ]),
    });

    await restorePinnedTabsToStore(
      useTabs.getState().openNew,
      useTabs.getState().pin,
      () => useTabs.getState().tabs,
    );

    expect(useTabs.getState().tabs).toMatchObject([
      { type: "settings", state: { tab: "app" }, pinned: true },
      { type: "sessions", id: "session-1", pinned: true },
    ]);
  });
});
