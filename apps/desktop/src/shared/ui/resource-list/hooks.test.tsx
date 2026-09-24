import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { useWebResources } from "./hooks";

import { BUNDLED_TEMPLATES } from "~/templates/bundled";

afterEach(() => vi.unstubAllGlobals());

it("shares bundled templates without authentication or a network request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const gallery = renderHook(() => useWebResources("templates"), { wrapper });
  const picker = renderHook(() => useWebResources("templates"), { wrapper });

  await waitFor(() =>
    expect(gallery.result.current.data).toEqual(BUNDLED_TEMPLATES),
  );
  expect(picker.result.current.data).toEqual(BUNDLED_TEMPLATES);
  expect(BUNDLED_TEMPLATES.map((template) => template.title)).toEqual([
    "Meeting",
    "Lecture",
    "Interview",
    "One-to-one",
  ]);
  expect(fetch).not.toHaveBeenCalled();
});
