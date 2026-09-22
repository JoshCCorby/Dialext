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
  create: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
  open: vi.fn(),
  task: null as null | {
    id: string;
    session_id: string;
    target_language: "en" | "ga";
    status: "running" | "succeeded" | "failed";
    current_stage: "asr_ga" | "done";
    error: string;
  },
}));

vi.mock("@anlg/plugin-db", () => ({
  createDialextProviderTask: mocks.create,
  startDialextProviderTask: mocks.start,
  cancelDialextProviderTask: mocks.cancel,
}));
vi.mock("./provider-task", () => ({
  useDialextProviderTask: () => mocks.task,
  providerTaskLabel: () => "Checked provider status",
}));
vi.mock("~/settings/queries", () => ({
  useStoredSettingValue: () => ({ value: "ga" }),
}));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: () => mocks.open,
}));

import { DialextProviderGeneration } from "./provider-generation";

function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <DialextProviderGeneration />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.task = null;
  mocks.create.mockResolvedValue({
    taskId: "task-1",
    sessionId: "recording-1",
  });
});
afterEach(cleanup);

it("starts preferred-language fixture generation from a WAV", async () => {
  const view = mount();
  const file = {
    name: "practice.wav",
    size: 3,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as File;
  fireEvent.change(view.container.querySelector("input[type=file]")!, {
    target: { files: [file] },
  });
  await waitFor(() => expect(mocks.create).toHaveBeenCalled());
  expect(mocks.create.mock.calls[0][0]).toBe("practice");
  expect(mocks.create.mock.calls[0][1]).toBe("ga");
  expect(mocks.create.mock.calls[0][2]).toEqual([1, 2, 3]);
});

it("shows stage status without an invented percentage", () => {
  mocks.task = {
    id: "task-1",
    session_id: "recording-1",
    target_language: "en",
    status: "running",
    current_stage: "asr_ga",
    error: "",
  };
  mount();
  expect(screen.getByRole("status").textContent).toBe(
    "Checked provider status",
  );
  expect(screen.queryByText(/%/)).toBeNull();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
});
