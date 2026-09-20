import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignDialext: vi.fn(),
  assignSession: vi.fn(),
  assignTranscript: vi.fn(),
}));
vi.mock("@anlg/plugin-db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@anlg/plugin-db")>()),
  assignDialextSpeaker: mocks.assignDialext,
}));
vi.mock("~/stt/queries", () => ({
  assignSessionTranscriptSpeaker: mocks.assignSession,
  assignTranscriptSpeaker: mocks.assignTranscript,
}));
vi.mock("~/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("~/calendar/queries", () => ({
  useSessionEventParticipants: () => [],
}));
vi.mock("~/session/queries", () => ({
  addSessionParticipant: vi.fn(),
  useSession: () => ({ user_id: "owner" }),
  useSessionParticipants: () => [],
}));
vi.mock("~/contacts/queries", () => ({
  createHuman: vi.fn(),
  useHumans: () => [
    { id: "gary-contact", name: "Gary", email: "", avatarDataUrl: null },
  ],
}));

import { SpeakerAssignPopover } from "~/session/components/note-input/transcript/renderer/speaker-assign";

const dialextSegment = {
  key: { channel: "MixedCapture" as const, speaker_index: 0 },
  words: [
    {
      id: "recording:passage:0",
      text: "I would like two tickets, please.",
      start_ms: 0,
      end_ms: 4000,
      channel: "MixedCapture" as const,
      is_final: true,
      metadata: {
        dialext: {
          anchors: [{ source_id: "irish-asr", start_ms: 0, end_ms: 4000 }],
          source_speaker: "spk-1",
        },
      },
    },
  ],
};
const ordinarySegment = {
  key: { channel: "MixedCapture" as const, speaker_index: 0 },
  words: [
    {
      id: "plain:word:0",
      text: "Hello",
      start_ms: 0,
      end_ms: 500,
      channel: "MixedCapture" as const,
      is_final: true,
    },
  ],
};

function mount(segment: typeof dialextSegment | typeof ordinarySegment) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SpeakerAssignPopover
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the renderer's Segment type is wider than this fixture needs.
        segment={segment as any}
        transcriptId="recording:reading"
        sessionId="recording"
        color="#000"
        label="Speaker 1"
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("Speaker 1"));
}

async function chooseGary() {
  fireEvent.click(await screen.findByText("Gary"));
  fireEvent.click(screen.getByText("Confirm"));
}

describe("naming a Dialext passage's speaker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assignDialext.mockResolvedValue("gary");
  });
  afterEach(cleanup);

  it("names the recording-level speaker instead of one reading's label", async () => {
    mount(dialextSegment);
    await chooseGary();
    await waitFor(() => expect(mocks.assignDialext).toHaveBeenCalled());
    expect(mocks.assignDialext).toHaveBeenCalledWith(
      "recording",
      "recording:passage:0",
      "gary-contact",
      null,
    );
    expect(mocks.assignSession).not.toHaveBeenCalled();
    expect(mocks.assignTranscript).not.toHaveBeenCalled();
  });

  it("offers no per-reading scope choice, because the identity is the recording's", async () => {
    mount(dialextSegment);
    expect(await screen.findByText("Gary")).toBeTruthy();
    expect(screen.queryByText("Apply to all")).toBeNull();
  });

  it("leaves an ordinary recording on the existing assignment path", async () => {
    mount(ordinarySegment);
    expect(await screen.findByText("Apply to all")).toBeTruthy();
    await chooseGary();
    await waitFor(() => expect(mocks.assignSession).toHaveBeenCalled());
    expect(mocks.assignDialext).not.toHaveBeenCalled();
  });
});
