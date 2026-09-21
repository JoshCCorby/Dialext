import { readPassage, type DialextPassage } from "./source-panel";

import { renderSessionSegments } from "~/chat/context/session-context-hydrator";
import { liveQueryClient } from "~/db";
import { loadSessionContentSnapshot } from "~/session/content-queries";

export type EvidencePassage = DialextPassage & {
  /// A short reference the model cites instead of re-typing a passage id.
  ref: string;
  speaker: string | null;
};

export type QuestionEvidence =
  | { kind: "unavailable" }
  | {
      kind: "passages";
      accountId: string;
      contentVersion: string;
      targetLanguage: string;
      passages: EvidencePassage[];
    };

/// The passages of the reading the reader has selected, with the speaker names they
/// see. It reads the same effective transcript and speaker rendering as the transcript
/// panel, export and chat context, so a question asked months later is answered from
/// the corrected text of the chosen language and nothing else.
export async function loadDialextQuestionEvidence(
  sessionId: string,
  selfHumanId?: string,
): Promise<QuestionEvidence> {
  const [account] = await liveQueryClient.execute<{
    account_id: string;
    transcript_id: string;
    content_version: string;
    target_language: string;
  }>(
    `SELECT dialext_accounts.id AS account_id, transcripts.id AS transcript_id,
        transcripts.content_version, dialext_accounts.target_language
     FROM dialext_recordings
     JOIN sessions ON sessions.id = dialext_recordings.id AND sessions.deleted_at IS NULL
     JOIN dialext_accounts ON dialext_accounts.id = dialext_recordings.active_account_id
       AND dialext_accounts.session_id = dialext_recordings.id
     JOIN transcripts ON transcripts.id = dialext_accounts.transcript_id
       AND transcripts.session_id = dialext_accounts.session_id
       AND transcripts.deleted_at IS NULL
     WHERE dialext_recordings.id = ?`,
    [sessionId],
  );
  if (!account) return { kind: "unavailable" };

  const snapshot = await loadSessionContentSnapshot(sessionId);
  // The effective projection holds exactly the selected reading. Anything else means
  // the selection moved between the two reads; answering from it could mix languages.
  if (
    !snapshot ||
    snapshot.transcripts.length !== 1 ||
    snapshot.transcripts[0]?.id !== account.transcript_id
  ) {
    return { kind: "unavailable" };
  }

  const segments = await renderSessionSegments(snapshot, selfHumanId);
  const passages: EvidencePassage[] = [];
  for (const segment of segments) {
    for (const word of segment.words) {
      const passage = readPassage(word);
      if (!passage || !passage.text.trim()) continue;
      passages.push({
        ...passage,
        text: passage.text.trim(),
        ref: `P${passages.length + 1}`,
        speaker: segment.speaker_label || null,
      });
    }
  }
  if (passages.length === 0) return { kind: "unavailable" };

  return {
    kind: "passages",
    accountId: account.account_id,
    contentVersion: account.content_version,
    targetLanguage: account.target_language,
    passages,
  };
}

// Words that carry no subject of their own. A question made only of these is a
// question about the recording as a whole.
const STOPWORDS = new Set(
  `a an and are as at be been but by can could did do does for from had has have he
  her him his how i if in into is it its me my no not of on or our she so than that
  the their them then there these they this those to up us was we were what when
  where which who whom why will with would you your yes
  agus an ar ba cad cé conas cathain cén cá do go i is le leis mé na níl ní sa sé sí
  siad tá thú tú bhí bhfuil`
    .split(/\s+/)
    .filter(Boolean),
);
const GENERAL = new Set(
  `about anything discuss discussed discussion everything happen happened happening
  mention mentioned overall recording meeting conversation say said says summarise
  summarize summary talk talked talking tell told main point points topic topics key
  thing things`
    .split(/\s+/)
    .filter(Boolean),
);

export function contentTerms(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (term) => term.length > 1 && !STOPWORDS.has(term),
  );
}

function termsMatch(question: string, passage: string) {
  if (question === passage) return true;
  // A shared stem of at least four letters: "tickets" finds "ticket".
  const shorter = question.length < passage.length ? question : passage;
  const longer = shorter === question ? passage : question;
  return shorter.length >= 4 && longer.startsWith(shorter);
}

export type SelectedEvidence =
  /// The question names something specific and no passage mentions any of it.
  | { kind: "no-match"; terms: string[] }
  | { kind: "evidence"; passages: EvidencePassage[] };

/// Chooses what the model may read, within a character budget small enough for an
/// on-device model. Passages that share a term with the question come first; a
/// question about the recording as a whole gets the recording in order. A specific
/// question that no passage touches is refused here, before any model is asked.
export function selectQuestionEvidence(
  question: string,
  passages: EvidencePassage[],
  budgetChars = 2400,
): SelectedEvidence {
  const specific = contentTerms(question).filter((term) => !GENERAL.has(term));
  const scored = passages.map((passage, order) => {
    const terms = contentTerms(`${passage.speaker ?? ""} ${passage.text}`);
    const score = specific.filter((term) =>
      terms.some((candidate) => termsMatch(term, candidate)),
    ).length;
    return { passage, order, score };
  });
  if (specific.length > 0 && scored.every((entry) => entry.score === 0)) {
    return { kind: "no-match", terms: specific };
  }

  const ranked = [...scored].sort(
    (left, right) => right.score - left.score || left.order - right.order,
  );
  const chosen: typeof scored = [];
  let used = 0;
  for (const entry of ranked) {
    const cost =
      entry.passage.text.length + (entry.passage.speaker ?? "").length;
    if (chosen.length > 0 && used + cost > budgetChars) continue;
    chosen.push(entry);
    used += cost;
  }
  chosen.sort((left, right) => left.order - right.order);
  return { kind: "evidence", passages: chosen.map((entry) => entry.passage) };
}
