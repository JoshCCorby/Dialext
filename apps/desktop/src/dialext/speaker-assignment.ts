import { assignDialextSpeaker } from "@anlg/plugin-db";

/// A Dialext passage's speaker is recording-level: naming it names the person for
/// every language account of that recording, not one reading's provider label. The
/// native command resolves which recording speaker a passage belongs to, so the
/// desktop never has to decide that two readings heard the same voice.
export function dialextPassageWordId(segment: {
  words: Array<{ id?: string | null; metadata?: unknown }>;
}): string | null {
  for (const word of segment.words) {
    if (typeof word.id === "string" && word.id && hasDialextAnchors(word)) {
      return word.id;
    }
  }
  return null;
}

export function assignDialextPassageSpeaker(input: {
  sessionId: string;
  wordId: string;
  humanId: string | null;
  expectedHumanId: string | null;
}): Promise<string> {
  return assignDialextSpeaker(
    input.sessionId,
    input.wordId,
    input.humanId,
    input.expectedHumanId,
  );
}

function hasDialextAnchors(word: { metadata?: unknown }): boolean {
  const metadata = word.metadata;
  if (!isRecord(metadata)) return false;
  const dialext = metadata.dialext;
  return (
    isRecord(dialext) &&
    Array.isArray(dialext.anchors) &&
    dialext.anchors.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
