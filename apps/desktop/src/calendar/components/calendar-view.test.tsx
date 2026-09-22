import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@anlg/ui/components/ui/tooltip";

const mocks = vi.hoisted(() => ({
  scheduleSync: vi.fn(),
  syncRange: vi.fn(),
  useConnections: vi.fn(),
  useSyncWhenCalendarConnectionsChange: vi.fn(),
}));

vi.mock("./context", () => ({
  useSync: () => ({
    canSync: true,
    status: "idle",
    scheduleSync: mocks.scheduleSync,
    cancelDebouncedSync: vi.fn(),
    syncRange: mocks.syncRange,
  }),
}));

vi.mock("./day-cell", () => ({
  DayCell: () => <div data-testid="day-cell" />,
}));

vi.mock("~/auth/useConnections", () => ({
  useConnections: mocks.useConnections,
}));

vi.mock("~/calendar/hooks", () => ({
  useCalendarData: () => ({
    eventIdsByDate: {},
    sessionIdsByDate: {},
    eventsById: {},
    sessionsById: {},
  }),
  useEnabledCalendars: () => [{ id: "apple-work", provider: "apple" }],
  useNow: () => new Date("2026-09-22T10:00:00Z"),
  useSyncWhenCalendarConnectionsChange:
    mocks.useSyncWhenCalendarConnectionsChange,
  useWeekStartsOn: () => 1,
}));

import { CalendarView } from "./calendar-view";

import { PersonalBillingProvider } from "~/auth/personal-billing";
import { PersonalAuthProvider } from "~/auth/personal-context";

describe("CalendarView in the personal shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.syncRange.mockResolvedValue(undefined);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("syncs local calendars without mounting account connection queries", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PersonalAuthProvider>
          <PersonalBillingProvider>
            <TooltipProvider>
              <CalendarView />
            </TooltipProvider>
          </PersonalBillingProvider>
        </PersonalAuthProvider>
      </QueryClientProvider>,
    );

    expect(screen.getAllByTestId("day-cell").length).toBeGreaterThan(0);
    expect(mocks.scheduleSync).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(mocks.syncRange).toHaveBeenCalled();
    });
    expect(mocks.useConnections).not.toHaveBeenCalled();
    expect(mocks.useSyncWhenCalendarConnectionsChange).not.toHaveBeenCalled();
  });
});
