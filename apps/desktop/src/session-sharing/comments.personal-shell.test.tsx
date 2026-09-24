import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

const requests = vi.hoisted(() => ({
  loadManagedShare: vi.fn(),
  listComments: vi.fn(),
}));

vi.mock("~/auth", () => ({
  useAuth: () => ({
    session: { user: { id: "stale-user", is_anonymous: false } },
    supabase: {},
  }),
}));
vi.mock("~/shared-notes/cache", () => ({
  loadManagedSharedNoteForSession: requests.loadManagedShare,
}));
vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listSessionShareComments: requests.listComments,
}));

import { useOwnedSessionComments } from "./comments";

it("does not request an owned share or comments with stale auth and cached share data", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    ["session-managed-share", "stale-user", "restored-note"],
    {
      shareId: "stale-share",
      contentRevision: 1,
    },
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useOwnedSessionComments("restored-note"),
    {
      wrapper,
    },
  );
  await waitFor(() => expect(result.current.comments).toEqual([]));
  expect(requests.loadManagedShare).not.toHaveBeenCalled();
  expect(requests.listComments).not.toHaveBeenCalled();
  expect(result.current.selection).toBeNull();
});
