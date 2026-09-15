import { z } from "zod";

import { validateReconstruction } from "../../../../dialext/engine/reconstruction-validate.mjs";

const ms = z.number().int().nonnegative();
const language = z.enum(["english", "irish"]);
const sourceId = z.enum(["irish-asr", "english-asr"]);
const anchor = z.object({ source_id: sourceId, start_ms: ms, end_ms: ms });
const passage = z.object({
  start_ms: ms,
  end_ms: ms,
  speaker: z.string().nullable(),
  text: z.string().min(1).max(4000),
});
const account = z.object({
  segments: z
    .array(
      passage.extend({
        anchors: z.array(anchor).min(1).max(8),
        spoken_language: z
          .enum(["english", "irish", "mixed", "unknown"])
          .default("unknown"),
      }),
    )
    .min(1)
    .max(2000),
});

const recordingBundle = z.object({
  format: z.literal("dialext-recording"),
  version: z.literal(1),
  recording: z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    title: z.string().min(1).max(1024),
    created_at: z.iso.datetime(),
    duration_ms: ms.positive(),
  }),
  evidence: z.object({
    sources: z
      .array(
        z.object({
          source_id: sourceId,
          segments: z.array(passage).min(1).max(2000),
        }),
      )
      .length(2),
  }),
  accounts: z.object({
    english: account.optional(),
    irish: account.optional(),
  }),
  summaries: z
    .object({ english: z.string().optional(), irish: z.string().optional() })
    .default({}),
});

export type ReadingLanguage = z.infer<typeof language>;
const MAX_BYTES = 2 * 1024 * 1024;

export function prepareDialextImport(
  content: string,
  targetLanguage: ReadingLanguage,
  identity: { workspaceId: string; ownerUserId: string },
) {
  if (new TextEncoder().encode(content).length > MAX_BYTES) {
    throw new Error(
      "This recording bundle is larger than the 2 MB prototype import limit.",
    );
  }
  const parsed = recordingBundle.safeParse(JSON.parse(content));
  if (!parsed.success)
    throw new Error("This file is not a supported Dialext recording bundle.");
  const bundle = parsed.data;
  for (const source of bundle.evidence.sources) {
    const intervals = new Set<string>();
    for (const segment of source.segments) {
      const key = `${segment.start_ms}:${segment.end_ms}`;
      if (
        segment.end_ms <= segment.start_ms ||
        segment.end_ms > bundle.recording.duration_ms ||
        intervals.has(key)
      ) {
        throw new Error(
          "An original reading contains an invalid or ambiguous audio interval.",
        );
      }
      intervals.add(key);
    }
  }
  if (
    new Set(bundle.evidence.sources.map((source) => source.source_id)).size !==
    2
  ) {
    throw new Error("Both independent ASR readings are required.");
  }
  for (const [key, value] of Object.entries(bundle.accounts)) {
    if (!value) continue;
    validateReconstruction({
      segments: value.segments,
      language: language.parse(key),
      transcriptPayload: bundle.evidence,
      durationMs: bundle.recording.duration_ms,
    });
    for (const segment of value.segments) {
      if (
        segment.start_ms !==
          Math.min(...segment.anchors.map((item) => item.start_ms)) ||
        segment.end_ms !==
          Math.max(...segment.anchors.map((item) => item.end_ms))
      ) {
        throw new Error(
          "A readable passage must use its supporting audio interval.",
        );
      }
    }
  }
  const selected = bundle.accounts[targetLanguage];
  if (!selected)
    throw new Error(
      "This recording has no prepared reading in the selected language.",
    );
  const sessionId = `dialext-${bundle.recording.id}`;
  const createdAt = bundle.recording.created_at;
  const speakers = [
    ...new Set(
      selected.segments
        .map((segment) => segment.speaker)
        .filter((speaker) => speaker !== null),
    ),
  ];
  const words = selected.segments.map((segment, index) => ({
    id: `${sessionId}:passage:${index}`,
    text: segment.text,
    start_ms: segment.start_ms,
    end_ms: segment.end_ms,
    channel: 0,
    speaker:
      segment.speaker === null
        ? null
        : `Speaker ${String.fromCharCode(65 + speakers.indexOf(segment.speaker))}`,
    metadata: {
      dialext: {
        anchors: segment.anchors,
        source_speaker: segment.speaker,
        target_language: targetLanguage,
        spoken_language: segment.spoken_language,
        timing: "passage",
      },
    },
  }));
  const summary = bundle.summaries[targetLanguage];
  const envelope = {
    schema_version: 1,
    source_id: sessionId,
    revision: 1,
    finalized: true,
    workspace_id: identity.workspaceId,
    owner_user_id: identity.ownerUserId,
    session: {
      id: sessionId,
      title: bundle.recording.title,
      status: "completed",
      created_at: createdAt,
      updated_at: createdAt,
      language: targetLanguage === "english" ? "en" : "ga",
      metadata: {
        dialext: {
          version: 1,
          selected_language: targetLanguage,
          original: bundle,
        },
      },
    },
    documents: summary
      ? [
          {
            id: `${sessionId}:summary`,
            kind: "summary",
            format: "markdown",
            title: targetLanguage === "english" ? "Summary" : "Achoimre",
            body: summary,
            created_at: createdAt,
            updated_at: createdAt,
          },
        ]
      : [],
    transcripts: [
      {
        id: `${sessionId}:reading`,
        provider: "dialext",
        language: targetLanguage === "english" ? "en" : "ga",
        started_at_ms: 0,
        ended_at_ms: bundle.recording.duration_ms,
        words,
        metadata: {
          dialext: {
            kind: "readable_account",
            target_language: targetLanguage,
          },
        },
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
  };
  if (new TextEncoder().encode(JSON.stringify(envelope)).length > MAX_BYTES) {
    throw new Error(
      "The prepared recording exceeds the 2 MB prototype import limit.",
    );
  }
  return { sessionId, envelope };
}
