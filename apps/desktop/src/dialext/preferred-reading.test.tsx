import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  value: undefined as string | undefined,
  save: vi.fn(),
}));
vi.mock("~/settings/queries", () => ({
  useSettingsReady: () => true,
  useStoredSettingValue: () => ({ value: mocks.value }),
  setSettingValues: mocks.save,
}));
import { PreferredReadingLanguage } from "./preferred-reading";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.value = undefined;
  mocks.save.mockResolvedValue(undefined);
});
afterEach(cleanup);
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <PreferredReadingLanguage />
    </QueryClientProvider>,
  );
}
it("defaults to English and persists the requested language through existing settings", async () => {
  mount();
  expect(
    screen
      .getByRole("button", { name: "English" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Gaeilge" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith({ dialext_reading_language: "ga" }),
  );
});
it("keeps the saved preference visible when persistence refuses", async () => {
  mocks.value = "ga";
  mocks.save.mockRejectedValue(new Error("Local write unavailable"));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Local write unavailable",
    ),
  );
  expect(
    screen
      .getByRole("button", { name: "Gaeilge" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});
