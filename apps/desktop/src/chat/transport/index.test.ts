import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agentStream: vi.fn(),
  smoothStream: vi.fn(),
  streamTransform: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  smoothStream: mocks.smoothStream,
  ToolLoopAgent: class {
    stream = mocks.agentStream;
  },
}));

import { CustomChatTransport } from "./index";

describe("CustomChatTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.smoothStream.mockReturnValue(mocks.streamTransform);
    mocks.agentStream.mockResolvedValue({
      toUIMessageStream: vi.fn(
        () =>
          new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
      ),
    });
  });

  it("streams chat responses word by word instead of waiting for newlines", async () => {
    const transport = new CustomChatTransport({} as never, {});

    await transport.sendMessages({
      abortSignal: new AbortController().signal,
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Summarize this meeting" }],
        },
      ],
      trigger: "submit-message",
    });

    expect(mocks.smoothStream).toHaveBeenCalledWith({
      chunking: "word",
    });
    expect(mocks.agentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        experimental_transform: mocks.streamTransform,
      }),
    );
  });

  const question = (contextRefs: unknown[]) => ({
    abortSignal: new AbortController().signal,
    chatId: "chat-1",
    messageId: undefined,
    messages: [
      {
        id: "user-1",
        role: "user" as const,
        metadata: { contextRefs },
        parts: [{ type: "text" as const, text: "What did Gary order?" }],
      },
    ],
    trigger: "submit-message" as const,
  });
  const recording = {
    kind: "session",
    key: "session:auto:recording",
    source: "auto-current",
    sessionId: "recording",
  };

  async function chunks(stream: ReadableStream<unknown>) {
    const read: unknown[] = [];
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return read;
      read.push(value);
    }
  }

  it("lets a grounded answerer own a question about exactly one recording", async () => {
    const answerGrounded = vi.fn().mockResolvedValue({
      text: "He ordered tea.",
      dataType: "data-dialext-answer",
      data: { sessionId: "recording", outcome: "answer", citations: [] },
    });
    const transport = new CustomChatTransport(
      {} as never,
      {},
      undefined,
      undefined,
      answerGrounded,
    );

    const stream = await transport.sendMessages(question([recording]));

    expect(answerGrounded).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "recording",
        question: "What did Gary order?",
      }),
    );
    expect(mocks.agentStream).not.toHaveBeenCalled();
    const read = await chunks(stream);
    expect(read).toContainEqual({
      type: "text-delta",
      id: expect.any(String),
      delta: "He ordered tea.",
    });
    expect(read).toContainEqual({
      type: "data-dialext-answer",
      data: { sessionId: "recording", outcome: "answer", citations: [] },
    });
  });

  it("leaves other questions to the ordinary agent", async () => {
    const answerGrounded = vi.fn().mockResolvedValue(null);
    const transport = new CustomChatTransport(
      {} as never,
      {},
      undefined,
      undefined,
      answerGrounded,
    );

    await transport.sendMessages(question([recording]));
    expect(mocks.agentStream).toHaveBeenCalledTimes(1);

    answerGrounded.mockClear();
    await transport.sendMessages(
      question([
        recording,
        { kind: "human", key: "human:gary", source: "manual", humanId: "gary" },
      ]),
    );
    expect(answerGrounded).not.toHaveBeenCalled();
    expect(mocks.agentStream).toHaveBeenCalledTimes(2);
  });
});
