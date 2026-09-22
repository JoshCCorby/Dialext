import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  billing: {
    isPro: false,
    localFeatures: { playbackSpeed: true },
  },
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => mocks.billing,
}));

vi.mock("./provider", () => ({
  useAudioPlayer: () => ({
    registerContainer: vi.fn(),
    state: "stopped",
    pause: vi.fn(),
    resume: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    playbackRate: 1,
    setPlaybackRate: vi.fn(),
    deleteRecording: vi.fn(),
    isDeletingRecording: false,
  }),
  useAudioTime: () => ({ current: 0, total: 10 }),
}));

vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: () => vi.fn(),
}));

vi.mock("./timeline-shell", () => ({
  TimelineMeta: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TimelineShell: ({
    leading,
    meta,
    main,
  }: {
    leading: React.ReactNode;
    meta: React.ReactNode;
    main: React.ReactNode;
  }) => (
    <div>
      {leading}
      {meta}
      {main}
    </div>
  ),
}));

import { Timeline } from "./timeline";

describe("Timeline playback speed", () => {
  beforeEach(() => {
    mocks.billing.isPro = false;
    mocks.billing.localFeatures.playbackSpeed = true;
  });

  afterEach(cleanup);

  it("shows speed controls for personal local access without Pro", () => {
    render(<Timeline />);

    expect(screen.getByRole("button", { name: "1x" })).toBeTruthy();
  });

  it("keeps the entitlement seam when playback speed is denied", () => {
    mocks.billing.localFeatures.playbackSpeed = false;

    render(<Timeline />);

    expect(screen.queryByRole("button", { name: "1x" })).toBeNull();
  });
});
