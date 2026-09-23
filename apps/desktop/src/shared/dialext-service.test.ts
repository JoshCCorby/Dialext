import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  service: vi.fn(),
  listConnections: vi.fn(),
  createSession: vi.fn(),
  openUrl: vi.fn(),
  openUrlWithInstruction: vi.fn(),
}));

vi.mock("~/shared/dialext-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dialext-service")>()),
  dialextService: mocks.service,
}));
vi.mock("@anlg/api-client", () => ({
  listConnections: mocks.listConnections,
  createSession: mocks.createSession,
}));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));
vi.mock("@anlg/plugin-windows", () => ({
  openUrlWithInstruction: mocks.openUrlWithInstruction,
}));
vi.mock("~/auth/auth-context", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    getHeaders: () => ({ authorization: "Bearer token" }),
  }),
}));
vi.mock("~/auth", () => ({
  useAuth: () => ({ getHeaders: () => ({ authorization: "Bearer token" }) }),
}));

import { useConnections } from "~/auth/useConnections";
import { openIntegrationUrl } from "~/shared/integration";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    children,
  );
}

describe("hosted connections without a Dialext service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.service.mockReturnValue(null);
  });

  it("does not ask any server for connections", () => {
    const { result } = renderHook(() => useConnections(true), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.listConnections).not.toHaveBeenCalled();
  });

  it("does not open or create an integration session", async () => {
    await openIntegrationUrl(
      "google-calendar",
      undefined,
      "connect",
      undefined,
      { authorization: "Bearer token" },
    );
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.openUrl).not.toHaveBeenCalled();
    expect(mocks.openUrlWithInstruction).not.toHaveBeenCalled();
  });
});

// Hosted imports and calendars reach a server only through `dialextService`. Anarlog's
// endpoints must not come back into these modules.
const sources = import.meta.glob(
  [
    "../imports/*.{ts,tsx}",
    "../calendar/**/*.{ts,tsx}",
    "../services/meeting-import-sync.tsx",
    "../auth/useConnections.ts",
    "./integration.ts",
    "!**/*.test.{ts,tsx}",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("hosted import and calendar sources", () => {
  it("are found", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it.each(Object.entries(sources))(
    "%s names no Anarlog endpoint",
    (_path, source) => {
      for (const endpoint of [
        "VITE_API_URL",
        "VITE_APP_URL",
        "api.anarlog.so",
        "app.anarlog.so",
      ]) {
        expect(source).not.toContain(endpoint);
      }
    },
  );
});
