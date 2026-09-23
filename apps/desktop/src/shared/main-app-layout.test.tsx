import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet" />,
  useNavigate: () => vi.fn(),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({}),
}));

vi.mock("@anlg/plugin-windows", () => ({
  events: {},
  getCurrentWebviewWindowLabel: () => "main",
}));

vi.mock("./useNewNote", () => ({
  openNewNoteAndListen: vi.fn(),
  openSessionAndListen: vi.fn(),
  useNewNote: () => vi.fn(),
}));

vi.mock("~/auth/personal-context", () => ({
  PersonalAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="personal-auth-provider">{children}</div>
  ),
}));

vi.mock("~/auth/personal-billing", () => ({
  PersonalBillingProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="personal-billing-provider">{children}</div>
  ),
}));

vi.mock("~/services/meeting-import-sync", () => ({
  LocalMeetingImportSync: () => <div data-testid="local-import-sync" />,
}));

vi.mock("~/session/queries", () => ({
  getOrCreateSessionForEventId: vi.fn(),
}));

vi.mock("~/shared/hooks/useMountEffect", () => ({
  useMountEffect: vi.fn(),
}));

vi.mock("~/sidebar/toast/undo-delete-toast", () => ({
  UndoDeleteToast: () => null,
}));

vi.mock("~/store/zustand/tabs", () => ({
  isTabInputSupported: vi.fn(),
  useTabs: () => vi.fn(),
}));

import MainAppLayout from "./main-app-layout";

describe("MainAppLayout", () => {
  afterEach(cleanup);

  it("mounts the local shell inside no-account entitlement providers", () => {
    render(<MainAppLayout />);

    const authProvider = screen.getByTestId("personal-auth-provider");
    expect(
      authProvider.contains(screen.getByTestId("personal-billing-provider")),
    ).toBe(true);
    expect(screen.getByTestId("outlet")).toBeTruthy();
    expect(screen.getByTestId("local-import-sync")).toBeTruthy();
  });
});
