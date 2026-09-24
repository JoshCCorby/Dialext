import type { SessionContext, Transcript } from "@anlg/plugin-template";
import type { SpeakerContext } from "@anlg/plugin-transcription";

import { loadHumansByIds } from "~/contacts/queries";
import {
  loadSessionContentSnapshot,
  type SessionContentSnapshot,
} from "~/session/content-queries";
import {
  formatMeetingChatRecordsAsMarkdown,
  loadMeetingChatRecords,
} from "~/stt/meeting-chat-records";
import {
  buildRenderTranscriptRequestFromRows,
  collectAssignedHumanIdsFromTranscriptRows,
  type RenderedTranscriptSegmentWithWordMetadata,
  renderTranscriptSegments,
} from "~/stt/render-transcript";

function extractEventName(event: unknown): string | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const record = event as Record<string, unknown>;
  if (typeof record.name === "string" && record.name) {
    return record.name;
  }
  if (typeof record.title === "string" && record.title) {
    return record.title;
  }

  return null;
}

/// The effective transcript rendered into speaker-labelled segments. For a Dialext
/// recording the snapshot holds only the selected reading, so the labels are that
/// reading's. The transcript panel always renders with the session's speaker context,
/// even an empty one; pass it to get the panel's labels rather than chat context's.
export async function renderSessionSegments(
  snapshot: SessionContentSnapshot,
  selfHumanId?: string,
  speakerContext?: SpeakerContext,
): Promise<RenderedTranscriptSegmentWithWordMetadata[]> {
  if (snapshot.transcripts.length === 0) {
    return [];
  }
  const participantHumanIds = snapshot.participants.map(
    (participant) => participant.humanId,
  );
  const assignedHumanIds = collectAssignedHumanIdsFromTranscriptRows(
    snapshot.transcripts,
  );
  const humanIds = [
    ...new Set(
      [...participantHumanIds, ...assignedHumanIds, selfHumanId ?? ""].filter(
        Boolean,
      ),
    ),
  ];
  const humans = await loadHumansByIds(humanIds);
  const request = buildRenderTranscriptRequestFromRows(
    snapshot.transcripts,
    {
      selfHumanId,
      humans: humans
        .filter((human) => human.name)
        .map((human) => ({ human_id: human.id, name: human.name })),
    },
    participantHumanIds,
    speakerContext,
  );
  return request ? renderTranscriptSegments(request) : [];
}

async function buildTranscript(
  snapshot: SessionContentSnapshot,
  selfHumanId?: string,
): Promise<Transcript | null> {
  const { transcripts } = snapshot;
  if (transcripts.length === 0) {
    return null;
  }
  const segments = await renderSessionSegments(snapshot, selfHumanId);
  if (segments.length === 0) {
    return null;
  }

  const startedAtCandidates = transcripts.map(
    (transcript) => transcript.started_at,
  );
  const endedAtCandidates = transcripts
    .map((transcript) => transcript.ended_at)
    .filter((value): value is number => typeof value === "number");

  return {
    segments: segments.map((segment) => ({
      speaker: segment.speaker_label,
      text: segment.text,
    })),
    startedAt:
      startedAtCandidates.length > 0 ? Math.min(...startedAtCandidates) : null,
    endedAt:
      endedAtCandidates.length > 0 ? Math.max(...endedAtCandidates) : null,
  };
}

export async function hydrateSessionContext(
  sessionId: string,
  selfHumanId?: string,
): Promise<SessionContext | null> {
  const snapshot = await loadSessionContentSnapshot(sessionId);
  if (!snapshot) return null;

  const participants = snapshot.participants.flatMap((participant) =>
    participant.name
      ? [{ name: participant.name, jobTitle: participant.jobTitle || null }]
      : [],
  );

  const enhancedContent = snapshot.enhancedNotes
    .map((note) => note.markdown || null)
    .filter((note): note is string => Boolean(note))
    .join("\n\n---\n\n");

  const transcript = await buildTranscript(snapshot, selfHumanId);
  const eventName = extractEventName(snapshot.event);
  const meetingChat = formatMeetingChatRecordsAsMarkdown(
    await loadMeetingChatRecords(sessionId),
  );

  return {
    title: snapshot.title || null,
    date: snapshot.createdAt || null,
    rawContent: snapshot.rawMarkdown || null,
    enhancedContent: enhancedContent || null,
    meetingChat: meetingChat || null,
    transcript,
    participants,
    event: eventName ? { name: eventName } : null,
  };
}
