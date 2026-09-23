import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  AppIconSelector: vi.fn(() => <section>App icon</section>),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("./app-icon", () => ({
  AppIconSelector: mocks.AppIconSelector,
}));

vi.mock("./sidebar-item-fields", () => ({
  SidebarItemFieldsSettings: () => <section>Sidebar items</section>,
}));

vi.mock("./theme", () => ({
  ThemeSelector: () => <section>Theme</section>,
}));

vi.mock("~/settings/page-title", () => ({
  SettingsPageTitle: ({ title }: { title: ReactNode }) => <h2>{title}</h2>,
}));

import { SettingsAppearance } from ".";

describe("SettingsAppearance in the personal shell", () => {
  afterEach(cleanup);

  it("keeps theme and sidebar settings but hides the Anarlog app icon picker", () => {
    render(<SettingsAppearance />);

    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("Sidebar items")).toBeTruthy();
    expect(screen.queryByText("App icon")).toBeNull();
    expect(mocks.AppIconSelector).not.toHaveBeenCalled();
  });
});
